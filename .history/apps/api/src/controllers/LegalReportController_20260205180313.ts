import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';

const toNumber = (val: any) => Number(val) || 0;
const round = (n: number) => Math.round(n * 100) / 100;

export const LegalReportController = {

  getAnalytics: async (req: Request, res: Response) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
      const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

      // ====================================================
      // 1. FETCH DATA
      // ====================================================

      // A. Real Cash In (Payments)
      const payments = await prismaLegal.payment.findMany({
          where: { paidAt: { gte: startDate, lte: endDate } },
          include: { invoice: { include: { items: true } } }
      });

      // B. Refunds/Returns (Cash Out)
      const refunds = await prismaLegal.invoice.findMany({
          where: { 
            type: 'AVOIR', 
            issuedAt: { gte: startDate, lte: endDate }, 
            status: { not: 'ANNULEE' } 
          },
          include: { items: true }
      });

      // C. Pending Debt (Global)
      const unpaidInvoices = await prismaLegal.invoice.findMany({
          where: { 
              type: 'FACTURE', 
              status: 'EN_ATTENTE' 
          },
          select: { totalTTC: true, amountPaid: true }
      });

      // D. Stock Value
      const productsList = await prismaLegal.productA.findMany({ 
          select: { id: true, name: true, priceHT: true, purchaseCost: true, quantity: true, serialNumber: true } 
      });

      // ====================================================
      // 2. AGGREGATE LOGIC
      // ====================================================
      
      let netRevenue = 0; // HT
      let totalCOGS = 0;  // Cost of Goods Sold
      let totalRefunds = 0;
      let totalVAT = 0;   // Net VAT Collected
      
      // ✅ REAL VAT ACCUMULATORS
      let collectedVat10 = 0;
      let collectedVat20 = 0;

      const monthlyStats = Array(12).fill(0).map(() => ({ revenue: 0, refunds: 0, vat: 0, margin: 0 }));
      const productSalesMap = new Map<string, number>();
      const clientSalesMap = new Map<string, number>();

      // --- PROCESS PAYMENTS (REVENUE) ---
      for (const pay of payments) {
          if (!pay.invoice) continue;
          
          const month = new Date(pay.paidAt).getMonth();
          const paidAmount = toNumber(pay.amount);
          
          let totalInvHT = 0;
          let totalInvVAT = 0;
          let totalInvCost = 0;
          
          // Helper to split this specific payment into 10% vs 20% bins
          let invVat10Part = 0;
          let invVat20Part = 0;

          pay.invoice.items.forEach(item => {
              const lineHT = toNumber(item.unitPriceHT) * item.quantity;
              const rate = toNumber(item.vatRateSnapshot || 0.20);
              const lineVAT = lineHT * rate;
              
              totalInvHT += lineHT;
              totalInvVAT += lineVAT;
              totalInvCost += (toNumber(item.unitPurchaseCostSnapshot) * item.quantity);

              if (Math.abs(rate - 0.10) < 0.01) {
                  invVat10Part += lineVAT;
              } else {
                  invVat20Part += lineVAT;
              }

              const pName = item.productName;
              productSalesMap.set(pName, (productSalesMap.get(pName) || 0) + item.quantity);
          });

          const totalInvTTC = totalInvHT + totalInvVAT;
          // How much of the total invoice was paid in this transaction?
          const paymentRatio = totalInvTTC > 0 ? (paidAmount / totalInvTTC) : 0;

          const payHT = totalInvHT * paymentRatio;
          const payVAT = totalInvVAT * paymentRatio;
          const payCost = totalInvCost * paymentRatio;
          const payMargin = payHT - payCost;

          // Add to Totals
          netRevenue += payHT;
          totalVAT += payVAT;
          totalCOGS += payCost;
          
          // ✅ Distribute Real VAT based on payment ratio
          collectedVat10 += (invVat10Part * paymentRatio);
          collectedVat20 += (invVat20Part * paymentRatio);

          monthlyStats[month].revenue += payHT;
          monthlyStats[month].vat += payVAT;
          monthlyStats[month].margin += payMargin;

          const cName = pay.invoice.clientNameSnapshot || "Client Inconnu";
          clientSalesMap.set(cName, (clientSalesMap.get(cName) || 0) + payHT);
      }

      // --- PROCESS REFUNDS (DEDUCTIONS) ---
      for (const ref of refunds) {
          const month = new Date(ref.issuedAt).getMonth();
          const refHT = toNumber(ref.totalHT);
          
          // Calculate exact VAT to deduct per rate
          let refVat10 = 0;
          let refVat20 = 0;
          let refCost = 0;

          ref.items.forEach(i => {
              const lineHT = toNumber(i.unitPriceHT) * i.quantity;
              const rate = toNumber(i.vatRateSnapshot || 0.20);
              const lineVat = lineHT * rate;
              
              if (Math.abs(rate - 0.10) < 0.01) refVat10 += lineVat;
              else refVat20 += lineVat;

              refCost += (toNumber(i.unitPurchaseCostSnapshot) * i.quantity);
          });

          const totalRefVAT = refVat10 + refVat20;
          const refMargin = refHT - refCost;

          totalRefunds += refHT;
          netRevenue -= refHT;
          totalVAT -= totalRefVAT;
          totalCOGS -= refCost;
          
          // ✅ Deduct from Real VAT Accumulators
          collectedVat10 -= refVat10;
          collectedVat20 -= refVat20;

          monthlyStats[month].refunds += refHT;
          monthlyStats[month].vat -= totalRefVAT;
          monthlyStats[month].margin -= refMargin;
      }

      // --- CALCULATE DEBT ---
      const totalDebt = unpaidInvoices.reduce((acc, inv) => {
          return acc + (toNumber(inv.totalTTC) - toNumber(inv.amountPaid));
      }, 0);

      // --- STOCK ANALYSIS ---
      let stockValueCost = 0;
      const alerts: any[] = [];
      productsList.forEach(p => {
          stockValueCost += (toNumber(p.purchaseCost) * p.quantity);
          if (p.quantity <= 5) alerts.push({ id: p.id, name: p.name, quantity: p.quantity });
      });

      const grossMargin = netRevenue - totalCOGS;
      const marginRate = netRevenue > 0 ? (grossMargin / netRevenue) * 100 : 0;

      // ====================================================
      // 3. RETURN DATA
      // ====================================================
      res.json({
        kpi: {
            netRevenue: round(netRevenue),
            grossRevenue: round(netRevenue + totalRefunds),
            totalRefunds: round(totalRefunds),
            netVAT: round(totalVAT),
            grossMargin: round(grossMargin), 
            marginRate: round(marginRate),
            stockValue: round(stockValueCost),
            totalDebt: round(totalDebt),
            taxAnalysis: { 
                totalTva: round(totalVAT), 
                tva20: round(collectedVat20), // ✅ NOW EXACT
                tva10: round(collectedVat10)  // ✅ NOW EXACT
            }
        },
        charts: {
            monthly: monthlyStats.map(m => ({ 
                revenue: round(m.revenue), 
                refunds: round(m.refunds), 
                vat: round(m.vat), 
                margin: round(m.margin) 
            })),
            topProducts: Array.from(productSalesMap.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 5),
            topClients: Array.from(clientSalesMap.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 5)
        },
        alerts: alerts.slice(0, 10)
      });

    } catch (error) { 
        console.error("Analytics Error:", error); 
        res.status(500).json({ error: "Erreur analytique" }); 
    }
  },

  getAccountingExport: async (req: Request, res: Response) => {
    res.json({ message: "Utilisez le bouton d'impression dans le modal." });
  }
};