// apps/api/src/controllers/StatsController.ts
import { Request, Response } from 'express';
import { prismaInternal, MovementType } from '@marine/db-internal';

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
  
  // =========================================================
  // 🌍 GLOBAL STATS (NOW STRICTLY SILO B - MASTER REALITY)
  // =========================================================
  getGlobalStats: async (req: Request, res: Response) => {
    try {
      const { from, to } = req.query;
      const startDate = from ? new Date(String(from)) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(String(to)) : new Date();
      endDate.setHours(23, 59, 59, 999);

      // 🚀 Pure, lightning-fast Silo B data.
      const [
          debtAggB,            
          flowB,            
          productsB,
          alertsB,
          quotesAggB,
          topDebtorsB
      ] = await Promise.all([
        prismaInternal.clientB.aggregate({ _sum: { balance: true } }),
        
        prismaInternal.stockMovement.findMany({
            where: { 
                createdAt: { gte: startDate, lte: endDate }, 
                type: { in: [MovementType.SALE_CASH, MovementType.SALE_CREDIT, MovementType.RETURN, MovementType.PAYMENT] },
                snapshotProductName: { not: { contains: '[REPRISE DE DETTE]' } }
            },
            select: { createdAt: true, type: true, paymentMethod: true, amount: true, quantity: true, snapshotPurchaseCost: true, snapshotVatRate: true, totalHT: true, totalTVA: true }
        }),
        
        prismaInternal.productB.findMany({ select: { quantity: true, purchaseCost: true, priceTTC: true } }),
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
          if (!chartMap.has(d)) chartMap.set(d, { date: d, internalSales: 0, internalRefunds: 0 });
          return chartMap.get(d);
      };

      // 🧮 STRICT CENT-MATH AGGREGATION ENGINE
      let caCashTTCCents = 0; let caCashHTCents = 0; let caCashTVACents = 0;
      let costBCents = 0; let salesCountB = 0;
      let realCashBCents = 0; let checksBCents = 0;

      flowB.forEach(m => {
          const d = safeDateString(m.createdAt);
          const daily = ensureDate(d);
          
          // 🛡️ THE FIX: Bulletproof Math Extractor (Forces HT calculation if missing)
          const qty = Math.abs(toNumber(m.quantity));
          const rawTTC = Math.abs(toNumber(m.amount));
          let rawHT = Math.abs(toNumber(m.totalHT));
          
          if (rawHT === 0 && rawTTC > 0) {
              const vatRate = m.snapshotVatRate !== undefined && m.snapshotVatRate !== null ? toNumber(m.snapshotVatRate) : 0.20;
              rawHT = rawTTC / (1 + vatRate);
          }

          const amtTTCCents = Math.round(rawTTC * 100);
          const amtHTCents = Math.round(rawHT * 100);
          const amtTVACents = Math.round(Math.abs(toNumber(m.totalTVA)) * 100);
          const cstCents = Math.round((qty * toNumber(m.snapshotPurchaseCost)) * 100);
          
          const method = String(m.paymentMethod || 'CASH').toUpperCase();
          const isCash = method === 'CASH' || method === 'ESPECES' || method === 'VIREMENT' || method === 'TRANSFER';
          const isCheck = method === 'CHECK' || method === 'CHEQUE';

          if (m.type === 'SALE_CASH' || m.type === 'SALE_CREDIT') {
              caCashTTCCents += amtTTCCents;
              caCashHTCents += amtHTCents;
              caCashTVACents += amtTVACents;
              costBCents += cstCents;
              salesCountB += 1;
              daily.internalSales += (amtTTCCents / 100); // UI Chart maps to MAD
              
              if (m.type === 'SALE_CASH') {
                  if (isCash) realCashBCents += amtTTCCents;
                  if (isCheck) checksBCents += amtTTCCents;
              }
          } else if (m.type === 'RETURN') {
              caCashTTCCents -= amtTTCCents;
              caCashHTCents -= amtHTCents;
              caCashTVACents -= amtTVACents;
              costBCents -= cstCents;
              daily.internalRefunds += (amtTTCCents / 100); // UI Chart maps to MAD
              
              if (m.paymentMethod === 'CASH' || m.paymentMethod === 'ESPECES') { 
                  realCashBCents -= amtTTCCents; 
              } else if (isCheck) { 
                  checksBCents -= amtTTCCents; 
              }
          } else if (m.type === 'PAYMENT') {
              if (method === 'COMPENSATION' || method === 'AVOIR') return;
              if (isCash) realCashBCents += amtTTCCents;
              if (isCheck) checksBCents += amtTTCCents;
          }
      });

      // 🛡️ ACCOUNTING FIX: Gross Margin = Revenue HT - Cost (NOT TTC!)
      const marginCashCents = caCashHTCents - costBCents;
      
      const debtB = toNumber(debtAggB._sum?.balance);

      let stockValueCostCents = 0; let stockValuePotentialCents = 0;
      productsB.forEach(p => {
          const q = toNumber(p.quantity);
          if (q > 0) {
              stockValueCostCents += Math.round(q * toNumber(p.purchaseCost) * 100);
              stockValuePotentialCents += Math.round(q * toNumber(p.priceTTC) * 100); 
          }
      });

      const chartData = Array.from(chartMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      res.json({
          metrics: {
              totalCA: caCashTTCCents / 100, // Master Reality TTC
              salesCount: salesCountB,
              totalProfits: marginCashCents / 100, // Safe HT Margin
              alertsCount: alertsB,
              pipeline: toNumber(quotesAggB._sum?.amount),
              stockValueCost: stockValueCostCents / 100,
              stockValuePotential: stockValuePotentialCents / 100,
              split: { legal: 0, cash: caCashTTCCents / 100 }, 
              treasury: { 
                  realCash: realCashBCents / 100, 
                  checks: checksBCents / 100, 
                  totalDue: debtB 
              },
              revenue: {
                  totalTTC: caCashTTCCents / 100,
                  totalHT: caCashHTCents / 100, 
                  totalTVA: caCashTVACents / 100 
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