// apps/api/src/controllers/DashboardController.ts
import { Request, Response } from 'express';
import { prismaInternal, MovementType, Prisma } from '@marine/db-internal'; 
import { prismaLegal } from '@marine/db-legal';

// ============================================================================
// 🧮 CENT-BASED MATH ENGINE & SERIALIZATION
// ============================================================================
const toNumber = (val: any) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'bigint') return Number(val);
    if (typeof val === 'object' && typeof val.toNumber === 'function') return val.toNumber();
    const parsed = Number(val);
    return isNaN(parsed) ? 0 : parsed;
};

const safeDecimal = (val: any): Prisma.Decimal => {
    if (!val) return new Prisma.Decimal(0);
    return new Prisma.Decimal(Number(val).toFixed(2));
};

const calculateCentMath = (ht: number, vatRate: number, qty: number = 1) => {
    const totalHTCents = Math.round(ht * qty * 100);
    const totalTTCCents = Math.round(totalHTCents * (1 + vatRate));
    const totalTVACents = totalTTCCents - totalHTCents;
    
    return {
        totalHT: new Prisma.Decimal((totalHTCents / 100).toFixed(2)),
        totalTTC: new Prisma.Decimal((totalTTCCents / 100).toFixed(2)),
        totalTVA: new Prisma.Decimal((totalTVACents / 100).toFixed(2))
    };
};

const normalize = (str: string | null | undefined) => {
    if (!str) return '';
    return str.toString().trim().replace(/[\s\-\.]+/g, '').toLowerCase();
};

interface LegalClientMatch {
    id: string;
    name: string;
    ice: string | null;
    phone: string | null;
}

