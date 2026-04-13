// apps/api/src/controllers/StatsController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { prismaInternal } from '@marine/db-internal'; 
import { Prisma } from '@marine/db-legal';

const toDec = (val: any): Prisma.Decimal => new Prisma.Decimal(val || 0);

export const StatsController = {

  // ===========================================================================
  // 1. 📊 GLOBAL DASHBOARD (The "Truth" View)
  // ===========================================================================
  getGlobalStats: async (req: Request, res: Response) => {
    try {
      // --- A. PREPARE DATA SOURCES ---
      
      // 1. REVENUE & MARGIN (Silo A)
      const paymentsA = await prismaLegal.payment.findMany({ select: { amount: true } });
      const salesA = await prismaLegal.invoice.findMany({
        where: { type: 'FACTURE', status: { not: 'ANNULEE' } },
        include: { items: true }
      });

      // 2. DEBT (Silo A) - Unpaid Invoices
      // Note: In Silo A, Debt = TotalTTC - AmountPaid
      const invoicesUnpaidA = await prismaLegal.invoice.findMany({
        where: { status: { in: ['EN_ATTENTE', 'PARTIEL'] }, type: 'FACTURE' }
      });

      // 3. ASSETS (Silo A) - Stock Value
      const productsA = await prismaLegal.productA.findMany();

      // --- B. CALCULATE SILO A METRICS (Decimal Safe) ---
      
      const revenueA = paymentsA.reduce((acc, p) => acc.add(toDec(p.amount)), new Prisma.Decimal(0));
      
      // Profit A Calculation
      let profitA = new Prisma.Decimal(0);
      salesA.forEach(inv => {
        inv.items.forEach(item => {
           const margin = (toDec(item.unitPriceHT).sub(toDec(item.unitPurchaseCostSnapshot))).mul(toDec(item.quantity));
           profitA = profitA.add(margin);
        });
      });

      // Debt A Calculation
      const debtA = invoicesUnpaidA.reduce((acc, inv) => {
          const due = toDec(inv.totalTTC).sub(toDec(inv.amountPaid));
          return acc.add(due);
      }, new Prisma.Decimal(0));

      // Stock Asset Value A
      const stockValueA = productsA.reduce((acc, p) => {
          return acc.add(toDec(p.purchaseCost).mul(toDec(p.quantity)));
      }, new Prisma.Decimal(0));

      // --- C. CALCULATE SILO B METRICS (Internal/Number) ---
      
      // 🛡️ BYPASS: Cast 'where' to any to avoid Enum import issues
      const movesB = await prismaInternal.stockMovement.findMany({
        where: { type: 'OUT' } as any, 
        include: { product: true }
      });
      
      // Fetch Clients B for Debt
      const clientsB = await prismaInternal.internalClient.findMany();
      // Fetch Products B for Stock Value
      const productsB = await prismaInternal.product.findMany();

      const revenueB = movesB.reduce((sum, m: any) => sum + (Number(m.amount) || 0), 0);
      
      const profitB = movesB.reduce((sum, m: any) => {
          const rev = Number(m.amount) || 0;
          const cost = (Number(m.product?.purchaseCost) || 0) * (Number(m.quantity) || 0);
          return sum + (rev - cost);
      }, 0);

      // Debt B (Sum of all client balances)
      const debtB = clientsB.reduce((sum, c: any) => sum + (Number(c.balance) || 0), 0);

      // Stock Value B
      const stockValueB = productsB.reduce((sum, p: any) => {
          return sum + ((Number(p.purchaseCost) || 0) * (Number(p.quantity) || 0));
      }, 0);

      // --- D. AGGREGATION ---
      const totalRevenue = revenueA.toNumber() + revenueB;
      const totalProfit = profitA.toNumber() + profitB;
      const totalDebt = debtA.toNumber() + debtB;
      const totalAssets = stockValueA.toNumber() + stockValueB;
      const salesCount = salesA.length + movesB.length;

      res.json({
        period: 'ALL_TIME',
        global: {
          revenue: totalRevenue,
          profit: totalProfit,
          receivables: totalDebt, // ✅ RESTORED
          assets: totalAssets,    // ✅ RESTORED
          salesCount: salesCount  // ✅ RESTORED
        },
        breakdown: {
          siloA: { 
              revenue: revenueA.toNumber(), 
              profit: profitA.toNumber(),
              debt: debtA.toNumber(),
              assets: stockValueA.toNumber()
          },
          siloB: { 
              revenue: revenueB, 
              profit: profitB,
              debt: debtB,
              assets: stockValueB
          }
        }
      });

    } catch (e: any) {
      console.error("Stats Error:", e);
      res.status(500).json({ error: "Erreur statistiques" });
    }
  },

  // ===========================================================================
  // 2. 📈 MONTHLY TRENDS
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

        invoicesA.forEach(inv => {
            const m = new Date(inv.issuedAt).getMonth();
            months[m].revenueA += toDec(inv.totalTTC).toNumber();
        });

        movesB.forEach((mov: any) => {
            const m = new Date(mov.createdAt).getMonth();
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
  },

  // ===========================================================================
  // 3. 🏆 TOP PRODUCTS (Usually requested by Dashboard)
  // ===========================================================================
  getTopProducts: async (req: Request, res: Response) => {
      try {
          // Simplified: Returns top selling items from Silo A (High Value)
          const items = await prismaLegal.invoiceItem.groupBy({
              by: ['productName'],
              _sum: { quantity: true, unitPriceHT: true }, // Approximation of volume
              orderBy: { _sum: { quantity: 'desc' } },
              take: 5
          });

          const formatted = items.map(i => ({
              name: i.productName,
              volume: Number(i._sum.quantity || 0),
              value: Number(i._sum.unitPriceHT || 0) // Raw sum, for ranking
          }));

          res.json(formatted);
      } catch (e) {
          res.status(500).json({ error: "Erreur top produits" });
      }
  }
};