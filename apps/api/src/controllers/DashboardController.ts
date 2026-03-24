// apps/api/src/controllers/DashboardController.ts
import { Request, Response } from 'express';
import { prismaInternal, MovementType, Prisma } from '@marine/db-internal'; 
import { prismaLegal } from '@marine/db-legal';

// 🛡️ SERIALIZATION HELPER
const toNumber = (val: any) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'bigint') return Number(val);
    if (typeof val === 'object' && typeof val.toNumber === 'function') return val.toNumber();
    const parsed = Number(val);
    return isNaN(parsed) ? 0 : parsed;
};

const normalize = (str: string | null | undefined) => {
    if (!str) return '';
    return str.toString().trim().replace(/[\s\-\.]+/g, '').toLowerCase();
};

export const DashboardController = {

  // =========================================
  // 📈 SILO B ANALYTICS (EXECUTIVE DASHBOARD)
  // =========================================
  getInternalAnalytics: async (req: Request, res: Response) => {
      try {
          const year = Number(req.query.year) || new Date().getFullYear();
          const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
          const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

          const [products, alerts, debtAgg, movements, topClients] = await Promise.all([
              prismaInternal.productB.findMany({ select: { quantity: true, purchaseCost: true, sellingPrice: true } }),
              prismaInternal.productB.findMany({ where: { quantity: { lte: 5 } }, select: { id: true, name: true, quantity: true }, take: 10 }),
              prismaInternal.clientB.aggregate({ _sum: { balance: true } }),
              prismaInternal.stockMovement.findMany({
                  where: { createdAt: { gte: startDate, lte: endDate } },
                  select: { createdAt: true, type: true, amount: true, quantity: true, snapshotPurchaseCost: true, snapshotProductName: true, paymentMethod: true }
              }),
              // ✅ FIXED: Added `phone: true` to the selection
              prismaInternal.clientB.findMany({ orderBy: { balance: 'desc' }, where: { balance: { gt: 0 } }, take: 5, select: { name: true, phone: true, balance: true } })
          ]);

          let stockValue = 0; let stockPotential = 0;
          products.forEach(p => { 
              const q = toNumber(p.quantity);
              if (q > 0) {
                  stockValue += (q * toNumber(p.purchaseCost)); 
                  stockPotential += (q * toNumber(p.sellingPrice));
              }
          });

          const periodBalance = toNumber(debtAgg._sum?.balance);

          let netRevenue = 0; let totalCost = 0; let totalRefunds = 0; let collectedCash = 0; let totalQuotes = 0;
          const monthlyStats = Array(12).fill(0).map(() => ({ revenue: 0, collected: 0, refunds: 0, quotes: 0 }));
          const productVolume = new Map<string, number>();

          movements.forEach(m => {
              const month = m.createdAt.getMonth(); 
              const amt = Math.abs(toNumber(m.amount));
              const cost = toNumber(m.quantity) * toNumber(m.snapshotPurchaseCost);
              const t = m.type;

              if (t === 'SALE_CASH' || t === 'SALE_CREDIT') {
                  netRevenue += amt;
                  totalCost += cost;
                  monthlyStats[month].revenue += amt;
                  if (t === 'SALE_CASH') { collectedCash += amt; monthlyStats[month].collected += amt; }
                  if (m.snapshotProductName) productVolume.set(m.snapshotProductName, (productVolume.get(m.snapshotProductName) || 0) + toNumber(m.quantity));
              } else if (t === 'RETURN') {
                  totalRefunds += amt;
                  totalCost -= cost;
                  monthlyStats[month].refunds += amt;
                  if (m.paymentMethod === 'CASH') { collectedCash -= amt; monthlyStats[month].collected -= amt; }
              } else if (t === 'PAYMENT') {
                  collectedCash += amt;
                  monthlyStats[month].collected += amt;
              } else if (t === 'QUOTE') {
                  totalQuotes += amt;
                  monthlyStats[month].quotes += amt;
              }
          });

          const topProducts = Array.from(productVolume.entries())
              .map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 5);

          const grossMargin = netRevenue - totalCost;
          const marginRate = netRevenue > 0 ? (grossMargin / netRevenue) * 100 : 0;

          res.json({
              kpi: {
                  netRevenue: Math.round(netRevenue * 100) / 100,
                  grossMargin: Math.round(grossMargin * 100) / 100,
                  marginRate: Math.round(marginRate * 10) / 10,
                  totalRefunds: Math.round(totalRefunds * 100) / 100,
                  collectedCash: Math.round(collectedCash * 100) / 100,
                  periodBalance: Math.round(periodBalance * 100) / 100,
                  stockValue: Math.round(stockValue * 100) / 100,
                  stockPotential: Math.round(stockPotential * 100) / 100,
                  totalQuotes: Math.round(totalQuotes * 100) / 100
              },
              charts: { 
                  monthly: monthlyStats, 
                  topProducts, 
                  // ✅ FIXED: Added `phone` to the JSON mapping
                  topClients: topClients.map(c => ({ name: c.name, phone: c.phone, total: toNumber(c.balance) })) 
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
      const safe = products.map(p => ({ ...p, purchaseCost: toNumber(p.purchaseCost), sellingPrice: toNumber(p.sellingPrice), quantity: toNumber(p.quantity) }));
      res.json(safe);
    } catch (e) { res.status(500).json({ error: "Erreur chargement produits" }); }
  },

  createProduct: async (req: Request, res: Response) => {
    try {
      const { name, internalSku, purchaseCost, sellingPrice, quantity, measureUnit, technicalSpecs } = req.body;
      const qty = Number(quantity);
      if (!name || !internalSku) return res.status(400).json({ error: "Nom et SKU obligatoires" });

      const result = await prismaInternal.$transaction(async (tx) => {
          const product = await tx.productB.create({
            data: { name, internalSku, purchaseCost: toNumber(purchaseCost), sellingPrice: toNumber(sellingPrice), quantity: qty, measureUnit: measureUnit || 'UNIT', technicalSpecs }
          });
          if (qty > 0) await tx.stockMovement.create({ data: { productId: product.id, userId: (req as any).user?.id || null, quantity: qty, type: MovementType.RESTOCK, amount: 0, snapshotProductName: product.name } });
          return product;
      });
      res.json(result);
    } catch (e) { res.status(500).json({ error: "Erreur création produit" }); }
  },

  updateProduct: async (req: Request, res: Response) => {
    try {
        const { id } = req.params; const { name, purchaseCost, sellingPrice, measureUnit, technicalSpecs } = req.body;
        await prismaInternal.productB.update({ where: { id }, data: { name, purchaseCost: toNumber(purchaseCost), sellingPrice: toNumber(sellingPrice), measureUnit, technicalSpecs } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erreur mise à jour" }); }
  },

  deleteProduct: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const count = await prismaInternal.stockMovement.count({ where: { productId: id } });
          if (count > 0) return res.status(400).json({ error: "Impossible de supprimer : Produit a un historique." });
          await prismaInternal.productB.delete({ where: { id } });
          res.json({ success: true });
      } catch (e) { res.status(500).json({ error: "Erreur suppression" }); }
  },

  getClients: async (req: Request, res: Response) => {
      try {
          const clientsB = await prismaInternal.clientB.findMany({ orderBy: { updatedAt: 'desc' }, take: 100 });
          const clientsA = await prismaLegal.clientA.findMany({ select: { id: true, name: true, ice: true, phone: true } });
          const enhancedClients = clientsB.map(cb => {
              const b_ice = normalize(cb.ice); const b_phone = normalize(cb.phone); const b_name = normalize(cb.name);
              const match = clientsA.find(ca => (b_ice.length > 3 && b_ice === normalize(ca.ice)) || (b_phone.length > 6 && b_phone === normalize(ca.phone)) || (b_name.length > 3 && b_name === normalize(ca.name)));
              return { ...cb, balance: toNumber(cb.balance), totalSpent: toNumber(cb.totalSpent), linkedLegalId: match ? match.id : null, linkedLegalName: match ? match.name : null };
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
        const movements = await prismaInternal.stockMovement.findMany({ take: 50, orderBy: { createdAt: 'desc' }, include: { product: true, client: true } });
        const formatted = movements.map(m => ({ id: m.id, type: m.type, productName: m.snapshotProductName || m.product?.name || "Inconnu", clientName: m.client?.name || "-", quantity: toNumber(m.quantity), amount: toNumber(m.amount), date: m.createdAt }));
        res.json(formatted);
    } catch (error) { res.status(500).json({ error: "Erreur historique" }); }
  },

  createTransaction: async (req: Request, res: Response) => {
     try {
         const { productId, userId, quantity, type, clientId, paymentMethod } = req.body;
         const qty = Number(quantity);
         await prismaInternal.$transaction(async (tx) => {
             const product = await tx.productB.findUnique({ where: { id: productId } });
             if (!product) throw new Error("Produit introuvable");
             const amount = toNumber(product.sellingPrice) * qty;
             
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
                 data: { productId, userId: userId || null, clientId: clientId || null, quantity: qty, type, paymentMethod: paymentMethod || 'CASH', amount, snapshotProductName: product.name, snapshotSellingPrice: toNumber(product.sellingPrice), snapshotPurchaseCost: toNumber(product.purchaseCost) }
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
                 data: { type: MovementType.PAYMENT, clientId, amount: new Prisma.Decimal(amount).neg(), quantity: 0, paymentMethod: method, paymentRef: reference, snapshotProductName: note || "Paiement", userId: userId || null, productId: anyProduct.id }
             });
             await tx.clientB.update({ where: { id: clientId }, data: { balance: { decrement: toNumber(amount) } } });
         });
         res.json({ success: true });
     } catch (e) { res.status(500).json({ error: "Erreur paiement" }); }
  }
};