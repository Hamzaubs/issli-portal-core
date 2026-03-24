// apps/api/src/controllers/StatsController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { prismaInternal } from '@marine/db-internal'; // Assuming you have this alias
import { Prisma } from '@prisma/client-legal';

// Helper: Safe Decimal Constructor (Handles nulls/undefined)
const toDec = (val: any) => new Prisma.Decimal(val || 0);

export const StatsController = {

  // ===========================================================================
  // 📊 GLOBAL DASHBOARD (Executive View: A + B Aggregation)
  // ===========================================================================
  getGlobalStats: async (req: Request, res: Response) => {
    try {
      // 1. SILO A (LEGAL) - Decimal Precision
      // ---------------------------------------------------
      const paymentsA = await prismaLegal.payment.findMany({
        select: { amount: true }
      });
      
      const salesA = await prismaLegal.invoice.findMany({
        where: { type: 'FACTURE', status: { not: 'ANNULEE' } },
        include: { items: true }
      });

      // CALCULATE A: Revenue (CA)
      // Use .reduce with .add() for Decimals
      const revenueA = paymentsA.reduce(
        (acc, p) => acc.add(toDec(p.amount)), 
        new Prisma.Decimal(0)
      );

      // CALCULATE A: Profit (Margin)
      // (Price - Cost) * Qty
      let profitA = new Prisma.Decimal(0);
      
      salesA.forEach(invoice => {
        invoice.items.forEach(item => {
           const price = toDec(item.unitPriceHT);
           const cost = toDec(item.unitPurchaseCostSnapshot);
           const qty = toDec(item.quantity);
           
           // Margin = (Price - Cost) * Qty
           const lineMargin = (price.sub(cost)).mul(qty);
           profitA = profitA.add(lineMargin);
        });
      });

      // 2. SILO B (INTERNAL) - Number (Standard JS Math)
      // ---------------------------------------------------
      // Note: Silo B usually uses SQLite/JSON so it returns Numbers.
      const movesB = await prismaInternal.stockMovement.findMany({
        where: { type: 'SALE' }
      });

      const revenueB = movesB.reduce((sum, m) => sum + (Number(m.totalAmount) || 0), 0);
      const profitB = movesB.reduce((sum, m) => sum + (Number(m.profit) || 0), 0);

      // 3. AGGREGATION (THE "TRUTH")
      // ---------------------------------------------------
      // Convert A (Decimal) to Number for final addition
      const totalCA = revenueA.toNumber() + revenueB;
      const totalProfit = profitA.toNumber() + profitB;

      res.json({
        period: 'ALL_TIME',
        global: {
          revenue: totalCA,
          profit: totalProfit,
          cash: totalCA // Assuming simple Cash Flow model for now
        },
        breakdown: {
          siloA: {
            revenue: revenueA.toNumber(),
            profit: profitA.toNumber()
          },
          siloB: {
            revenue: revenueB,
            profit: profitB
          }
        }
      });

    } catch (e: any) {
      console.error("Stats Error:", e);
      res.status(500).json({ error: "Erreur calcul statistiques globaux" });
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

        // Fetch B
        const movesB = await prismaInternal.stockMovement.findMany({
            where: { 
                date: {
                    gte: new Date(`${currentYear}-01-01`),
                    lte: new Date(`${currentYear}-12-31`)
                },
                type: 'SALE'
            }
        });

        // Initialize 12 months
        const months = Array(12).fill(0).map((_, i) => ({
            month: i + 1,
            revenueA: 0,
            revenueB: 0,
            total: 0
        }));

        // Fill A (Decimal -> Number)
        invoicesA.forEach(inv => {
            const m = new Date(inv.issuedAt).getMonth();
            // ⚠️ FIX: Use toNumber()
            months[m].revenueA += toDec(inv.totalTTC).toNumber();
        });

        // Fill B (Number)
        movesB.forEach(mov => {
            const m = new Date(mov.date).getMonth();
            months[m].revenueB += Number(mov.totalAmount) || 0;
        });

        // Sum Totals
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