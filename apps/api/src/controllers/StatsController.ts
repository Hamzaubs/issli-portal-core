// apps/api/src/controllers/StatsController.ts
import { Request, Response } from 'express';
import { prismaInternal, MovementType } from '@marine/db-internal';

const toNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val) || 0;
    if (typeof val === 'object' && val.toNumber) return val.toNumber();
    return 0;
};

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

      const [debtAggB, flowB, productsB, alertsB, quotesAggB, topDebtorsB] = await Promise.all([
        prismaInternal.clientB.aggregate({ _sum: { balance: true } }),
        prismaInternal.stockMovement.findMany({
            where: { 
                createdAt: { gte: startDate, lte: endDate }, 
                type: { in: [MovementType.SALE_CASH, MovementType.SALE_CREDIT, MovementType.RETURN, MovementType.PAYMENT, MovementType.ADJUSTMENT] },
                snapshotProductName: { not: { contains: '[REPRISE DE DETTE]' } }
            },
            select: { type: true, paymentMethod: true, amount: true, quantity: true, snapshotPurchaseCost: true, totalHT: true, totalTVA: true, createdAt: true }
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
            select: { name: true, phone: true, balance: true }
        })
      ]);

      const chartMap = new Map<string, any>();
      const ensureDate = (d: string) => {
          if (!chartMap.has(d)) chartMap.set(d, { date: d, internalSales: 0, internalRefunds: 0 });
          return chartMap.get(d);
      };

      let caCashTTCCents = 0; 
      let caCashHTCents = 0; 
      let caCashTVACents = 0;
      let costOfSalesCents = 0; 
      let realCashBCents = 0;

      flowB.forEach(m => {
          const d = safeDateString(m.createdAt);
          const daily = ensureDate(d);

          const amtSignedCents = Math.round(toNumber(m.amount) * 100);
          const amtAbsTTC = Math.abs(amtSignedCents);
          const amtAbsHT = Math.round(toNumber(m.totalHT) * 100);
          const amtAbsTVA = Math.round(toNumber(m.totalTVA) * 100);
          const purchaseCost = toNumber(m.snapshotPurchaseCost);
          const qty = Math.abs(toNumber(m.quantity));
          
          const method = String(m.paymentMethod || 'CASH').toUpperCase();
          const isCash = method === 'CASH' || method === 'ESPECES' || method === 'VIREMENT' || method === 'TRANSFER';

          if (m.type === 'SALE_CASH' || m.type === 'SALE_CREDIT') {
              caCashTTCCents += amtAbsTTC;
              caCashHTCents += amtAbsHT;
              caCashTVACents += amtAbsTVA;
              costOfSalesCents += Math.round((qty * purchaseCost) * 100); // Marge corrigée
              
              daily.internalSales += (amtAbsTTC / 100);
              
              if (m.type === 'SALE_CASH' && isCash) realCashBCents += amtAbsTTC;
          } 
          else if (m.type === 'RETURN') {
              caCashTTCCents -= amtAbsTTC;
              caCashHTCents -= amtAbsHT;
              caCashTVACents -= amtAbsTVA;
              costOfSalesCents -= Math.round((qty * purchaseCost) * 100);
              
              daily.internalRefunds += (amtAbsTTC / 100);
              
              if (isCash) realCashBCents -= amtAbsTTC;
          } 
          else if (m.type === 'PAYMENT' || m.type === 'ADJUSTMENT') {
              if (isCash) realCashBCents += amtSignedCents;
          }
      });

      const totalStockCost = productsB.reduce((acc, p) => acc + (toNumber(p.quantity) * toNumber(p.purchaseCost)), 0);
      const chartData = Array.from(chartMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      res.json({
          metrics: {
              totalCA: caCashTTCCents / 100,
              totalProfits: (caCashHTCents - costOfSalesCents) / 100,
              stockValueCost: totalStockCost,
              alertsCount: alertsB,
              pipeline: toNumber(quotesAggB._sum?.amount),
              revenue: {
                  totalTTC: caCashTTCCents / 100,
                  totalHT: caCashHTCents / 100,
                  totalTVA: caCashTVACents / 100
              },
              treasury: { 
                  realCash: realCashBCents / 100, 
                  totalDue: toNumber(debtAggB._sum?.balance) 
              }
          },
          charts: chartData, // Re-ajouté pour corriger l'erreur de chargement
          topDebtors: topDebtorsB.map((d: any) => ({ name: d.name, phone: d.phone, total: toNumber(d.balance) }))
      });
    } catch (e) {
      console.error("Stats Error:", e);
      res.status(500).json({ error: "Erreur lors de la génération des stats." });
    }
  }
};