import { Request, Response } from 'express';
import { prismaInternal, MovementType } from '@marine/db-internal';
import { prismaLegal } from '@marine/db-legal';

// ✅ Robust Number Caster
const toNum = (val: any) => {
    if (!val) return 0;
    if (typeof val.toNumber === 'function') return val.toNumber();
    return Number(val);
};

export const StatsController = {
  
  // 📊 EXECUTIVE SUMMARY (Unified Silo A + B)
  getGlobalStats: async (req: Request, res: Response) => {
    try {
      const { from, to } = req.query;
      const startDate = from ? new Date(String(from)) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(String(to)) : new Date();
      endDate.setHours(23, 59, 59);

      // 1. DATA FETCHING (Parallel from BOTH DBs)
      const [
          internalMovements, 
          legalPayments, // 👈 NEW: Fetch Legal Money
          debtAggB, 
          productsB, 
          productsA, 
          topDebtorsB
      ] = await Promise.all([
        // A. Internal Cash Flow (Silo B)
        prismaInternal.stockMovement.findMany({
          where: { 
            createdAt: { gte: startDate, lte: endDate },
            type: { in: [MovementType.SALE_CASH, MovementType.RETURN, MovementType.PAYMENT] }
          }
        }),
        // B. Legal Cash Flow (Silo A)
        prismaLegal.payment.findMany({
            where: { paidAt: { gte: startDate, lte: endDate } }
        }),
        // C. Internal Debt
        prismaInternal.clientB.aggregate({
          _sum: { balance: true },
          where: { balance: { gt: 0 } }
        }),
        // D. Stock B Assets
        prismaInternal.productB.findMany({
          select: { quantity: true, purchaseCost: true, sellingPrice: true }
        }),
        // E. Stock A Assets
        prismaLegal.productA.findMany({
          select: { quantity: true, purchaseCost: true, priceHT: true }
        }),
        // F. Top Bad Payers (Internal)
        prismaInternal.clientB.findMany({
          where: { balance: { gt: 0 } },
          orderBy: { balance: 'desc' },
          take: 5,
          select: { id: true, name: true, phone: true, balance: true }
        })
      ]);

      // 2. UNIFIED CASH FLOW CALCULATION
      let totalCashFlow = 0;
      const chartMap = new Map<string, number>();

      // Process Silo B (Internal)
      internalMovements.forEach(m => {
        const amount = toNum(m.amount);
        const day = m.createdAt.toISOString().split('T')[0];
        
        let impact = 0;
        if (m.type === MovementType.PAYMENT) impact = Math.abs(amount); // Debt payment is cash IN
        else if (m.type === MovementType.RETURN) impact = -Math.abs(amount); // Return is cash OUT
        else impact = Math.abs(amount); // Sale is cash IN

        totalCashFlow += impact;
        chartMap.set(day, (chartMap.get(day) || 0) + impact);
      });

      // Process Silo A (Legal)
      legalPayments.forEach(p => {
          const amount = toNum(p.amount);
          const day = p.paidAt.toISOString().split('T')[0];
          
          totalCashFlow += amount; // Always positive cash in
          chartMap.set(day, (chartMap.get(day) || 0) + amount);
      });

      const chartData = Array.from(chartMap.entries())
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // 3. GLOBAL ASSET VALUATION
      let stockValueCost = 0;
      let stockValuePotential = 0;

      // Silo B Valuation
      productsB.forEach(p => {
        const qty = p.quantity;
        if (qty > 0) {
          stockValueCost += (qty * toNum(p.purchaseCost));
          stockValuePotential += (qty * toNum(p.sellingPrice));
        }
      });

      // Silo A Valuation
      productsA.forEach(p => {
        const qty = p.quantity;
        if (qty > 0) {
          stockValueCost += (qty * toNum(p.purchaseCost));
          stockValuePotential += (qty * toNum(p.priceHT)); // Legal price is HT usually
        }
      });

      // 4. RESPONSE
      res.json({
        cashFlow: totalCashFlow,
        totalReceivables: toNum(debtAggB._sum.balance), // Currently only tracking Internal Debt here
        stockValueCost,
        stockValuePotential,
        chartData,
        topDebtors: topDebtorsB.map(d => ({ 
          ...d, 
          balance: toNum(d.balance) 
        }))
      });

    } catch (e) {
      console.error("Stats Error:", e);
      res.status(500).json({ error: "Erreur calcul statistiques stratégiques" });
    }
  }
};