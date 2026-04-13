// apps/api/src/controllers/StatsController.ts
import { Request, Response } from 'express';
import { prismaInternal } from '@marine/db-internal';
import { prismaLegal } from '@marine/db-legal';
import { Prisma } from '@marine/db-legal';

// Helper: Ensure we always work with Decimals for Silo A
const toDec = (val: any) => new Prisma.Decimal(val || 0);
// Helper: Safe Number for Silo B
const toNumber = (val: any) => (val ? Number(val) : 0);

export const StatsController = {
  
  // 📊 EXECUTIVE SUMMARY (The Big Numbers - Silo A + B)
  getGlobalStats: async (req: Request, res: Response) => {
    try {
      const { from, to } = req.query;
      const startDate = from ? new Date(String(from)) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(String(to)) : new Date();
      endDate.setHours(23, 59, 59);

      // 1. DATA FETCHING (Parallel Silo A + Silo B)
      const [
          internalMovements, // Silo B Flow
          legalPayments,     // Silo A Flow (NEW: Added for True Global Stats)
          debtAggB,          // Silo B Debt
          legalInvoices,     // Silo A Debt (NEW)
          productsB,         // Silo B Stock
          productsA,         // Silo A Stock
          topDebtorsB        // Silo B Top Debtors
      ] = await Promise.all([
        // A. Silo B: Movements
        prismaInternal.stockMovement.findMany({
          where: { 
            createdAt: { gte: startDate, lte: endDate },
            // 🛡️ Use strings to avoid Enum import crashes
            type: { in: ['SALE_CASH', 'RETURN', 'PAYMENT'] } as any
          }
        }),
        // B. Silo A: Payments (Real Cash In)
        prismaLegal.payment.findMany({
            where: { paidAt: { gte: startDate, lte: endDate } },
            select: { amount: true, paidAt: true }
        }),
        // C. Silo B: Global Debt
        prismaInternal.clientB.aggregate({
          _sum: { balance: true },
          where: { balance: { gt: 0 } }
        }),
        // D. Silo A: Unpaid Invoices (Debt)
        prismaLegal.invoice.findMany({
            where: { status: { in: ['EN_ATTENTE', 'PARTIEL'] }, type: 'FACTURE' },
            select: { totalTTC: true, amountPaid: true }
        }),
        // E. Silo B: Stock Lean
        prismaInternal.productB.findMany({
          select: { quantity: true, purchaseCost: true, sellingPrice: true }
        }),
        // F. Silo A: Stock Lean
        prismaLegal.productA.findMany({
          select: { quantity: true, purchaseCost: true, priceHT: true }
        }),
        // G. Silo B: Top 5 Bad Payers
        prismaInternal.clientB.findMany({
          where: { balance: { gt: 0 } },
          orderBy: { balance: 'desc' },
          take: 5,
          select: { id: true, name: true, phone: true, balance: true }
        })
      ]);

      // 2. CASH FLOW & CHART CALCULATION (MERGED A + B)
      let totalCashFlow = 0;
      const chartMap = new Map<string, number>();

      // --- Process Silo B (Internal) ---
      internalMovements.forEach((m: any) => {
        const amount = toNumber(m.amount);
        const day = new Date(m.createdAt).toISOString().split('T')[0];

        // LOGIC: PAYMENT is usually negative in DB (Debt reduction), so abs() it for Cash Flow
        let impact = 0;
        if (m.type === 'PAYMENT') {
          impact = Math.abs(amount); 
        } else if (m.type === 'RETURN') {
          impact = -Math.abs(amount);
        } else {
          impact = amount;
        }

        totalCashFlow += impact;
        chartMap.set(day, (chartMap.get(day) || 0) + impact);
      });

      // --- Process Silo A (Legal) ---
      legalPayments.forEach(p => {
          const amount = toDec(p.amount).toNumber(); // Decimal Safe
          const day = new Date(p.paidAt).toISOString().split('T')[0];
          
          totalCashFlow += amount;
          chartMap.set(day, (chartMap.get(day) || 0) + amount);
      });

      const chartData = Array.from(chartMap.entries())
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // 3. ASSET VALUATION (Silo A + Silo B)
      let stockValueCost = 0;
      let stockValuePotential = 0;

      // Silo B Math (Simple Numbers)
      productsB.forEach((p: any) => {
        const qty = toNumber(p.quantity);
        if (qty > 0) {
          stockValueCost += (qty * toNumber(p.purchaseCost));
          stockValuePotential += (qty * toNumber(p.sellingPrice));
        }
      });

      // Silo A Math (Decimal Precision)
      productsA.forEach(p => {
        const qty = toDec(p.quantity);
        if (qty.isPositive()) {
          // Cost * Qty
          const cost = toDec(p.purchaseCost).mul(qty);
          // Price * Qty
          const potential = toDec(p.priceHT).mul(qty);

          stockValueCost += cost.toNumber();
          stockValuePotential += potential.toNumber();
        }
      });

      // 4. DEBT CALCULATION (MERGED)
      const debtB = debtAggB._sum.balance?.toNumber() || 0;
      
      const debtA = legalInvoices.reduce((acc, inv) => {
          const due = toDec(inv.totalTTC).sub(toDec(inv.amountPaid));
          return acc + due.toNumber();
      }, 0);

      // 5. RESPONSE (Matches ExecutiveDashboard.tsx exactly)
      res.json({
        cashFlow: totalCashFlow,
        totalReceivables: debtB + debtA, // Global Debt
        stockValueCost,
        stockValuePotential,
        chartData,
        topDebtors: topDebtorsB.map((d: any) => ({ 
          ...d, 
          balance: toNumber(d.balance) 
        }))
      });

    } catch (e) {
      console.error("Stats Error:", e);
      res.status(500).json({ error: "Erreur calcul statistiques stratégiques" });
    }
  }
};