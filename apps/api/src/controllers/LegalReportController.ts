// apps/api/src/controllers/LegalReportController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { Prisma } from '@prisma/client-legal';

// Helper: Safe Decimal Conversion
const toDec = (val: any): Prisma.Decimal => new Prisma.Decimal(val || 0);

// Helper: Round & Format for Excel (French format: 10,50)
const formatExcelNum = (val: Prisma.Decimal | number) => {
    const num = typeof val === 'number' ? val : val.toNumber();
    return (Math.round(num * 100) / 100).toString().replace('.', ',');
};

// Helper: Format Date (DD/MM/YYYY)
const fmtDate = (d: Date) => d.toLocaleDateString('fr-MA');

// Helper: Clean Strings (Remove semicolons)
const clean = (str: any) => String(str || "").replace(/;/g, " ").replace(/\n/g, " ").trim();

export const LegalReportController = {

  // 📊 ANALYTICS (Dual-Layer: Accrual vs Cash)
  getAnalytics: async (req: Request, res: Response) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const month = req.query.month ? Number(req.query.month) : null; 

      let startDate = new Date(`${year}-01-01T00:00:00.000Z`);
      let endDate = new Date(`${year}-12-31T23:59:59.999Z`);

      if (month !== null) {
          startDate = new Date(year, month, 1);
          endDate = new Date(year, month + 1, 0, 23, 59, 59);
      }

      const invoices = await prismaLegal.invoice.findMany({
          where: { 
              type: 'FACTURE', 
              issuedAt: { gte: startDate, lte: endDate }, 
              status: { not: 'ANNULEE' }
          },
          include: { items: true }
      });

      const refunds = await prismaLegal.invoice.findMany({
          where: { 
              type: 'AVOIR', 
              issuedAt: { gte: startDate, lte: endDate }, 
              status: { not: 'ANNULEE' } 
          },
          include: { items: true }
      });

      const payments = await prismaLegal.payment.findMany({
          where: { paidAt: { gte: startDate, lte: endDate } },
          // 🛑 FIX: Include invoice type to subtract refunds accurately
          include: { invoice: { select: { type: true } } }
      });

      const lowStockProducts = await prismaLegal.productA.findMany({
          where: { quantity: { lte: 5 } },
          select: { id: true, name: true, quantity: true },
          take: 10
      });
      const alerts = lowStockProducts.map(p => ({ id: p.id, name: p.name, quantity: Number(p.quantity) }));

      const stockAgg: any = await prismaLegal.$queryRaw`
          SELECT SUM(quantity * purchase_cost) as "totalValue"
          FROM products_legal
          WHERE quantity > 0
      `;
      const stockValueCost = stockAgg[0]?.totalValue ? new Prisma.Decimal(stockAgg[0].totalValue) : new Prisma.Decimal(0);

      let salesHT = new Prisma.Decimal(0);
      let salesTTC = new Prisma.Decimal(0);
      let totalRefundsHT = new Prisma.Decimal(0);
      let totalCOGS = new Prisma.Decimal(0); 
      let totalVAT = new Prisma.Decimal(0); 
      let collectedCash = new Prisma.Decimal(0);

      // 🛑 NEW: Calculate Total Outstanding Debt Safely
      let currentDebt = new Prisma.Decimal(0);

      const monthlyStats = Array(12).fill(0).map(() => ({ 
          invoiced: 0, 
          collected: 0, 
          refunds: 0,
          margin: 0, // Added margin tracking per month
          revenueHT: 0, // Added HT tracking per month
          revenueTTC: 0
      }));
      
      const productSalesMap = new Map<string, number>();
      const clientSalesMap = new Map<string, number>();

      for (const inv of invoices) {
          const m = new Date(inv.issuedAt).getMonth();
          const ht = toDec(inv.totalHT);
          const ttc = toDec(inv.totalTTC);
          const vat = ttc.sub(ht);
          const paid = toDec(inv.amountPaid);
          
          salesHT = salesHT.add(ht);
          salesTTC = salesTTC.add(ttc);
          totalVAT = totalVAT.add(vat);
          
          if (inv.status === 'EN_ATTENTE' || inv.status === 'PARTIEL') {
              currentDebt = currentDebt.add(ttc.sub(paid));
          }

          let invoiceCOGS = new Prisma.Decimal(0);

          inv.items.forEach(item => {
              const qty = toDec(item.quantity);
              const cost = toDec(item.unitPurchaseCostSnapshot);
              const lineCost = cost.mul(qty);
              
              totalCOGS = totalCOGS.add(lineCost);
              invoiceCOGS = invoiceCOGS.add(lineCost);

              const pName = item.productName;
              productSalesMap.set(pName, (productSalesMap.get(pName) || 0) + qty.toNumber());
          });

          monthlyStats[m].invoiced += ht.toNumber();
          monthlyStats[m].revenueHT += ht.toNumber();
          monthlyStats[m].revenueTTC += ttc.toNumber();
          monthlyStats[m].margin += ht.sub(invoiceCOGS).toNumber();

          const cName = inv.clientNameSnapshot || "Client Inconnu";
          clientSalesMap.set(cName, (clientSalesMap.get(cName) || 0) + ht.toNumber());
      }

      for (const ref of refunds) {
          const m = new Date(ref.issuedAt).getMonth();
          const ht = toDec(ref.totalHT);
          const ttc = toDec(ref.totalTTC);
          const vat = ttc.sub(ht);

          totalRefundsHT = totalRefundsHT.add(ht);
          salesHT = salesHT.sub(ht); 
          totalVAT = totalVAT.sub(vat);
          
          monthlyStats[m].refunds += ht.toNumber();
          monthlyStats[m].revenueHT -= ht.toNumber();
          monthlyStats[m].revenueTTC -= ttc.toNumber();

          let refundCOGS = new Prisma.Decimal(0);

          ref.items.forEach(item => {
              const qty = toDec(item.quantity);
              const cost = toDec(item.unitPurchaseCostSnapshot);
              const lineCost = cost.mul(qty);
              
              totalCOGS = totalCOGS.sub(lineCost);
              refundCOGS = refundCOGS.add(lineCost);
          });
          
          monthlyStats[m].margin -= ht.sub(refundCOGS).toNumber();
      }

      // 🛑 CASH PROCESSOR (Refund & Compensation Shield)
      let todayCash = new Prisma.Decimal(0);
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);

      for (const pay of payments) {
          const m = new Date(pay.paidAt).getMonth();
          const amount = toDec(pay.amount);
          const method = String(pay.method).toUpperCase();

          // Ignore virtual compensation
          if (method === 'COMPENSATION' || method === 'AVOIR') continue;

          if (pay.invoice?.type === 'AVOIR') {
              // Subtract Refund Payments
              collectedCash = collectedCash.sub(amount);
              monthlyStats[m].collected -= amount.toNumber();
              if (pay.paidAt >= todayStart) todayCash = todayCash.sub(amount);
          } else {
              // Add Normal Payments
              collectedCash = collectedCash.add(amount);
              monthlyStats[m].collected += amount.toNumber();
              if (pay.paidAt >= todayStart) todayCash = todayCash.add(amount);
          }
      }

      const grossMargin = salesHT.sub(totalCOGS);
      const marginRate = !salesHT.isZero() ? grossMargin.div(salesHT).mul(100) : new Prisma.Decimal(0);
      
      const periodBalance = salesTTC.sub(toDec(refunds.reduce((sum, r) => sum + Number(r.totalTTC), 0))).sub(collectedCash);

      const round = (val: Prisma.Decimal | number) => {
        const num = typeof val === 'number' ? val : val.toNumber();
        return Math.round(num * 100) / 100;
      };

      // ✅ ADDED DYNAMIC QUOTES AGGREGATION TO PREVENT UI CRASH
      const activeQuotes = await prismaLegal.invoice.aggregate({
          where: { type: 'DEVIS', status: { not: 'ANNULEE' } }, 
          _sum: { totalTTC: true },
          _count: true
      });

      res.json({
        kpi: {
            netRevenue: round(salesHT),
            grossMargin: round(grossMargin),
            marginRate: round(marginRate),
            totalRefunds: round(totalRefundsHT),
            
            collectedCash: round(collectedCash),
            periodBalance: round(periodBalance), 
            
            stockValue: round(stockValueCost), 
            invoicedVAT: round(totalVAT),

            // 🛑 INJECTED HT/TTC/DEBT DATA NEEDED BY THE UI
            yearlyHT: round(salesHT),
            yearlyTTC: round(salesTTC),
            yearlyMargin: round(grossMargin),
            revenueToday: round(todayCash),
            totalDebt: round(currentDebt),
            quotesVolume: activeQuotes._sum.totalTTC ? activeQuotes._sum.totalTTC.toNumber() : 0,
            quotesCount: Number(activeQuotes._count)
        },
        charts: {
            monthly: monthlyStats.map(m => ({ 
                revenue: round(m.invoiced), 
                collected: round(m.collected), 
                refunds: round(m.refunds),
                revenueHT: round(m.revenueHT), // UI needs this for Bar Chart
                revenueTTC: round(m.revenueTTC),
                margin: round(m.margin)
            })),
            topProducts: Array.from(productSalesMap.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 5),
            topClients: Array.from(clientSalesMap.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 5)
        },
        alerts
      });

    } catch (error) { 
        console.error("Analytics Error:", error); 
        res.status(500).json({ error: "Erreur analytique" }); 
    }
  },

  // ====================================================
  // 📝 EXPORT CSV STREAMING (Fully Connected for Accountant)
  // ====================================================
  getExport: async (req: Request, res: Response) => {
    try {
        const { type } = req.params; 
        const { start, end } = req.query;

        // 🛡️ 1. VALIDATION CHECK FIRST (Prevents the ERR_HTTP_HEADERS_SENT crash)
        const validTypes = ['journal', 'receipts', 'bilan', 'inventory'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: "Type de rapport inconnu" });
        }

        const startDate = new Date(`${start}T00:00:00.000Z`);
        const endDate = new Date(`${end}T23:59:59.999Z`);

        // 🛡️ 2. SAFE TO SET HEADERS NOW
        const filename = `Export_${type}_${start}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        res.write('\uFEFF');
        res.write('sep=;\n'); 
        res.write(`RAPPORT;${type.toUpperCase()}\n`);
        res.write(`PERIODE;${fmtDate(startDate)} AU ${fmtDate(endDate)}\n\n`);

        // 3. JOURNAL DES VENTES
        if (type === 'journal') {
            res.write("Date;Reference;Client;ICE;Total HT;Total TVA;Total TTC;Etat\n");
            
            let sumHT = new Prisma.Decimal(0);
            let sumTVA = new Prisma.Decimal(0);
            let sumTTC = new Prisma.Decimal(0);
            let cursor: string | undefined = undefined;
            const BATCH_SIZE = 500;

            while (true) {
                const batch: any[] = await prismaLegal.invoice.findMany({
                    where: { issuedAt: { gte: startDate, lte: endDate }, status: { not: 'ANNULEE' } },
                    take: BATCH_SIZE,
                    skip: cursor ? 1 : 0,
                    cursor: cursor ? { id: cursor } : undefined,
                    orderBy: { issuedAt: 'asc' }
                });

                if (batch.length === 0) break;

                for (const inv of batch) {
                    const ht = toDec(inv.totalHT);
                    const ttc = toDec(inv.totalTTC);
                    const tva = ttc.sub(ht);
                    
                    // If it's an AVOIR, deduct it
                    const multiplier = inv.type === 'AVOIR' ? -1 : 1;
                    
                    sumHT = sumHT.add(ht.mul(multiplier));
                    sumTVA = sumTVA.add(tva.mul(multiplier));
                    sumTTC = sumTTC.add(ttc.mul(multiplier));

                    const status = inv.status === 'PAYEE' ? 'Payee' : inv.status === 'AVOIR_EMIS' ? 'Rembourse' : 'En Attente';
                    const sign = inv.type === 'AVOIR' ? '-' : '';
                    
                    res.write(`${fmtDate(inv.issuedAt)};${clean(inv.reference)};${clean(inv.clientNameSnapshot)};${clean(inv.clientIceSnapshot)};${sign}${formatExcelNum(ht)};${sign}${formatExcelNum(tva)};${sign}${formatExcelNum(ttc)};${status}\n`);
                }

                cursor = batch[batch.length - 1].id;
                if (batch.length < BATCH_SIZE) break;
            }

            res.write(`;;;TOTAUX;${formatExcelNum(sumHT)};${formatExcelNum(sumTVA)};${formatExcelNum(sumTTC)};\n`);
        }

        // 4. RELEVE DE TVA (SUR ENCAISSEMENT)
        else if (type === 'receipts') {
            res.write("Date;Ref Paiement;Client;Facture Liee;Mode;Montant Paye TTC;Base HT Estimee;TVA Collectee\n");
            
            let totalCash = new Prisma.Decimal(0);
            let totalBaseHT = new Prisma.Decimal(0);
            let totalTVA = new Prisma.Decimal(0);
            let cursor: string | undefined = undefined;
            const BATCH_SIZE = 500;

            while (true) {
                const batch: any[] = await prismaLegal.payment.findMany({
                    where: { paidAt: { gte: startDate, lte: endDate } },
                    take: BATCH_SIZE,
                    skip: cursor ? 1 : 0,
                    cursor: cursor ? { id: cursor } : undefined,
                    orderBy: { paidAt: 'asc' },
                    include: { invoice: true }
                });

                if (batch.length === 0) break;

                for (const pay of batch) {
                    const amountTTC = toDec(pay.amount);
                    totalCash = totalCash.add(amountTTC);
                    
                    // Estimate the TVA portion based on the linked invoice's global ratio
                    let baseHT = new Prisma.Decimal(0);
                    let tvaAmount = new Prisma.Decimal(0);
                    
                    if (pay.invoice && !toDec(pay.invoice.totalTTC).isZero()) {
                        const ratioHT = toDec(pay.invoice.totalHT).div(toDec(pay.invoice.totalTTC));
                        baseHT = amountTTC.mul(ratioHT);
                        tvaAmount = amountTTC.sub(baseHT);
                        
                        totalBaseHT = totalBaseHT.add(baseHT);
                        totalTVA = totalTVA.add(tvaAmount);
                    }

                    res.write(`${fmtDate(pay.paidAt)};${clean(pay.reference || "-")};${clean(pay.invoice?.clientNameSnapshot)};${clean(pay.invoice?.reference)};${clean(pay.method)};${formatExcelNum(amountTTC)};${formatExcelNum(baseHT)};${formatExcelNum(tvaAmount)}\n`);
                }

                cursor = batch[batch.length - 1].id;
                if (batch.length < BATCH_SIZE) break;
            }

            res.write(`;;;;TOTAL;${formatExcelNum(totalCash)};${formatExcelNum(totalBaseHT)};${formatExcelNum(totalTVA)}\n`);
        }

        // 5. SITUATION BILAN (ACTIF)
        else if (type === 'bilan') {
            res.write("RUBRIQUE;VALEUR (MAD)\n");
            
            // A. Valeur Stock
            const stockAgg: any = await prismaLegal.$queryRaw`
                SELECT SUM(quantity * purchase_cost) as "totalValue"
                FROM products_legal
                WHERE quantity > 0
            `;
            const stockValue = stockAgg[0]?.totalValue ? new Prisma.Decimal(stockAgg[0].totalValue) : new Prisma.Decimal(0);
            res.write(`ACTIF IMMOBILISE (STOCK HT);${formatExcelNum(stockValue)}\n`);

            // B. Créances Clients (Unpaid invoices)
            const unpaidInvoices = await prismaLegal.invoice.findMany({
                where: { type: 'FACTURE', status: { in: ['EN_ATTENTE', 'PARTIEL'] } }
            });
            const creancesTTC = unpaidInvoices.reduce((sum, inv) => {
                const due = toDec(inv.totalTTC).sub(toDec(inv.amountPaid));
                return sum.add(due);
            }, new Prisma.Decimal(0));
            res.write(`CREANCES CLIENTS (TTC);${formatExcelNum(creancesTTC)}\n`);

            // C. Trésorerie (All payments in period)
            const payments = await prismaLegal.payment.aggregate({
                _sum: { amount: true },
                where: { paidAt: { gte: startDate, lte: endDate } }
            });
            const tresorerie = payments._sum.amount ? new Prisma.Decimal(payments._sum.amount) : new Prisma.Decimal(0);
            res.write(`TRESORERIE ENCAISSEE;${formatExcelNum(tresorerie)}\n`);
        }

        // 6. INVENTAIRE STOCK
        else if (type === 'inventory') {
            res.write("Reference;Designation;Quantite;Unite;PAMP (Cout);Prix Vente (HT);Valeur Stock (HT)\n");
            
            let totalValue = new Prisma.Decimal(0);
            let cursor: string | undefined = undefined;
            const BATCH_SIZE = 500;

            while (true) {
                const products: any[] = await prismaLegal.productA.findMany({
                    take: BATCH_SIZE,
                    skip: cursor ? 1 : 0,
                    cursor: cursor ? { id: cursor } : undefined,
                    orderBy: { name: 'asc' }
                });

                if (products.length === 0) break;

                for (const p of products) {
                    const qty = toDec(p.quantity);
                    const cost = toDec(p.purchaseCost);
                    const val = qty.mul(cost);
                    
                    totalValue = totalValue.add(val);
                    res.write(`${clean(p.serialNumber)};${clean(p.name)};${formatExcelNum(qty)};${clean(p.measureUnit)};${formatExcelNum(cost)};${formatExcelNum(toDec(p.priceHT))};${formatExcelNum(val)}\n`);
                }

                cursor = products[products.length - 1].id;
                if (products.length < BATCH_SIZE) break;
            }

            res.write(`;;;;;;${formatExcelNum(totalValue)}\n`);
        }

        res.end();

    } catch (error) {
        console.error("Export Error:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Erreur génération export" });
        } else {
            res.end();
        }
    }
  }
};