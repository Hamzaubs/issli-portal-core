// apps/api/src/controllers/StatsController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { prismaInternal } from '@marine/db-internal'; 
import { Prisma } from '@marine/db-legal';

// Helper: Ensure we always work with Decimals for Silo A
const toDec = (val: any): Prisma.Decimal => new Prisma.Decimal(val || 0);

export const StatsController = {

  // ===========================================================================
  // 📊 GLOBAL DASHBOARD (Executive View: A + B Aggregation)
  // ===========================================================================
  getGlobalStats: async (req: Request, res: Response) => {
    try {
      // ---------------------------------------------------
      // 1. SILO A (LEGAL) - STRICT DECIMAL MATH
      // ---------------------------------------------------
      const paymentsA = await prismaLegal.payment.findMany({ select: { amount: true } });
      const salesA = await prismaLegal.invoice.findMany({
        where: { type: 'FACTURE', status: { not: 'ANNULEE' } },
        include: { items: true }
      });

      // Sum Revenue A
      const revenueA = paymentsA.reduce(
        (acc, p) => acc.add(toDec(p.amount)), 
        new Prisma.Decimal(0)
      );

      // Sum Profit A
      let profitA = new Prisma.Decimal(0);
      
      for (const inv of salesA) {
        for (const item of inv.items) {
           const price = toDec(item.unitPriceHT);
           const cost = toDec(item.unitPurchaseCostSnapshot);
           const qty = toDec(item.quantity);
           
           // Margin = (Price - Cost) * Qty
           const lineMargin = (price.sub(cost)).mul(qty);
           profitA = profitA.add(lineMargin);
        }
      }

      // ---------------------------------------------------
      // 2. SILO B (INTERNAL) - FORCE CONNECTION
      // ---------------------------------------------------
      // 🛡️ BYPASS: Cast 'where' to any to avoid Enum import issues
      const movesB = await prismaInternal.stockMovement.findMany({
        where: { type: 'OUT' } as any, 
        include: { product: true }
      });

      // Calculate Revenue B
      const revenueB = movesB.reduce((sum, m: any) => {
        return sum + (Number(m.amount) || 0);
      }, 0);
      
      // Calculate Profit B
      const profitB = movesB.reduce((sum, m: any) => {
          const revenue = Number(m.amount) || 0;
          const unitCost = Number(m.product?.purchaseCost) || 0;
          const qty = Number(m.quantity) || 0;
          
          const totalCost = unitCost * qty;
          return sum + (revenue - totalCost);
      }, 0);

      // ---------------------------------------------------
      // 3. AGGREGATION
      // ---------------------------------------------------
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

        // Fetch B (With Bypass)
        const movesB = await prismaInternal.stockMovement.findMany({
            where: { 
                createdAt: {
                    gte: new Date(`${currentYear}-01-01`),
                    lte: new Date(`${currentYear}-12-31`)
                },
                type: 'OUT'
            } as any
        });

        const months = Array(12).fill(0).map((_, i) => ({
            month: i + 1,
            revenueA: 0,
            revenueB: 0,
            total: 0
        }));

        // Process A
        invoicesA.forEach(inv => {
            const m = new Date(inv.issuedAt).getMonth();
            months[m].revenueA += toDec(inv.totalTTC).toNumber();
        });

        // Process B
        movesB.forEach((mov: any) => {
            const m = new Date(mov.createdAt).getMonth();
            months[m].revenueB += Number(mov.amount) || 0;
        });

        // Sum
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