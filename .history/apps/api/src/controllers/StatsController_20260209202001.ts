import { Request, Response } from 'express';
import { prismaInternal, MovementType, Prisma } from '@marine/db-internal';
import { prismaLegal } from '@marine/db-legal';

const toNumber = (val: any) => (val ? Number(val) : 0);

export const StatsController = {
  
  // 📊 EXECUTIVE SUMMARY (The Big Numbers - Silo A + B)
  getGlobalStats: async (req: Request, res: Response) => {
    try {
      const { from, to } = req.query;
      const startDate = from ? new Date(String(from)) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(String(to)) : new Date();
      endDate.setHours(23, 59, 59);

      // 1. DATA FETCHING (Parallel)
      const [internalMovements, debtAgg, productsB, productsA, topDebtors] = await Promise.all([
        // Fetch all financial movements (Sales, Returns, Payments)
        prismaInternal.stockMovement.findMany({
          where: { 
            createdAt: { gte: startDate, lte: endDate },
            type: { in: [MovementType.SALE_CASH, MovementType.RETURN, MovementType.PAYMENT] }
          }
        }),
        // Global Debt from Silo B
        prismaInternal.clientB.aggregate({
          _sum: { balance: true },
          where: { balance: { gt: 0 } }
        }),
        // Stock B Lean pull
        prismaInternal.productB.findMany({
          select: { quantity: true, purchaseCost: true, sellingPrice: true }
        }),
        // Stock A Lean pull (Legal assets)
        prismaLegal.productA.findMany({
          select: { quantity: true, purchaseCost: true, priceHT: true }
        }),
        // Top 5 Bad Payers
        prismaInternal.clientB.findMany({
          where: { balance: { gt: 0 } },
          orderBy: { balance: 'desc' },
          take: 5,
          select: { id: true, name: true, phone: true, balance: true }
        })
      ]);

      // 2. CASH FLOW & CHART CALCULATION
      let totalCashFlow = 0;
      const chartMap = new Map<string, number>();

      internalMovements.forEach(m => {
        const amount = toNumber(m.amount);
        const day = m.createdAt.toISOString().split('T')[0];

        // LOGIC: 
        // - SALE_CASH: Positive impact (+)
        // - RETURN: Negative impact (-)
        // - PAYMENT: Negative in DB (Debt reduction), so we use Math.abs (+) to count money entering
        let impact = 0;
        if (m.type === MovementType.PAYMENT) {
          impact = Math.abs(amount); 
        } else {
          impact = amount;
        }

        totalCashFlow += impact;
        chartMap.set(day, (chartMap.get(day) || 0) + impact);
      });

      const chartData = Array.from(chartMap.entries())
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // 3. ASSET VALUATION (Silo A + Silo B)
      let stockValueCost = 0;
      let stockValuePotential = 0;

      // Silo B Math
      productsB.forEach(p => {
        const qty = p.quantity;
        if (qty > 0) {
          stockValueCost += (qty * toNumber(p.purchaseCost));
          stockValuePotential += (qty * toNumber(p.sellingPrice));
        }
      });

      // Silo A Math
      productsA.forEach(p => {
        const qty = p.quantity;
        if (qty > 0) {
          stockValueCost += (qty * toNumber(p.purchaseCost));
          stockValuePotential += (qty * toNumber(p.priceHT));
        }
      });

      // 4. RESPONSE (Matches ExecutiveDashboard.tsx exactly)
      res.json({
        cashFlow: totalCashFlow,
        totalReceivables: debtAgg._sum.balance?.toNumber() || 0,
        stockValueCost,
        stockValuePotential,
        chartData,
        topDebtors: topDebtors.map(d => ({ 
          ...d, 
          balance: d.balance.toNumber() 
        }))
      });

    } catch (e) {
      console.error("Stats Error:", e);
      res.status(500).json({ error: "Erreur calcul statistiques stratégiques" });
    }
  }
};