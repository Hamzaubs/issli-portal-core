import { prismaInternal as dbInternal, Prisma, MovementType } from '@marine/db-internal';
import { prismaLegal as dbLegal } from '@marine/db-legal';
import { GlobalMetrics } from '@marine/shared-types';

interface DashboardMetrics extends GlobalMetrics {
  split: { legal: number; cash: number };
  treasury: { realCash: number; storeCredit: number; checks: number; pending: number; totalDue: number };
  charts: DailyChartData[];
}

interface DailyChartData {
  date: string;
  legal: number;
  internalSales: number;
  internalRefunds: number;
}

const SafeMath = {
    add: (a: number, b: number) => Number((a + b).toFixed(2)),
    sub: (a: number, b: number) => Number((a - b).toFixed(2)),
    mult: (a: number, b: number) => Number((a * b).toFixed(2)),
    toNum: (val: Prisma.Decimal | number | null | undefined): number => val ? (typeof val === 'number' ? val : val.toNumber()) : 0
};

interface DateRange { startDate: Date; endDate: Date; }

export const AggregationService = {
  
  async getGlobalMetrics(range: DateRange): Promise<DashboardMetrics> {
    
    // 1. SILO A DATA
    const legalPayments = await dbLegal.payment.findMany({
      where: { paidAt: { gte: range.startDate, lte: range.endDate } },
      include: { invoice: { include: { items: true } } }
    });
    
    const legalRefunds = await dbLegal.invoice.findMany({
        where: { type: 'AVOIR', issuedAt: { gte: range.startDate, lte: range.endDate }, status: { not: 'ANNULEE' } },
        include: { items: true }
    });

    // 2. SILO B DATA
    const internalMovements = await dbInternal.stockMovement.findMany({
      where: { createdAt: { gte: range.startDate, lte: range.endDate }, type: { in: [MovementType.SALE_CASH, MovementType.RETURN] } },
      include: { product: true }
    });

    const internalDebtPayments = await dbInternal.clientPayment.findMany({
        where: { createdAt: { gte: range.startDate, lte: range.endDate } }
    });

    // ✅ NEW: Calculate "Argent Dehors" (Total Outstanding Debt) - Silo B Only
    const allClientsB = await dbInternal.clientB.findMany({ select: { balance: true } });
    const totalDueInternal = allClientsB.reduce((acc, c) => acc + SafeMath.toNum(c.balance), 0);

    let totalCA = 0;
    let totalProfits = 0;
    let salesCount = 0;
    let legalRevenue = 0;
    let internalRevenue = 0;
    
    // Treasury Buckets
    let realCash = 0;
    let checks = 0;
    let pendingDebtNew = 0; // Debt generated IN THIS PERIOD

    const chartMap = new Map<string, DailyChartData>();
    const getDayKey = (d: Date) => d.toISOString().split('T')[0];
    const initDay = (key: string) => {
        if (!chartMap.has(key)) chartMap.set(key, { date: key, legal: 0, internalSales: 0, internalRefunds: 0 });
        return chartMap.get(key)!;
    };

    // --- SILO A ---
    for (const payment of legalPayments) {
        if (!payment.invoice) continue;
        salesCount++;
        const paidTTC = SafeMath.toNum(payment.amount);
        const invHT = SafeMath.toNum(payment.invoice.totalHT);
        const invTTC = SafeMath.toNum(payment.invoice.totalTTC);
        const ratio = invTTC > 0 ? (invHT / invTTC) : 1;
        const revenueHT = SafeMath.mult(paidTTC, ratio);
        
        let cost = 0;
        payment.invoice.items.forEach(i => cost += (SafeMath.toNum(i.unitPurchaseCostSnapshot) * i.quantity));
        const marginRate = invHT > 0 ? ((invHT - cost) / invHT) : 0;
        
        legalRevenue = SafeMath.add(legalRevenue, revenueHT);
        totalProfits = SafeMath.add(totalProfits, SafeMath.mult(revenueHT, marginRate));
        
        initDay(getDayKey(payment.paidAt)).legal = SafeMath.add(initDay(getDayKey(payment.paidAt)).legal, revenueHT);
        
        if (payment.method === 'ESPECES') realCash = SafeMath.add(realCash, paidTTC);
        else if (payment.method === 'CHEQUE') checks = SafeMath.add(checks, paidTTC);
    }

    for (const refund of legalRefunds) {
        const ht = SafeMath.toNum(refund.totalHT);
        let cost = 0; refund.items.forEach(i => cost += (SafeMath.toNum(i.unitPurchaseCostSnapshot) * i.quantity));
        legalRevenue = SafeMath.sub(legalRevenue, ht);
        totalProfits = SafeMath.sub(totalProfits, ht - cost);
        initDay(getDayKey(refund.issuedAt)).legal = SafeMath.sub(initDay(getDayKey(refund.issuedAt)).legal, ht);
    }

    // --- SILO B ---
    for (const move of internalMovements) {
        if (move.product || move.snapshotProductName) {
            let revenue = 0;
            const qty = move.quantity;
            if (move.amount !== null) revenue = SafeMath.toNum(move.amount);
            else {
                const price = move.snapshotSellingPrice ? SafeMath.toNum(move.snapshotSellingPrice) : SafeMath.toNum(move.product?.sellingPrice);
                revenue = SafeMath.mult(price, qty);
            }
            
            const cost = SafeMath.mult(move.snapshotPurchaseCost ? SafeMath.toNum(move.snapshotPurchaseCost) : SafeMath.toNum(move.product?.purchaseCost), qty);
            const profit = revenue - cost;
            const isReturn = move.type === MovementType.RETURN;
            const day = initDay(getDayKey(move.createdAt));

            if (isReturn) {
                internalRevenue = SafeMath.sub(internalRevenue, revenue);
                totalProfits = SafeMath.sub(totalProfits, profit);
                day.internalRefunds = SafeMath.add(day.internalRefunds, revenue);
                if (move.paymentMethod === 'CASH') realCash = SafeMath.sub(realCash, revenue);
            } else {
                salesCount++;
                internalRevenue = SafeMath.add(internalRevenue, revenue);
                totalProfits = SafeMath.add(totalProfits, profit);
                day.internalSales = SafeMath.add(day.internalSales, revenue);
                
                if (move.paymentMethod === 'CASH') realCash = SafeMath.add(realCash, revenue);
                else if (move.paymentMethod === 'CHECK') checks = SafeMath.add(checks, revenue);
                else if (move.paymentMethod === 'CREDIT') pendingDebtNew = SafeMath.add(pendingDebtNew, revenue);
            }
        }
    }

    // ✅ FIX: Add Debt Payments to Treasury
    for (const pay of internalDebtPayments) {
        const amt = SafeMath.toNum(pay.amount);
        if (pay.method === 'ESPECES') realCash = SafeMath.add(realCash, amt);
        else if (pay.method === 'CHEQUE') checks = SafeMath.add(checks, amt);
    }

    totalCA = SafeMath.add(legalRevenue, internalRevenue);

    return {
      totalCA: Number(totalCA.toFixed(2)),
      totalProfits: Number(totalProfits.toFixed(2)),
      salesCount,
      period: { startDate: range.startDate.toISOString(), endDate: range.endDate.toISOString() },
      split: { legal: Number(legalRevenue.toFixed(2)), cash: Number(internalRevenue.toFixed(2)) },
      treasury: {
          realCash: Number(realCash.toFixed(2)),
          storeCredit: 0, 
          checks: Number(checks.toFixed(2)),
          pending: Number(pendingDebtNew.toFixed(2)), // Debt generated THIS PERIOD
          totalDue: Number(totalDueInternal.toFixed(2)) // TOTAL Debt (Argent Dehors)
      },
      charts: Array.from(chartMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    };
  }
};
