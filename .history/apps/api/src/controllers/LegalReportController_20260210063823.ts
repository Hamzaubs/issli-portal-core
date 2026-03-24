// apps/api/src/controllers/LegalReportController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { Prisma } from '@prisma/client-legal';

// Helper: Safe Decimal Conversion
const toDec = (val: any): Prisma.Decimal => new Prisma.Decimal(val || 0);

// Helper: Round & Format for Excel (French format: 10,50)
const formatExcelNum = (val: Prisma.Decimal | number) => {
    const num = typeof val === 'number' ? val : val.toNumber();
    // Round to 2 decimals and swap DOT for COMMA (Essential for French Excel)
    return (Math.round(num * 100) / 100).toString().replace('.', ',');
};

// Helper: Format Date (DD/MM/YYYY)
const fmtDate = (d: Date) => d.toLocaleDateString('fr-MA');

// Helper: Clean Strings (Remove semicolons to prevent column breaking)
const clean = (str: any) => String(str || "").replace(/;/g, " ").replace(/\n/g, " ").trim();

export const LegalReportController = {

  // 📊 ANALYTICS (Existing Dashboard Logic - Preserved)
  getAnalytics: async (req: Request, res: Response) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
      const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

      const payments = await prismaLegal.payment.findMany({
          where: { paidAt: { gte: startDate, lte: endDate } },
          include: { invoice: { include: { items: true } } }
      });

      const refunds = await prismaLegal.invoice.findMany({
          where: { type: 'AVOIR', issuedAt: { gte: startDate, lte: endDate }, status: { not: 'ANNULEE' } },
          include: { items: true }
      });

      const unpaidInvoices = await prismaLegal.invoice.findMany({
          where: { type: 'FACTURE', status: 'EN_ATTENTE' },
          select: { totalTTC: true, amountPaid: true }
      });

      const productsList = await prismaLegal.productA.findMany({ 
          select: { id: true, name: true, priceHT: true, purchaseCost: true, quantity: true, serialNumber: true } 
      });

      let netRevenue = new Prisma.Decimal(0);
      let totalCOGS = new Prisma.Decimal(0);
      let totalRefunds = new Prisma.Decimal(0);
      let totalVAT = new Prisma.Decimal(0);
      let collectedVat10 = new Prisma.Decimal(0);
      let collectedVat20 = new Prisma.Decimal(0);

      const monthlyStats = Array(12).fill(0).map(() => ({ revenue: new Prisma.Decimal(0), refunds: new Prisma.Decimal(0), vat: new Prisma.Decimal(0), margin: new Prisma.Decimal(0) }));
      const productSalesMap = new Map<string, number>();
      const clientSalesMap = new Map<string, number>();

      for (const pay of payments) {
          if (!pay.invoice) continue;
          const month = new Date(pay.paidAt).getMonth();
          const paidAmount = toDec(pay.amount);
          
          let totalInvHT = new Prisma.Decimal(0);
          let totalInvVAT = new Prisma.Decimal(0);
          let totalInvCost = new Prisma.Decimal(0);
          let invVat10Part = new Prisma.Decimal(0);
          let invVat20Part = new Prisma.Decimal(0);

          pay.invoice.items.forEach(item => {
              const qty = toDec(item.quantity);
              const price = toDec(item.unitPriceHT);
              const cost = toDec(item.unitPurchaseCostSnapshot);
              const rate = toDec(item.vatRateSnapshot || 0.20);
              const lineHT = price.mul(qty);
              const lineVAT = lineHT.mul(rate);
              
              totalInvHT = totalInvHT.add(lineHT);
              totalInvVAT = totalInvVAT.add(lineVAT);
              totalInvCost = totalInvCost.add(cost.mul(qty));

              if (rate.sub(0.10).abs().lessThan(0.01)) invVat10Part = invVat10Part.add(lineVAT);
              else invVat20Part = invVat20Part.add(lineVAT);

              const pName = item.productName;
              productSalesMap.set(pName, (productSalesMap.get(pName) || 0) + qty.toNumber());
          });

          const totalInvTTC = totalInvHT.add(totalInvVAT);
          let paymentRatio = new Prisma.Decimal(0);
          if (!totalInvTTC.isZero()) paymentRatio = paidAmount.div(totalInvTTC);

          const payHT = totalInvHT.mul(paymentRatio);
          const payVAT = totalInvVAT.mul(paymentRatio);
          const payCost = totalInvCost.mul(paymentRatio);
          const payMargin = payHT.sub(payCost);

          netRevenue = netRevenue.add(payHT);
          totalVAT = totalVAT.add(payVAT);
          totalCOGS = totalCOGS.add(payCost);
          collectedVat10 = collectedVat10.add(invVat10Part.mul(paymentRatio));
          collectedVat20 = collectedVat20.add(invVat20Part.mul(paymentRatio));

          monthlyStats[month].revenue = monthlyStats[month].revenue.add(payHT);
          monthlyStats[month].vat = monthlyStats[month].vat.add(payVAT);
          monthlyStats[month].margin = monthlyStats[month].margin.add(payMargin);

          const cName = pay.invoice.clientNameSnapshot || "Client Inconnu";
          clientSalesMap.set(cName, (clientSalesMap.get(cName) || 0) + payHT.toNumber());
      }

      for (const ref of refunds) {
          const month = new Date(ref.issuedAt).getMonth();
          const refHT = toDec(ref.totalHT);
          let refVat10 = new Prisma.Decimal(0);
          let refVat20 = new Prisma.Decimal(0);
          let refCost = new Prisma.Decimal(0);

          ref.items.forEach(i => {
              const qty = toDec(i.quantity);
              const price = toDec(i.unitPriceHT);
              const cost = toDec(i.unitPurchaseCostSnapshot);
              const rate = toDec(i.vatRateSnapshot || 0.20);
              const lineHT = price.mul(qty);
              const lineVat = lineHT.mul(rate);
              
              if (rate.sub(0.10).abs().lessThan(0.01)) refVat10 = refVat10.add(lineVat);
              else refVat20 = refVat20.add(lineVat);
              refCost = refCost.add(cost.mul(qty));
          });

          const totalRefVAT = refVat10.add(refVat20);
          const refMargin = refHT.sub(refCost);

          totalRefunds = totalRefunds.add(refHT);
          netRevenue = netRevenue.sub(refHT);
          totalVAT = totalVAT.sub(totalRefVAT);
          totalCOGS = totalCOGS.sub(refCost);
          collectedVat10 = collectedVat10.sub(refVat10);
          collectedVat20 = collectedVat20.sub(refVat20);

          monthlyStats[month].refunds = monthlyStats[month].refunds.add(refHT);
          monthlyStats[month].vat = monthlyStats[month].vat.sub(totalRefVAT);
          monthlyStats[month].margin = monthlyStats[month].margin.sub(refMargin);
      }

      const totalDebt = unpaidInvoices.reduce((acc, inv) => {
          const debt = toDec(inv.totalTTC).sub(toDec(inv.amountPaid));
          return acc.add(debt);
      }, new Prisma.Decimal(0));

      let stockValueCost = new Prisma.Decimal(0);
      const alerts: any[] = [];
      productsList.forEach(p => {
          const qty = toDec(p.quantity);
          const cost = toDec(p.purchaseCost);
          stockValueCost = stockValueCost.add(cost.mul(qty));
          if (qty.lte(5)) alerts.push({ id: p.id, name: p.name, quantity: qty.toNumber() });
      });

      const grossMargin = netRevenue.sub(totalCOGS);
      const marginRate = !netRevenue.isZero() ? grossMargin.div(netRevenue).mul(100) : new Prisma.Decimal(0);

      // Rounding for Response
      const round = (val: Prisma.Decimal | number) => {
        const num = typeof val === 'number' ? val : val.toNumber();
        return Math.round(num * 100) / 100;
      };

      res.json({
        kpi: {
            netRevenue: round(netRevenue),
            grossRevenue: round(netRevenue.add(totalRefunds)),
            totalRefunds: round(totalRefunds),
            netVAT: round(totalVAT),
            grossMargin: round(grossMargin), 
            marginRate: round(marginRate),
            stockValue: round(stockValueCost),
            totalDebt: round(totalDebt),
            taxAnalysis: { totalTva: round(totalVAT), tva20: round(collectedVat20), tva10: round(collectedVat10) }
        },
        charts: {
            monthly: monthlyStats.map(m => ({ revenue: round(m.revenue), refunds: round(m.refunds), vat: round(m.vat), margin: round(m.margin) })),
            topProducts: Array.from(productSalesMap.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 5),
            topClients: Array.from(clientSalesMap.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 5)
        },
        alerts: alerts.slice(0, 10)
      });

    } catch (error) { 
        console.error("Analytics Error:", error); 
        res.status(500).json({ error: "Erreur analytique" }); 
    }
  },

  // ====================================================
  // 📝 EXPORT CSV "PRO" (With Magic Header)
  // ====================================================
  getExport: async (req: Request, res: Response) => {
    try {
        const { type } = req.params; // journal, receipts, inventory, bilan
        const { start, end } = req.query;

        const startDate = new Date(`${start}T00:00:00.000Z`);
        const endDate = new Date(`${end}T23:59:59.999Z`);

        // ✅ THE MAGIC HEADER: Tells Excel "Use semicolon as separator"
        // Also injects Context (Company Name, Period) for Audit Trail
        let csvContent = "sep=;\n";
        csvContent += `RAPPORT;${type.toUpperCase()}\n`;
        csvContent += `SOCIETE;ISSLI PECHE S.A.R.L\n`;
        csvContent += `PERIODE DU;${fmtDate(startDate)}\n`;
        csvContent += `AU;${fmtDate(endDate)}\n`;
        csvContent += `GENERE LE;${new Date().toLocaleString('fr-MA')}\n\n`;

        let filename = `Export_${type}_${start}.csv`;

        // 1. JOURNAL DES VENTES (For Accounting/DGI)
        if (type === 'journal') {
            const invoices = await prismaLegal.invoice.findMany({
                where: { issuedAt: { gte: startDate, lte: endDate }, status: { not: 'ANNULEE' } },
                orderBy: { issuedAt: 'asc' },
                include: { client: true }
            });

            csvContent += "Date;Reference;Client;ICE;Total HT;Total TVA;Total TTC;Etat\n";
            
            let sumHT = new Prisma.Decimal(0);
            let sumTVA = new Prisma.Decimal(0);
            let sumTTC = new Prisma.Decimal(0);

            invoices.forEach(inv => {
                const ht = toDec(inv.totalHT);
                const ttc = toDec(inv.totalTTC);
                const tva = ttc.sub(ht);
                
                sumHT = sumHT.add(ht);
                sumTVA = sumTVA.add(tva);
                sumTTC = sumTTC.add(ttc);

                const status = inv.status === 'PAYEE' ? 'Payee' : inv.status === 'AVOIR_EMIS' ? 'Rembourse' : 'En Attente';
                
                csvContent += `${fmtDate(inv.issuedAt)};${clean(inv.reference)};${clean(inv.clientNameSnapshot)};${clean(inv.clientIceSnapshot)};${formatExcelNum(ht)};${formatExcelNum(tva)};${formatExcelNum(ttc)};${status}\n`;
            });

            // Summary Footer
            csvContent += `;;;TOTAUX PÉRIODE;${formatExcelNum(sumHT)};${formatExcelNum(sumTVA)};${formatExcelNum(sumTTC)};\n`;
            
            filename = `Journal_Ventes_${start}.csv`;
        }

        // 2. RELEVE ENCAISSEMENTS (Cash Flow)
        else if (type === 'receipts') {
            const payments = await prismaLegal.payment.findMany({
                where: { paidAt: { gte: startDate, lte: endDate } },
                orderBy: { paidAt: 'asc' },
                include: { invoice: true }
            });

            csvContent += "Date;Ref Paiement;Client;Facture;Mode;Montant;Note\n";
            
            let totalCash = new Prisma.Decimal(0);

            payments.forEach(pay => {
                const amount = toDec(pay.amount);
                totalCash = totalCash.add(amount);
                csvContent += `${fmtDate(pay.paidAt)};${clean(pay.reference || "-")};${clean(pay.invoice?.clientNameSnapshot)};${clean(pay.invoice?.reference)};${clean(pay.method)};${formatExcelNum(amount)};${clean(pay.note)}\n`;
            });

            csvContent += `;;;;TOTAL ENCAISSÉ;${formatExcelNum(totalCash)};\n`;
            filename = `Releve_Encaissements_${start}.csv`;
        }

        // 3. INVENTAIRE (Stock Value)
        else if (type === 'inventory') {
            const products = await prismaLegal.productA.findMany({
                orderBy: { name: 'asc' }
            });

            csvContent += "Reference;Designation;Quantite;Unite;PAMP (Cout);Prix Vente (HT);Valeur Stock (HT)\n";
            
            let totalValue = new Prisma.Decimal(0);

            products.forEach(p => {
                const qty = toDec(p.quantity);
                const cost = toDec(p.purchaseCost);
                const val = qty.mul(cost);
                
                totalValue = totalValue.add(val);

                csvContent += `${clean(p.serialNumber)};${clean(p.name)};${formatExcelNum(qty)};${clean(p.measureUnit)};${formatExcelNum(cost)};${formatExcelNum(toDec(p.priceHT))};${formatExcelNum(val)}\n`;
            });

            csvContent += `;;;;;;${formatExcelNum(totalValue)}\n`;
            filename = `Inventaire_Stock_${new Date().toISOString().split('T')[0]}.csv`;
        }

        // 4. BILAN (Simplified)
        else if (type === 'bilan') {
            csvContent += "METRIQUE;VALEUR (MAD)\n";
            csvContent += `Generated;${new Date().toISOString()}\n`;
            csvContent += `Note;Extraction brute pour analyse interne.\n`;
            filename = `Bilan_Simple_${start}.csv`;
        }

        else {
            return res.status(400).json({ error: "Type de rapport inconnu" });
        }

        // ✅ SEND CSV with BOM (Byte Order Mark) for UTF-8 Excel support
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send('\uFEFF' + csvContent);

    } catch (error) {
        console.error("Export Error:", error);
        res.status(500).json({ error: "Erreur génération export" });
    }
  }
};