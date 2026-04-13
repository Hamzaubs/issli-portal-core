// apps/api/src/controllers/LegalReportController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { Prisma } from '@marine/db-legal';

// Helper: Safe Decimal Conversion
const toDec = (val: any): Prisma.Decimal => new Prisma.Decimal(val || 0);

// 🛡️ MATH ENGINE: Strict Centimes for absolute precision in financial reporting
const toCents = (n: any): number => {
    if (!n) return 0;
    const floatVal = typeof n === 'object' && 'toNumber' in n ? n.toNumber() : Number(n);
    return Math.round(floatVal * 100);
};

const fromCents = (cents: number): number => {
    return Number((cents / 100).toFixed(2));
};

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

      // 🛑 MATH ENGINE: Switch accumulators to cents for absolute precision
      let salesHTCents = 0;
      let salesTTCCents = 0;
      let totalRefundsHTCents = 0;
      let totalCOGSCents = 0; 
      let totalVATCents = 0; 
      let collectedCashCents = 0;
      let currentDebtCents = 0;

      const monthlyStats = Array(12).fill(0).map(() => ({ 
          invoiced: 0, 
          collected: 0, 
          refunds: 0,
          margin: 0, 
          revenueHT: 0, 
          revenueTTC: 0
      }));
      
      const productSalesMap = new Map<string, number>();
      const clientSalesMap = new Map<string, number>();

      for (const inv of invoices) {
          const m = new Date(inv.issuedAt).getMonth();
          const htCents = toCents(inv.totalHT);
          const ttcCents = toCents(inv.totalTTC);
          const vatCents = ttcCents - htCents;
          const paidCents = toCents(inv.amountPaid);
          
          salesHTCents += htCents;
          salesTTCCents += ttcCents;
          totalVATCents += vatCents;
          
          if (inv.status === 'EN_ATTENTE' || inv.status === 'PARTIEL') {
              currentDebtCents += (ttcCents - paidCents);
          }

          let invoiceCOGSCents = 0;

          inv.items.forEach(item => {
              const qty = Number(item.quantity);
              const costCents = toCents(item.unitPurchaseCostSnapshot);
              const lineCostCents = costCents * qty;
              
              totalCOGSCents += lineCostCents;
              invoiceCOGSCents += lineCostCents;

              const pName = item.productName;
              productSalesMap.set(pName, (productSalesMap.get(pName) || 0) + qty);
          });

          monthlyStats[m].invoiced += fromCents(htCents);
          monthlyStats[m].revenueHT += fromCents(htCents);
          monthlyStats[m].revenueTTC += fromCents(ttcCents);
          monthlyStats[m].margin += fromCents(htCents - invoiceCOGSCents);

          const cName = inv.clientNameSnapshot || "Client Inconnu";
          clientSalesMap.set(cName, (clientSalesMap.get(cName) || 0) + fromCents(htCents));
      }

      for (const ref of refunds) {
          const m = new Date(ref.issuedAt).getMonth();
          const htCents = toCents(ref.totalHT);
          const ttcCents = toCents(ref.totalTTC);
          const vatCents = ttcCents - htCents;

          totalRefundsHTCents += htCents;
          salesHTCents -= htCents; 
          totalVATCents -= vatCents;
          
          monthlyStats[m].refunds += fromCents(htCents);
          monthlyStats[m].revenueHT -= fromCents(htCents);
          monthlyStats[m].revenueTTC -= fromCents(ttcCents);

          let refundCOGSCents = 0;

          ref.items.forEach(item => {
              const qty = Number(item.quantity);
              const costCents = toCents(item.unitPurchaseCostSnapshot);
              const lineCostCents = costCents * qty;
              
              totalCOGSCents -= lineCostCents;
              refundCOGSCents += lineCostCents;
          });
          
          monthlyStats[m].margin -= fromCents(htCents - refundCOGSCents);
      }

      // 🛑 CASH PROCESSOR
      let todayCashCents = 0;
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);

      for (const pay of payments) {
          const m = new Date(pay.paidAt).getMonth();
          const amountCents = toCents(pay.amount);
          const method = String(pay.method).toUpperCase();

          if (method === 'COMPENSATION' || method === 'AVOIR') continue;

          if (pay.invoice?.type === 'AVOIR') {
              collectedCashCents -= amountCents;
              monthlyStats[m].collected -= fromCents(amountCents);
              if (pay.paidAt >= todayStart) todayCashCents -= amountCents;
          } else {
              collectedCashCents += amountCents;
              monthlyStats[m].collected += fromCents(amountCents);
              if (pay.paidAt >= todayStart) todayCashCents += amountCents;
          }
      }

      const grossMarginCents = salesHTCents - totalCOGSCents;
      const marginRate = salesHTCents !== 0 ? (grossMarginCents / salesHTCents) * 100 : 0;
      
      const totalRefundsTTCCents = refunds.reduce((sum, r) => sum + toCents(r.totalTTC), 0);
      const periodBalanceCents = salesTTCCents - totalRefundsTTCCents - collectedCashCents;

      const activeQuotes = await prismaLegal.invoice.aggregate({
          where: { type: 'DEVIS', status: { not: 'ANNULEE' } }, 
          _sum: { totalTTC: true },
          _count: true
      });

      res.json({
        kpi: {
            netRevenue: fromCents(salesHTCents),
            grossMargin: fromCents(grossMarginCents),
            marginRate: Math.round(marginRate * 100) / 100,
            totalRefunds: fromCents(totalRefundsHTCents),
            
            collectedCash: fromCents(collectedCashCents),
            periodBalance: fromCents(periodBalanceCents), 
            
            stockValue: Number(stockValueCost), 
            invoicedVAT: fromCents(totalVATCents),

            yearlyHT: fromCents(salesHTCents),
            yearlyTTC: fromCents(salesTTCCents),
            yearlyMargin: fromCents(grossMarginCents),
            revenueToday: fromCents(todayCashCents),
            totalDebt: fromCents(currentDebtCents),
            quotesVolume: activeQuotes._sum.totalTTC ? activeQuotes._sum.totalTTC.toNumber() : 0,
            quotesCount: Number(activeQuotes._count)
        },
        charts: {
            monthly: monthlyStats.map(m => ({ 
                ...m,
                revenue: Math.round(m.invoiced * 100) / 100,
                collected: Math.round(m.collected * 100) / 100,
                refunds: Math.round(m.refunds * 100) / 100,
                revenueHT: Math.round(m.revenueHT * 100) / 100,
                revenueTTC: Math.round(m.revenueTTC * 100) / 100,
                margin: Math.round(m.margin * 100) / 100
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
  // 📝 EXPORT CSV STREAMING
  // ====================================================
  getExport: async (req: Request, res: Response) => {
    try {
        const { type } = req.params; 
        const { start, end } = req.query;

        const validTypes = ['journal', 'receipts', 'bilan', 'inventory'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: "Type de rapport inconnu" });
        }

        const startDate = new Date(`${start}T00:00:00.000Z`);
        const endDate = new Date(`${end}T23:59:59.999Z`);

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
            
            let sumHTCents = 0;
            let sumTVACents = 0;
            let sumTTCCents = 0;
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
                    const htCents = toCents(inv.totalHT);
                    const ttcCents = toCents(inv.totalTTC);
                    const tvaCents = ttcCents - htCents;
                    
                    const multiplier = inv.type === 'AVOIR' ? -1 : 1;
                    
                    sumHTCents += (htCents * multiplier);
                    sumTVACents += (tvaCents * multiplier);
                    sumTTCCents += (ttcCents * multiplier);

                    // 🛑 FIX: Explicitly handle PARTIEL and map the exact strict string.
                    let statusStr = 'En Attente';
                    if (inv.status === 'PAYEE') statusStr = 'Payee';
                    else if (inv.status === 'PARTIEL') statusStr = 'Partiel';
                    else if (inv.status === 'AVOIR_EMIS') statusStr = 'Rembourse (Avoir)';
                    else if (inv.status === 'AVOIR_PARTIEL') statusStr = 'Avoir Partiel';

                    const sign = inv.type === 'AVOIR' ? '-' : '';
                    
                    res.write(`${fmtDate(inv.issuedAt)};${clean(inv.reference)};${clean(inv.clientNameSnapshot)};${clean(inv.clientIceSnapshot)};${sign}${formatExcelNum(fromCents(htCents))};${sign}${formatExcelNum(fromCents(tvaCents))};${sign}${formatExcelNum(fromCents(ttcCents))};${statusStr}\n`);
                }

                cursor = batch[batch.length - 1].id;
                if (batch.length < BATCH_SIZE) break;
            }

            res.write(`;;;TOTAUX;${formatExcelNum(fromCents(sumHTCents))};${formatExcelNum(fromCents(sumTVACents))};${formatExcelNum(fromCents(sumTTCCents))};\n`);
        }

        // 4. RELEVE DE TVA (SUR ENCAISSEMENT)
        else if (type === 'receipts') {
            res.write("Date;Ref Paiement;Client;Facture Liee;Mode;Montant Paye TTC;Base HT Estimee;TVA Collectee\n");
            
            let totalCashCents = 0;
            let totalBaseHTCents = 0;
            let totalTVACents = 0;
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
                    const amountTTCCents = toCents(pay.amount);
                    totalCashCents += amountTTCCents;
                    
                    let baseHTCents = 0;
                    let tvaAmountCents = 0;
                    
                    if (pay.invoice && !toDec(pay.invoice.totalTTC).isZero()) {
                        const invHTCents = toCents(pay.invoice.totalHT);
                        const invTTCCents = toCents(pay.invoice.totalTTC);
                        
                        // Calculate ratio safely
                        const ratioHT = invHTCents / invTTCCents;
                        baseHTCents = Math.round(amountTTCCents * ratioHT);
                        tvaAmountCents = amountTTCCents - baseHTCents;
                        
                        totalBaseHTCents += baseHTCents;
                        totalTVACents += tvaAmountCents;
                    }

                    res.write(`${fmtDate(pay.paidAt)};${clean(pay.reference || "-")};${clean(pay.invoice?.clientNameSnapshot)};${clean(pay.invoice?.reference)};${clean(pay.method)};${formatExcelNum(fromCents(amountTTCCents))};${formatExcelNum(fromCents(baseHTCents))};${formatExcelNum(fromCents(tvaAmountCents))}\n`);
                }

                cursor = batch[batch.length - 1].id;
                if (batch.length < BATCH_SIZE) break;
            }

            res.write(`;;;;TOTAL;${formatExcelNum(fromCents(totalCashCents))};${formatExcelNum(fromCents(totalBaseHTCents))};${formatExcelNum(fromCents(totalTVACents))}\n`);
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

            // 🛑 FIX: B. Créances Clients (Math in Cents to avoid floating debt)
            const unpaidInvoices = await prismaLegal.invoice.findMany({
                where: { type: 'FACTURE', status: { in: ['EN_ATTENTE', 'PARTIEL'] } }
            });
            
            const creancesTTCCents = unpaidInvoices.reduce((sumCents, inv) => {
                const ttcCents = toCents(inv.totalTTC);
                const paidCents = toCents(inv.amountPaid);
                return sumCents + (ttcCents - paidCents);
            }, 0);
            
            res.write(`CREANCES CLIENTS (TTC);${formatExcelNum(fromCents(creancesTTCCents))}\n`);

            // C. Trésorerie
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
            
            let totalValueCents = 0;
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
                    const qty = Number(p.quantity);
                    const costCents = toCents(p.purchaseCost);
                    const valCents = Math.round(qty * costCents);
                    
                    totalValueCents += valCents;
                    res.write(`${clean(p.serialNumber)};${clean(p.name)};${formatExcelNum(qty)};${clean(p.measureUnit)};${formatExcelNum(fromCents(costCents))};${formatExcelNum(Number(p.priceHT))};${formatExcelNum(fromCents(valCents))}\n`);
                }

                cursor = products[products.length - 1].id;
                if (products.length < BATCH_SIZE) break;
            }

            res.write(`;;;;;;${formatExcelNum(fromCents(totalValueCents))}\n`);
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