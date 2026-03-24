// apps/api/src/controllers/LegalReportController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { Prisma } from '@prisma/client-legal';

// Helper: Safe Decimal Conversion
const toDec = (val: any): Prisma.Decimal => new Prisma.Decimal(val || 0);

// Helper: Round for final display (2 decimals)
const round = (val: Prisma.Decimal | number) => {
    const num = typeof val === 'number' ? val : val.toNumber();
    return Math.round(num * 100) / 100;
};

export const LegalReportController = {

  getAnalytics: async (req: Request, res: Response) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
      const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

      // ====================================================
      // 1. FETCH DATA
      // ====================================================

      // A. Real Cash In (Payments)
      const payments = await prismaLegal.payment.findMany({
          where: { paidAt: { gte: startDate, lte: endDate } },
          include: { invoice: { include: { items: true } } }
      });

      // B. Refunds/Returns (Cash Out)
      const refunds = await prismaLegal.invoice.findMany({
          where: { 
            type: 'AVOIR', 
            issuedAt: { gte: startDate, lte: endDate }, 
            status: { not: 'ANNULEE' } 
          },
          include: { items: true }
      });

      // C. Pending Debt (Global)
      const unpaidInvoices = await prismaLegal.invoice.findMany({
          where: { 
              type: 'FACTURE', 
              status: 'EN_ATTENTE' 
          },
          select: { totalTTC: true, amountPaid: true }
      });

      // D. Stock Value
      const productsList = await prismaLegal.productA.findMany({ 
          select: { id: true, name: true, priceHT: true, purchaseCost: true, quantity: true, serialNumber: true } 
      });

      // ====================================================
      // 2. AGGREGATE LOGIC (STRICT DECIMAL MODE)
      // ====================================================
      
      // Initialize Accumulators as Decimals
      let netRevenue = new Prisma.Decimal(0); // HT
      let totalCOGS = new Prisma.Decimal(0);  // Cost of Goods Sold
      let totalRefunds = new Prisma.Decimal(0);
      let totalVAT = new Prisma.Decimal(0);   // Net VAT Collected
      
      // ✅ REAL VAT ACCUMULATORS
      let collectedVat10 = new Prisma.Decimal(0);
      let collectedVat20 = new Prisma.Decimal(0);

      // Monthly Stats Array (Storing Decimals)
      const monthlyStats = Array(12).fill(0).map(() => ({ 
          revenue: new Prisma.Decimal(0), 
          refunds: new Prisma.Decimal(0), 
          vat: new Prisma.Decimal(0), 
          margin: new Prisma.Decimal(0) 
      }));

      const productSalesMap = new Map<string, number>();
      const clientSalesMap = new Map<string, number>();

      // --- PROCESS PAYMENTS (REVENUE) ---
      for (const pay of payments) {
          if (!pay.invoice) continue;
          
          const month = new Date(pay.paidAt).getMonth();
          const paidAmount = toDec(pay.amount);
          
          let totalInvHT = new Prisma.Decimal(0);
          let totalInvVAT = new Prisma.Decimal(0);
          let totalInvCost = new Prisma.Decimal(0);
          
          // Split logic 10% vs 20%
          let invVat10Part = new Prisma.Decimal(0);
          let invVat20Part = new Prisma.Decimal(0);

          pay.invoice.items.forEach(item => {
              const qty = toDec(item.quantity);
              const price = toDec(item.unitPriceHT);
              const cost = toDec(item.unitPurchaseCostSnapshot);
              const rate = toDec(item.vatRateSnapshot || 0.20);
              
              // Math: LineHT = Price * Qty
              const lineHT = price.mul(qty);
              // Math: LineVAT = LineHT * Rate
              const lineVAT = lineHT.mul(rate);
              
              totalInvHT = totalInvHT.add(lineHT);
              totalInvVAT = totalInvVAT.add(lineVAT);
              totalInvCost = totalInvCost.add(cost.mul(qty));

              // Rate Check (Safe comparison)
              if (rate.sub(0.10).abs().lessThan(0.01)) {
                  invVat10Part = invVat10Part.add(lineVAT);
              } else {
                  invVat20Part = invVat20Part.add(lineVAT);
              }

              const pName = item.productName;
              productSalesMap.set(pName, (productSalesMap.get(pName) || 0) + qty.toNumber());
          });

          const totalInvTTC = totalInvHT.add(totalInvVAT);
          
          // Payment Ratio = Paid / TotalTTC
          // Handle division by zero
          let paymentRatio = new Prisma.Decimal(0);
          if (!totalInvTTC.isZero()) {
              paymentRatio = paidAmount.div(totalInvTTC);
          }

          // Calculate Pro-Rated Values
          const payHT = totalInvHT.mul(paymentRatio);
          const payVAT = totalInvVAT.mul(paymentRatio);
          const payCost = totalInvCost.mul(paymentRatio);
          const payMargin = payHT.sub(payCost);

          // Add to Totals
          netRevenue = netRevenue.add(payHT);
          totalVAT = totalVAT.add(payVAT);
          totalCOGS = totalCOGS.add(payCost);
          
          // ✅ Distribute Real VAT
          collectedVat10 = collectedVat10.add(invVat10Part.mul(paymentRatio));
          collectedVat20 = collectedVat20.add(invVat20Part.mul(paymentRatio));

          // Monthly Aggregation
          monthlyStats[month].revenue = monthlyStats[month].revenue.add(payHT);
          monthlyStats[month].vat = monthlyStats[month].vat.add(payVAT);
          monthlyStats[month].margin = monthlyStats[month].margin.add(payMargin);

          const cName = pay.invoice.clientNameSnapshot || "Client Inconnu";
          clientSalesMap.set(cName, (clientSalesMap.get(cName) || 0) + payHT.toNumber());
      }

      // --- PROCESS REFUNDS (DEDUCTIONS) ---
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
              
              if (rate.sub(0.10).abs().lessThan(0.01)) {
                  refVat10 = refVat10.add(lineVat);
              } else {
                  refVat20 = refVat20.add(lineVat);
              }

              refCost = refCost.add(cost.mul(qty));
          });

          const totalRefVAT = refVat10.add(refVat20);
          const refMargin = refHT.sub(refCost);

          totalRefunds = totalRefunds.add(refHT);
          netRevenue = netRevenue.sub(refHT);
          totalVAT = totalVAT.sub(totalRefVAT);
          totalCOGS = totalCOGS.sub(refCost);
          
          // ✅ Deduct from Real VAT Accumulators
          collectedVat10 = collectedVat10.sub(refVat10);
          collectedVat20 = collectedVat20.sub(refVat20);

          monthlyStats[month].refunds = monthlyStats[month].refunds.add(refHT);
          monthlyStats[month].vat = monthlyStats[month].vat.sub(totalRefVAT);
          monthlyStats[month].margin = monthlyStats[month].margin.sub(refMargin);
      }

      // --- CALCULATE DEBT ---
      const totalDebt = unpaidInvoices.reduce((acc, inv) => {
          const debt = toDec(inv.totalTTC).sub(toDec(inv.amountPaid));
          return acc.add(debt);
      }, new Prisma.Decimal(0));

      // --- STOCK ANALYSIS ---
      let stockValueCost = new Prisma.Decimal(0);
      const alerts: any[] = [];
      
      productsList.forEach(p => {
          const qty = toDec(p.quantity);
          const cost = toDec(p.purchaseCost);
          
          stockValueCost = stockValueCost.add(cost.mul(qty));
          
          // Alert logic: qty <= 5
          if (qty.lte(5)) {
              alerts.push({ id: p.id, name: p.name, quantity: qty.toNumber() });
          }
      });

      const grossMargin = netRevenue.sub(totalCOGS);
      const marginRate = !netRevenue.isZero() 
          ? grossMargin.div(netRevenue).mul(100) 
          : new Prisma.Decimal(0);

      // ====================================================
      // 3. RETURN DATA (CONVERT TO NUMBER FOR JSON)
      // ====================================================
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
            taxAnalysis: { 
                totalTva: round(totalVAT), 
                tva20: round(collectedVat20),
                tva10: round(collectedVat10)
            }
        },
        charts: {
            monthly: monthlyStats.map(m => ({ 
                revenue: round(m.revenue), 
                refunds: round(m.refunds), 
                vat: round(m.vat), 
                margin: round(m.margin) 
            })),
            topProducts: Array.from(productSalesMap.entries())
                .map(([name, total]) => ({ name, total }))
                .sort((a, b) => b.total - a.total).slice(0, 5),
            topClients: Array.from(clientSalesMap.entries())
                .map(([name, total]) => ({ name, total }))
                .sort((a, b) => b.total - a.total).slice(0, 5)
        },
        alerts: alerts.slice(0, 10)
      });

    } catch (error) { 
        console.error("Analytics Error:", error); 
        res.status(500).json({ error: "Erreur analytique" }); 
    }
  },

  getAccountingExport: async (req: Request, res: Response) => {
    res.json({ message: "Utilisez le bouton d'impression dans le modal." });
  }
};