export const DashboardController = {

  // =========================================
  // 📈 SILO B ANALYTICS (MASTER DASHBOARD)
  // =========================================
  getInternalAnalytics: async (req: Request, res: Response) => {
      try {
          const year = Number(req.query.year) || new Date().getFullYear();
          const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
          const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

          const [products, alerts, debtAgg, movements, topClients] = await Promise.all([
              prismaInternal.productB.findMany({ select: { quantity: true, purchaseCost: true, priceTTC: true } }),
              prismaInternal.productB.findMany({ where: { quantity: { lte: 5 } }, select: { id: true, name: true, quantity: true }, take: 10 }),
              prismaInternal.clientB.aggregate({ _sum: { balance: true } }),
              prismaInternal.stockMovement.findMany({
                  where: { 
                      createdAt: { gte: startDate, lte: endDate },
                      snapshotProductName: { not: { contains: '[REPRISE DE DETTE]' } }
                  },
                  select: { createdAt: true, type: true, amount: true, quantity: true, snapshotPurchaseCost: true, snapshotProductName: true, snapshotVatRate: true, paymentMethod: true, totalHT: true, totalTVA: true }
              }),
              prismaInternal.clientB.findMany({ orderBy: { balance: 'desc' }, where: { balance: { gt: 0 } }, take: 5, select: { name: true, phone: true, balance: true } })
          ]);

          // 🧮 STRICT CENT-MATH AGGREGATION
          let stockValueCostCents = 0; let stockValuePotentialCents = 0;
          products.forEach(p => { 
              const q = toNumber(p.quantity);
              if (q > 0) {
                  stockValueCostCents += Math.round(q * toNumber(p.purchaseCost) * 100); 
                  stockValuePotentialCents += Math.round(q * toNumber(p.priceTTC) * 100); 
              }
          });

          const periodBalance = Math.max(0, toNumber(debtAgg._sum?.balance));

          // ✅ Master Analytics Architecture Aggregators (In Cents)
          let netRevenueTTCCents = 0; let netRevenueHTCents = 0; let totalCollectedTVACents = 0;
          let totalCostCents = 0; let totalRefundsCents = 0; let collectedCashCents = 0; let totalQuotesCents = 0;
          
          const monthlyStats = Array(12).fill(0).map(() => ({ revenue: 0, collected: 0, refunds: 0, quotes: 0 }));
          const productVolume = new Map<string, number>();

          movements.forEach(m => {
              const month = m.createdAt.getMonth(); 
              
              // 🛡️ THE FIX: Bulletproof Math Extractor & Schema Alignment
              const qty = Math.abs(toNumber(m.quantity));
              const rawTTC = Math.abs(toNumber(m.amount));
              let rawHT = Math.abs(toNumber(m.totalHT));
              
              if (rawHT === 0 && rawTTC > 0) {
                  const vatRate = m.snapshotVatRate !== undefined && m.snapshotVatRate !== null ? toNumber(m.snapshotVatRate) : 0.20;
                  rawHT = rawTTC / (1 + vatRate);
              }

              const amtTTCCents = Math.round(rawTTC * 100);
              const amtHTCents = Math.round(rawHT * 100);
              const amtTVACents = Math.round(Math.abs(toNumber(m.totalTVA)) * 100);
              const costCents = Math.round((qty * toNumber(m.snapshotPurchaseCost)) * 100);
              
              const t = m.type;

              if (t === 'SALE_CASH' || t === 'SALE_CREDIT') {
                  netRevenueTTCCents += amtTTCCents;
                  netRevenueHTCents += amtHTCents;
                  totalCollectedTVACents += amtTVACents;
                  totalCostCents += costCents;
                  monthlyStats[month].revenue += (amtTTCCents / 100);
                  
                  if (t === 'SALE_CASH') { collectedCashCents += amtTTCCents; monthlyStats[month].collected += (amtTTCCents / 100); }
                  if (m.snapshotProductName) productVolume.set(m.snapshotProductName, (productVolume.get(m.snapshotProductName) || 0) + qty);
              
              } else if (t === 'RETURN') {
                  totalRefundsCents += amtTTCCents;
                  netRevenueTTCCents -= amtTTCCents;
                  netRevenueHTCents -= amtHTCents;
                  totalCollectedTVACents -= amtTVACents;
                  totalCostCents -= costCents;
                  monthlyStats[month].refunds += (amtTTCCents / 100);
                  
                  if (m.paymentMethod === 'CASH' || m.paymentMethod === 'ESPECES') { collectedCashCents -= amtTTCCents; monthlyStats[month].collected -= (amtTTCCents / 100); }
              } else if (t === 'PAYMENT') {
                  collectedCashCents += amtTTCCents;
                  monthlyStats[month].collected += (amtTTCCents / 100);
              } else if (t === 'QUOTE') {
                  totalQuotesCents += amtTTCCents;
                  monthlyStats[month].quotes += (amtTTCCents / 100);
              }
          });

          const topProducts = Array.from(productVolume.entries())
              .map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 5);

          // 🛡️ ACCOUNTING FIX: Gross Margin = Net Revenue HT - Total Cost
          const grossMarginCents = netRevenueHTCents - totalCostCents;
          
          // Margin Rate uses HT as the base for accurate percentage
          const marginRate = netRevenueHTCents > 0 ? (grossMarginCents / netRevenueHTCents) * 100 : 0;

          res.json({
              metrics: {
                  revenue: {
                      totalTTC: netRevenueTTCCents / 100,
                      totalHT: netRevenueHTCents / 100,
                      totalTVA: totalCollectedTVACents / 100,
                  },
                  treasury: {
                      realCash: collectedCashCents / 100,
                      totalDue: Math.round(periodBalance * 100) / 100,
                  },
                  stockValueCost: stockValueCostCents / 100,
                  stockValuePotential: stockValuePotentialCents / 100,
                  pipeline: totalQuotesCents / 100
              },
              kpi: {
                  netRevenue: netRevenueTTCCents / 100,
                  totalCA: netRevenueTTCCents / 100,
                  grossMargin: grossMarginCents / 100,
                  marginRate: Math.round(marginRate * 10) / 10,
              },
              charts: { 
                  monthly: monthlyStats, 
                  topProducts, 
                  topClients: topClients.map(c => ({ name: c.name, phone: c.phone, total: Math.max(0, toNumber(c.balance)) })) 
              },
              alerts
          });
      } catch (error) { res.status(500).json({ error: "Erreur analytique interne" }); }
  },

  // =========================================
  // 📦 PRODUCTS & CLIENTS
  // =========================================
  getProducts: async (req: Request, res: Response) => {
    try {
      const products = await prismaInternal.productB.findMany({ orderBy: { name: 'asc' } });
      const safe = products.map(p => ({ 
          ...p, 
          purchaseCost: toNumber(p.purchaseCost), 
          priceHT: toNumber(p.priceHT),
          vatRate: toNumber(p.vatRate),
          priceTTC: toNumber(p.priceTTC),
          quantity: toNumber(p.quantity) 
      }));
      res.json(safe);
    } catch (e) { res.status(500).json({ error: "Erreur chargement produits" }); }
  },

  createProduct: async (req: Request, res: Response) => {
    try {
      const { name, internalSku, purchaseCost, priceHT, vatRate, quantity, measureUnit, technicalSpecs } = req.body;
      const qty = Number(quantity);
      if (!name || !internalSku) return res.status(400).json({ error: "Nom et SKU obligatoires" });

      const safeVat = Number(vatRate) || 0;
      const safeHT = Number(priceHT) || 0;
      const math = calculateCentMath(safeHT, safeVat, 1);

      const result = await prismaInternal.$transaction(async (tx) => {
          const product = await tx.productB.create({
            data: { 
                name, internalSku, 
                purchaseCost: safeDecimal(purchaseCost), 
                priceHT: math.totalHT, 
                vatRate: safeDecimal(safeVat), 
                priceTTC: math.totalTTC, 
                quantity: qty, 
                measureUnit: measureUnit || 'UNIT', 
                technicalSpecs 
            }
          });
          if (qty > 0) {
              await tx.stockMovement.create({ 
                  data: { 
                      productId: product.id, userId: (req as any).user?.id || null, quantity: qty, type: MovementType.RESTOCK, 
                      amount: 0, totalHT: 0, totalTVA: 0,
                      snapshotPriceHT: math.totalHT, snapshotVatRate: safeDecimal(safeVat), snapshotPriceTTC: math.totalTTC,
                      snapshotProductName: product.name 
                  } 
              });
          }
          return product;
      });
      res.json(result);
    } catch (e) { res.status(500).json({ error: "Erreur création produit" }); }
  },

  updateProduct: async (req: Request, res: Response) => {
    try {
        const { id } = req.params; 
        const { name, purchaseCost, priceHT, vatRate, measureUnit, technicalSpecs } = req.body;
        
        const safeVat = Number(vatRate) || 0;
        const safeHT = Number(priceHT) || 0;
        const math = calculateCentMath(safeHT, safeVat, 1);

        await prismaInternal.productB.update({ 
            where: { id }, 
            data: { 
                name, 
                purchaseCost: safeDecimal(purchaseCost), 
                priceHT: math.totalHT, 
                vatRate: safeDecimal(safeVat), 
                priceTTC: math.totalTTC, 
                measureUnit, 
                technicalSpecs 
            } 
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erreur mise à jour" }); }
  },

  deleteProduct: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const count = await prismaInternal.stockMovement.count({ where: { productId: id } });
          
          if (count > 0) {
              return res.status(400).json({ 
                  error: `Refusé : Ce produit est lié à ${count} transaction(s) dans l'historique. Pour préserver l'analytique Master, renommez-le (ex: [OBSOLÈTE]) et mettez son stock à 0.` 
              });
          }
          
          await prismaInternal.productB.delete({ where: { id } });
          res.json({ success: true });
      } catch (e) { 
          console.error("Delete Product Error:", e);
          res.status(500).json({ error: "Erreur suppression" }); 
      }
  },

  getClients: async (req: Request, res: Response) => {
      try {
          const clientsB = await prismaInternal.clientB.findMany({ orderBy: { updatedAt: 'desc' }, take: 100 });
          const clientsA = await prismaLegal.clientA.findMany({ select: { id: true, name: true, ice: true, phone: true } });
          
          const enhancedClients = clientsB.map(cb => {
              const b_ice = normalize(cb.ice); 
              const b_phone = normalize(cb.phone); 
              const b_name = normalize(cb.name);

              const match = clientsA.find((ca: LegalClientMatch) => 
                (b_ice.length > 3 && b_ice === normalize(ca.ice)) || 
                (b_phone.length > 6 && b_phone === normalize(ca.phone)) || 
                (b_name.length > 3 && b_name === normalize(ca.name))
              );

              return { 
                ...cb, 
                balance: toNumber(cb.balance), 
                totalSpent: toNumber(cb.totalSpent), 
                linkedLegalId: match ? match.id : null, 
                linkedLegalName: match ? match.name : null 
              };
          });
          res.json(enhancedClients);
      } catch (e) { res.status(500).json({ error: "Erreur chargement clients" }); }
  },

  createClient: async (req: Request, res: Response) => {
    try {
         const { name, ice, address, city, phone, syncToLegal } = req.body;
         if (!name) return res.status(400).json({ error: "Nom obligatoire" });
         const clientB = await prismaInternal.clientB.create({ data: { name, ice, address, city, phone, balance: 0, totalSpent: 0 } });
         if (syncToLegal) await prismaLegal.clientA.create({ data: { id: clientB.id, name, ice, address, city, phone } }).catch(() => console.log("Legal sync skipped"));
         res.json(clientB);
     } catch (e) { res.status(500).json({ error: "Erreur création client" }); }
  },
  
  updateClient: async (req: Request, res: Response) => {
    try {
        const { id } = req.params; const { name, ice, address, city, phone } = req.body;
        await prismaInternal.clientB.update({ where: { id }, data: { name, ice, address, city, phone } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erreur mise à jour client" }); }
  },

  deleteClient: async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const client = await prismaInternal.clientB.findUnique({ where: { id } });
        if (client && Math.abs(toNumber(client.balance)) > 0.1) return res.status(400).json({ error: "Impossible de supprimer: Solde non nul." });
        await prismaInternal.clientB.delete({ where: { id } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erreur suppression client" }); }
  },
  
  getGlobalClientDetails: async (req: Request, res: Response) => {
     try {
         const { id } = req.params; 
         const clientB = await prismaInternal.clientB.findUnique({ where: { id } });
         if (!clientB) return res.status(404).json({ error: "Client introuvable" });
         const movements = await prismaInternal.stockMovement.findMany({ where: { clientId: id }, take: 10 });
         res.json({ profile: { ...clientB, balance: toNumber(clientB.balance) }, history: movements.map(m => ({ ...m, amount: toNumber(m.amount), quantity: toNumber(m.quantity) })) });
     } catch (e) { res.status(500).json({ error: "Erreur client global" }); }
  },
  
  getClientStatement: async (req: Request, res: Response) => {
      try {
          const { clientId } = req.params;
          const client = await prismaInternal.clientB.findUnique({ where: { id: clientId } });
          if (!client) return res.status(404).json({ error: "Client introuvable" });
          const allMovements = await prismaInternal.stockMovement.findMany({ where: { clientId, type: { in: [MovementType.SALE_CASH, MovementType.RETURN, MovementType.PAYMENT] } }, orderBy: { createdAt: 'asc' } });
          const history = allMovements.map(m => {
              const isSale = m.type === MovementType.SALE_CASH; const isReturn = m.type === MovementType.RETURN; const isPayment = m.type === MovementType.PAYMENT;
              return { date: m.createdAt, type: isSale ? 'VENTE' : isReturn ? 'RETOUR' : 'PAIEMENT', ref: m.type === MovementType.PAYMENT ? `Reglement: ${m.paymentMethod}` : (m.snapshotProductName || 'Article'), debit: isSale ? toNumber(m.amount) : 0, credit: isPayment || isReturn ? Math.abs(toNumber(m.amount)) : 0, note: m.snapshotProductName };
          });
          let runningBalance = 0;
          const statement = history.map(item => { runningBalance = (runningBalance - item.credit) + item.debit; return { ...item, balance: runningBalance }; });
          res.json({ client, statement, finalBalance: runningBalance });
      } catch (error) { res.status(500).json({ error: "Erreur génération relevé" }); }
  },

  getHistory: async (req: Request, res: Response) => {
    try {
        const movements = await prismaInternal.stockMovement.findMany({ 
            take: 100, 
            orderBy: { createdAt: 'desc' }, 
            include: { product: true, client: true } 
        });

        const grouped = movements.reduce((acc: any[], m) => {
            const groupKey = m.batchId || m.id;
            let doc = acc.find(d => d.id === groupKey);

            if (!doc) {
                acc.push({
                    id: groupKey,
                    displayId: m.id.substring(0,8).toUpperCase(),
                    type: m.type,
                    productName: m.snapshotProductName || m.product?.name || "Inconnu",
                    clientName: m.client?.name || "-",
                    quantity: toNumber(m.quantity),
                    amount: toNumber(m.amount),
                    date: m.createdAt,
                    itemCount: 1
                });
            } else {
                doc.amount += toNumber(m.amount);
                doc.itemCount += 1;
            }
            return acc;
        }, []).slice(0, 50);

        res.json(grouped);
    } catch (error) { res.status(500).json({ error: "Erreur historique" }); }
  },

  createTransaction: async (req: Request, res: Response) => {
     try {
         const { productId, userId, quantity, type, clientId, paymentMethod } = req.body;
         const qty = Number(quantity);
         await prismaInternal.$transaction(async (tx) => {
             const product = await tx.productB.findUnique({ where: { id: productId } });
             if (!product) throw new Error("Produit introuvable");
             
             const math = calculateCentMath(toNumber(product.priceHT), toNumber(product.vatRate), qty);
             const amount = math.totalTTC.toNumber();
             
             let increment = 0;
             if (type === MovementType.SALE_CASH) increment = -qty;
             else if (type === MovementType.RETURN) increment = qty;
             
             if (increment !== 0) {
                 if (increment < 0 && toNumber(product.quantity) < qty) throw new Error("Stock insuffisant");
                 await tx.productB.update({ where: { id: productId }, data: { quantity: { increment } } });
             }

             if (clientId) {
                 await tx.clientB.update({ where: { id: clientId }, data: { totalSpent: { increment: amount }, balance: { increment: paymentMethod === 'CREDIT' ? amount : 0 } } });
             }

             await tx.stockMovement.create({
                 data: { 
                     productId, userId: userId || null, clientId: clientId || null, quantity: qty, type, paymentMethod: paymentMethod || 'CASH', 
                     amount: math.totalTTC, 
                     totalHT: math.totalHT, 
                     totalTVA: math.totalTVA,
                     snapshotProductName: product.name, 
                     snapshotPriceHT: product.priceHT,
                     snapshotVatRate: product.vatRate,
                     snapshotPriceTTC: product.priceTTC,
                     snapshotPurchaseCost: product.purchaseCost 
                 }
             });
         });
         res.json({ success: true });
     } catch (e: any) { res.status(400).json({ error: e.message }); }
  },

  createPayment: async (req: Request, res: Response) => {
     try {
         const { clientId, amount, method, reference, note, userId } = req.body;
         await prismaInternal.$transaction(async (tx) => {
             const anyProduct = await tx.productB.findFirst();
             if (!anyProduct) throw new Error("Veuillez créer au moins un produit pour enregistrer un paiement.");
             await tx.stockMovement.create({
                 data: { 
                     type: MovementType.PAYMENT, clientId, amount: new Prisma.Decimal(amount).neg(), quantity: 0, 
                     paymentMethod: method, paymentRef: reference, snapshotProductName: note || "Paiement", 
                     userId: userId || null, productId: anyProduct.id,
                     totalHT: new Prisma.Decimal(0), totalTVA: new Prisma.Decimal(0) 
                 }
             });
             await tx.clientB.update({ where: { id: clientId }, data: { balance: { decrement: toNumber(amount) } } });
         });
         res.json({ success: true });
     } catch (e) { res.status(500).json({ error: "Erreur paiement" }); }
  },

  getDailyTill: async (req: Request, res: Response) => {
      try {
          const dateParam = req.query.date as string;
          if (!dateParam) return res.status(400).json({ error: "Date requise" });

          // Establish strict UTC day boundaries for the query
          const startDate = new Date(`${dateParam}T00:00:00.000Z`);
          const endDate = new Date(`${dateParam}T23:59:59.999Z`);

          const movements = await prismaInternal.stockMovement.findMany({
              where: {
                  createdAt: { gte: startDate, lte: endDate },
                  // ONLY track physical cash movements
                  paymentMethod: { in: ['CASH', 'ESPÈCES', 'ESPECES'] }
              }
          });

          // 🧮 STRICT CENT-MATH ENGINE
          let salesCents = 0;
          let clientPaymentsCents = 0;
          let supplierPaymentsCents = 0;
          let returnsCents = 0;
          let refundsCents = 0; // Cash returned to us from voided supplier purchases

          movements.forEach(m => {
              // 🛡️ SECURITY FIX: Use safe toNumber() helper to prevent null crashes
              const amountCents = Math.round(Math.abs(toNumber(m.amount)) * 100);

              // 🛡️ SECURITY FIX: Removed invalid 'SALE' enum
              if (m.type === 'SALE_CASH') {
                  salesCents += amountCents; // (+) Inflow
              } else if (m.type === 'RETURN') {
                  returnsCents += amountCents; // (-) Outflow to client
              } else if (m.type === 'PAYMENT') {
                  if (m.clientId) clientPaymentsCents += amountCents; // (+) Inflow from client debt
                  else if (m.supplierId) supplierPaymentsCents += amountCents; // (-) Outflow to supplier
              } else if (m.type === 'ADJUSTMENT' && m.supplierId && toNumber(m.amount) > 0) {
                  refundsCents += amountCents; // (+) Inflow from voided purchase
              }
          });

          // 🧮 WATERFALL CALCULATION
          const expectedCents = (salesCents + clientPaymentsCents + refundsCents) - (returnsCents + supplierPaymentsCents);

          res.json({
              sales: salesCents / 100,
              clientPayments: clientPaymentsCents / 100,
              supplierPayments: supplierPaymentsCents / 100,
              returns: returnsCents / 100,
              refunds: refundsCents / 100,
              expectedTotal: expectedCents / 100
          });
      } catch (error) {
          console.error("Z-Report Error:", error);
          res.status(500).json({ error: "Erreur calcul caisse" });
      }
  }
};