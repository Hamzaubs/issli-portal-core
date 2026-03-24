// apps/api/src/controllers/StatsController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { prismaInternal } from '@marine/db-internal'; 
import { Prisma } from '@prisma/client-legal';
// 1. IMPORT INTERNAL ENUMS
import { MovementType } from '@prisma/client-internal';

const toDec = (val: any) => new Prisma.Decimal(val || 0);

export const StatsController = {

  // ===========================================================================
  // 📊 GLOBAL DASHBOARD (Executive View: A + B Aggregation)
  // ===========================================================================
  getGlobalStats: async (req: Request, res: Response) => {
    try {
      // 1. SILO A (LEGAL)
      const paymentsA = await prismaLegal.payment.findMany({ select: { amount: true } });
      const salesA = await prismaLegal.invoice.findMany({
        where: { type: 'FACTURE', status: { not: 'ANNULEE' } },
        include: { items: true }
      });

      const revenueA = paymentsA.reduce((acc, p) => acc.add(toDec(p.amount)), new Prisma.Decimal(0));
      let profitA = new Prisma.Decimal(0);
      salesA.forEach(inv => {
        inv.items.forEach(item => {
           const margin = (toDec(item.unitPriceHT).sub(toDec(item.unitPurchaseCostSnapshot))).mul(toDec(item.quantity));
           profitA = profitA.add(margin);
        });
      });

      // 2. SILO B (INTERNAL) - REPAIRED LOGIC
      // ---------------------------------------------------
      const movesB = await prismaInternal.stockMovement.findMany({
        // ✅ FIX: Use Enum 'OUT' for Sales (assuming OUT = Sale in your schema)
        where: { type: MovementType.OUT },
        include: { product: true } // Fetch product to calculate cost/profit
      });

      // ✅ FIX: Map 'amount' (Total Cash) and calculate Profit dynamically
      const revenueB = movesB.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
      
      const profitB = movesB.reduce((sum, m) => {
          const revenue = Number(m.amount) || 0;
          const cost = (m.product?.purchaseCost || 0) * m.quantity;
          return sum + (revenue - cost);
      }, 0);

      // 3. AGGREGATION
      const totalCA = revenueA.toNumber() + revenueB;
      const totalProfit = profitA.toNumber() + profitB;

      res.json({
        period: 'ALL_TIME',
        global: {
          revenue: totalCA,
          profit: totalProfit,
          cash: totalCA 
        },
        breakdown: {
          siloA: { revenue: revenueA.toNumber(), profit: profitA.toNumber() },
          siloB: { revenue: revenueB, profit: profitB }
        }
      });

    } catch (e: any) {
      console.error("Stats Error:", e);
      res.status(500).json({ error: "Erreur statistiques" });
    }
  },

  // ===========================================================================
  // 📈 MONTHLY TRENDS (Chart Data)
  // ===========================================================================
  getMonthlyTrends: async (req: Request, res: Response) => {
    try {
        const currentYear = new Date().getFullYear();
        
        // Fetch A
        const invoicesA = await prismaLegal.invoice.findMany({
            where: { 
                issuedAt: { 
                    gte: new Date(`${currentYear}-01-01`),
                    lte: new Date(`${currentYear}-12-31`)
                },
                type: 'FACTURE'
            }
        });

        // Fetch B (Repaired)
        const movesB = await prismaInternal.stockMovement.findMany({
            where: { 
                // ✅ FIX: Use 'createdAt' instead of 'date'
                createdAt: {
                    gte: new Date(`${currentYear}-01-01`),
                    lte: new Date(`${currentYear}-12-31`)
                },
                // ✅ FIX: Use Enum
                type: MovementType.OUT
            }
        });

        const months = Array(12).fill(0).map((_, i) => ({
            month: i + 1,
            revenueA: 0,
            revenueB: 0,
            total: 0
        }));

        invoicesA.forEach(inv => {
            const m = new Date(inv.issuedAt).getMonth();
            months[m].revenueA += toDec(inv.totalTTC).toNumber();
        });

        movesB.forEach(mov => {
            // ✅ FIX: Use 'createdAt'
            const m = new Date(mov.createdAt).getMonth();
            // ✅ FIX: Use 'amount'
            months[m].revenueB += Number(mov.amount) || 0;
        });

        months.forEach(m => {
            m.total = m.revenueA + m.revenueB;
        });

        res.json(months);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Erreur tendances" });
    }
  }
};