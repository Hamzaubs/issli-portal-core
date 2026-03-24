import { Request, Response } from 'express';
import { prismaInternal, MovementType, Prisma } from '@marine/db-internal';

export const StatsController = {
  
  // 📊 EXECUTIVE SUMMARY (The Big Numbers)
  getGlobalStats: async (req: Request, res: Response) => {
    try {
      const { from, to } = req.query;
      const startDate = from ? new Date(String(from)) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(String(to)) : new Date();
      endDate.setHours(23, 59, 59); // End of day

      // 1. CASH FLOW (Actual Money In - Money Out)
      // We sum transactions where money moved (Sales - Returns)
      const salesAgg = await prismaInternal.stockMovement.aggregate({
        _sum: { amount: true },
        where: { 
          type: 'SALE_CASH',
          createdAt: { gte: startDate, lte: endDate }
        }
      });
      
      const returnsAgg = await prismaInternal.stockMovement.aggregate({
        _sum: { amount: true },
        where: { 
          type: 'RETURN',
          createdAt: { gte: startDate, lte: endDate }
        }
      });

      // 2. RECEIVABLES (Money Outside)
      // Sum of all Client Balances > 0
      const debtAgg = await prismaInternal.clientB.aggregate({
        _sum: { balance: true },
        where: { balance: { gt: 0 } }
      });

      // 3. STOCK VALUE (Asset Valuation)
      // We need to fetch products to calculate (Qty * PurchaseCost) 
      // Prisma doesn't support multiplication in aggregate yet, so we pull lean data.
      // For "Big Data", we would use $queryRaw, but for <10k items, this is safe V8 math.
      const allProducts = await prismaInternal.productB.findMany({
        select: { quantity: true, purchaseCost: true, sellingPrice: true }
      });

      let stockValueCost = 0; // Asset Value
      let stockValuePotential = 0; // Sales Potential

      allProducts.forEach(p => {
        const qty = p.quantity;
        const cost = p.purchaseCost.toNumber();
        const price = p.sellingPrice.toNumber();
        if (qty > 0) {
            stockValueCost += (qty * cost);
            stockValuePotential += (qty * price);
        }
      });

      // 4. CHART DATA (Revenue Curve)
      // Group by Day (Last 30 days or selected range)
      // Note: Prisma groupBy is great here.
      const dailySales = await prismaInternal.stockMovement.groupBy({
        by: ['createdAt'],
        _sum: { amount: true },
        where: { 
            type: 'SALE_CASH',
            createdAt: { gte: startDate, lte: endDate }
        },
        orderBy: { createdAt: 'asc' },
      });

      // Normalize Chart Data (Group by YYYY-MM-DD)
      const chartMap = new Map<string, number>();
      dailySales.forEach(item => {
          const day = new Date(item.createdAt).toISOString().split('T')[0];
          const val = item._sum.amount ? item._sum.amount.toNumber() : 0;
          chartMap.set(day, (chartMap.get(day) || 0) + val);
      });

      const chartData = Array.from(chartMap.entries()).map(([date, value]) => ({ date, value }));

      // 5. TOP DEBTORS
      const topDebtors = await prismaInternal.clientB.findMany({
          where: { balance: { gt: 0 } },
          orderBy: { balance: 'desc' },
          take: 5,
          select: { id: true, name: true, phone: true, balance: true }
      });

      res.json({
          cashFlow: (salesAgg._sum.amount?.toNumber() || 0) - (returnsAgg._sum.amount?.toNumber() || 0),
          totalReceivables: debtAgg._sum.balance?.toNumber() || 0,
          stockValueCost,
          stockValuePotential,
          chartData,
          topDebtors: topDebtors.map(d => ({ ...d, balance: d.balance.toNumber() }))
      });

    } catch (e) {
      console.error("Stats Error:", e);
      res.status(500).json({ error: "Erreur calcul statistiques" });
    }
  }
};