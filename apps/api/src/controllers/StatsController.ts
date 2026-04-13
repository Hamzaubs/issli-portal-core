import { Request, Response } from 'express';
import { prismaInternal, MovementType } from '@marine/db-internal';
import { prismaLegal } from '@marine/db-legal';
import { Prisma } from '@marine/db-legal';

// 🛡️ HYPER-RESILIENT NUMBER PARSER
const toNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val) || 0;
    if (typeof val === 'bigint') return Number(val);
    if (typeof val === 'object') {
        if (typeof val.toNumber === 'function') {
            try { return val.toNumber(); } catch(e) {}
        }
        if (val.toString) {
            const parsed = parseFloat(val.toString());
            return isNaN(parsed) ? 0 : parsed;
        }
    }
    return 0;
};

// 🛡️ DATE SAFETY WRAPPER
const safeDateString = (dateVal: any) => {
    try {
        if (!dateVal) return new Date().toISOString().split('T')[0];
        return new Date(dateVal).toISOString().split('T')[0];
    } catch (e) {
        return new Date().toISOString().split('T')[0];
    }
};

export const StatsController = {
  
  getGlobalStats: async (req: Request, res: Response) => {
    try {
      const { from, to } = req.query;
      const startDate = from ? new Date(String(from)) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(String(to)) : new Date();
      endDate.setHours(23, 59, 59, 999);

      const [
          debtAggB,            
          flowB,            
          flowA_Payments,            
          flowA_Invoices,
          productsB,
          productsA,
          alertsA,
          alertsB,
          quotesAggB,
          topDebtorsB
      ] = await Promise.all([
        prismaInternal.clientB.aggregate({ _sum: { balance: true } }),
        
        prismaInternal.stockMovement.findMany({
            where: { 
                createdAt: { gte: startDate, lte: endDate }, 
                // ✅ CRITICAL FIX 1: Restored SALE_CREDIT so true sales hit the Global Revenue
                type: { in: [MovementType.SALE_CASH, MovementType.SALE_CREDIT, MovementType.RETURN, MovementType.PAYMENT] },
                // ✅ CRITICAL FIX 2: Shield analytics from Legacy Debt imports
                snapshotProductName: { not: { contains: '[REPRISE DE DETTE]' } }
            },
            select: { createdAt: true, type: true, paymentMethod: true, amount: true, quantity: true, snapshotPurchaseCost: true }
        }),
        
        prismaLegal.payment.findMany({
            where: { paidAt: { gte: startDate, lte: endDate } },
            select: { paidAt: true, amount: true, method: true, invoice: { select: { type: true } } }
        }),

        prismaLegal.invoice.findMany({
            where: { issuedAt: { gte: startDate, lte: endDate }, status: { not: 'ANNULEE' } },
            select: { issuedAt: true, type: true, totalHT: true, amountPaid: true, totalTTC: true, status: true, items: { select: { quantity: true, unitPurchaseCostSnapshot: true } } }
        }),

        prismaInternal.productB.findMany({ select: { quantity: true, purchaseCost: true, sellingPrice: true } }),
        prismaLegal.productA.findMany({ select: { quantity: true, purchaseCost: true, priceHT: true } }),
        
        prismaLegal.productA.count({ where: { quantity: { lte: 5 } } }),
        prismaInternal.productB.count({ where: { quantity: { lte: 5 } } }),

        prismaInternal.stockMovement.aggregate({
            _sum: { amount: true },
            where: { type: MovementType.QUOTE, createdAt: { gte: startDate, lte: endDate } }
        }),

        prismaInternal.clientB.findMany({
            where: { balance: { gt: 0 } },
            orderBy: { balance: 'desc' },
            take: 5,
            select: { id: true, name: true, phone: true, balance: true }
        })
      ]);

      const chartMap = new Map<string, any>();
      const ensureDate = (d: string) => {
          if (!chartMap.has(d)) chartMap.set(d, { date: d, legal: 0, internalSales: 0, internalRefunds: 0 });
          return chartMap.get(d);
      };

      // --- PROCESS SILO A ---
      let caLegal = 0; let dueA = 0; let salesCountA = 0; let costA = 0;
      flowA_Invoices.forEach(inv => {
          const d = safeDateString(inv.issuedAt);
          const daily = ensureDate(d);
          const rev = toNumber(inv.totalHT);
          
          if (inv.type === 'FACTURE') {
              caLegal += rev;
              daily.legal += rev;
              salesCountA += 1;
              if (inv.status === 'EN_ATTENTE' || inv.status === 'PARTIEL') dueA += Math.max(0, toNumber(inv.totalTTC) - toNumber(inv.amountPaid));
          } else if (inv.type === 'AVOIR') {
              caLegal -= rev;
              daily.legal -= rev;
          }
          if (inv.items) {
              inv.items.forEach(item => { costA += (toNumber(item.quantity) * toNumber(item.unitPurchaseCostSnapshot)); });
          }
      });
      const marginLegal = caLegal - costA;

      // --- PROCESS SILO B ---
      let caCash = 0; let costB = 0; let salesCountB = 0;
      let realCashB = 0; let checksB = 0;

      flowB.forEach(m => {
          const d = safeDateString(m.createdAt);
          const daily = ensureDate(d);
          const amt = Math.abs(toNumber(m.amount));
          const cst = toNumber(m.quantity) * toNumber(m.snapshotPurchaseCost);
          
          const method = String(m.paymentMethod || 'CASH').toUpperCase();
          const isCash = method === 'CASH' || method === 'ESPECES' || method === 'VIREMENT' || method === 'TRANSFER';
          const isCheck = method === 'CHECK' || method === 'CHEQUE';

          if (m.type === 'SALE_CASH' || (m.type as any) === 'SALE_CREDIT') {
              caCash += amt;
              costB += cst;
              salesCountB += 1;
              daily.internalSales += amt;
              if (m.type === 'SALE_CASH') {
                  if (isCash) realCashB += amt;
                  if (isCheck) checksB += amt;
              }
          } else if (m.type === 'RETURN') {
              caCash -= amt;
              costB -= cst;
              daily.internalRefunds += amt;
              // Deduct from cash drawer only if it was a cash refund
              if (m.paymentMethod === 'CASH' || m.paymentMethod === 'ESPECES') { 
                  realCashB -= amt; 
              } else if (isCheck) { 
                  checksB -= amt; 
              }
          } else if (m.type === 'PAYMENT') {
              if (method === 'COMPENSATION' || method === 'AVOIR') return;
              if (isCash) realCashB += amt;
              if (isCheck) checksB += amt;
          }
      });

      const marginCash = caCash - costB;
      const debtB = toNumber(debtAggB._sum?.balance);

      // --- PROCESS SILO A TREASURY ---
      let realCashA = 0; let checksA = 0;
      flowA_Payments.forEach(p => { 
          const amt = toNumber(p.amount);
          const method = String(p.method).toUpperCase();

          if (method === 'AVOIR' || method === 'COMPENSATION') return;

          const isCash = method === 'CASH' || method === 'ESPECES' || method === 'VIREMENT' || method === 'TRANSFER';
          const isCheck = method === 'CHECK' || method === 'CHEQUE';

          if (p.invoice?.type === 'AVOIR') {
              if (isCash) realCashA -= amt;
              if (isCheck) checksA -= amt;
          } else {
              if (isCash) realCashA += amt;
              if (isCheck) checksA += amt;
          }
      });

      let stockValueCost = 0; let stockValuePotential = 0;
      productsB.forEach(p => {
          const q = toNumber(p.quantity);
          if (q > 0) {
              stockValueCost += (q * toNumber(p.purchaseCost));
              stockValuePotential += (q * toNumber(p.sellingPrice));
          }
      });
      productsA.forEach(p => {
          const q = toNumber(p.quantity);
          if (q > 0) {
              stockValueCost += (q * toNumber(p.purchaseCost));
              stockValuePotential += (q * toNumber(p.priceHT));
          }
      });

      const chartData = Array.from(chartMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      res.json({
          metrics: {
              totalCA: caLegal + caCash,
              salesCount: salesCountA + salesCountB,
              totalProfits: marginLegal + marginCash,
              alertsCount: alertsA + alertsB,
              pipeline: toNumber(quotesAggB._sum?.amount),
              stockValueCost,
              stockValuePotential,
              split: { legal: caLegal, cash: caCash },
              treasury: { 
                  realCash: realCashA + realCashB, 
                  checks: checksA + checksB, 
                  totalDue: dueA + debtB 
              }
          },
          charts: chartData,
          topDebtors: topDebtorsB.map((d: any) => ({ name: d.name, phone: d.phone, total: toNumber(d.balance) }))
      });
    } catch (e) {
      console.error("Global Stats Error:", e);
      res.status(500).json({ error: "Erreur calcul statistiques globales" });
    }
  }
};