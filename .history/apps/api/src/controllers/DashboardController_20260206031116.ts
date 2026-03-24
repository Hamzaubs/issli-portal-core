import { Request, Response } from 'express';
import { prismaInternal, MovementType } from '@marine/db-internal'; 
import { prismaLegal } from '@marine/db-legal';

// 🛡️ SERIALIZATION HELPER (Big Data Safe)
const toNumber = (val: any) => {
    if (!val) return 0;
    return Number(val);
};

// 🔧 STRING NORMALIZER (For Fuzzy Matching Clients)
const normalize = (str: string | null | undefined) => {
    if (!str) return '';
    return str.toString().trim().replace(/[\s\-\.]+/g, '').toLowerCase();
};

export const DashboardController = {

  // =========================================
  // 📊 GLOBAL ANALYTICS (EXECUTIVE VIEW)
  // =========================================
  getGlobalStats: async (req: Request, res: Response) => {
      try {
          const { from, to } = req.query;
          const now = new Date();
          
          const startDate = from 
            ? new Date(from as string) 
            : new Date(now.getFullYear(), now.getMonth(), 1);
          
          const endDate = to 
            ? new Date(`${to}T23:59:59.999Z`) 
            : new Date(`${now.toISOString().split('T')[0]}T23:59:59.999Z`);

          // 

          // --- [A] FLOW METRICS (Revenue & Margin within Date Range) ---
          const invoicesA = await prismaLegal.invoice.findMany({
              where: {
                  issuedAt: { gte: startDate, lte: endDate },
                  status: { not: 'ANNULEE' }
              },
              include: { items: true }
          });

          const movementsB = await prismaInternal.stockMovement.findMany({
              where: {
                  createdAt: { gte: startDate, lte: endDate },
                  type: { in: [MovementType.SALE_CASH, MovementType.RETURN] }
              }
          });

          let caLegal = 0;
          let marginLegal = 0;
          let caCash = 0;
          let marginCash = 0;
          let salesCount = 0;

          // Process A (Legal)
          invoicesA.forEach(inv => {
              const isCredit = inv.type === 'AVOIR';
              const factor = isCredit ? -1 : 1;
              const totalHT = toNumber(inv.totalHT);
              caLegal += (totalHT * factor);
              if (!isCredit) salesCount++;

              let invCost = 0;
              inv.items.forEach(item => {
                  invCost += (toNumber(item.unitPurchaseCostSnapshot) * item.quantity);
              });
              marginLegal += ((totalHT - invCost) * factor);
          });

          // Process B (Internal)
          movementsB.forEach(mov => {
              const isReturn = mov.type === MovementType.RETURN;
              const factor = isReturn ? -1 : 1;
              const amount = toNumber(mov.amount);
              caCash += (amount * factor);
              if (!isReturn) salesCount++;

              const cost = toNumber(mov.snapshotPurchaseCost) * mov.quantity;
              marginCash += ((amount - cost) * factor);
          });

          // --- [B] SNAPSHOT METRICS (Current State) ---
          const [productsA, productsB] = await Promise.all([
              prismaLegal.productA.findMany({ select: { purchaseCost: true, quantity: true } }),
              prismaInternal.productB.findMany({ select: { purchaseCost: true, quantity: true } })
          ]);

          const valueStockA = productsA.reduce((acc, p) => acc + (toNumber(p.purchaseCost) * p.quantity), 0);
          const valueStockB = productsB.reduce((acc, p) => acc + (toNumber(p.purchaseCost) * p.quantity), 0);

          // Treasury B
          const [cashSales, cashPayments, cashReturns] = await Promise.all([
              prismaInternal.stockMovement.aggregate({ where: { type: MovementType.SALE_CASH, paymentMethod: 'CASH' }, _sum: { amount: true } }),
              prismaInternal.clientPayment.aggregate({ where: { method: 'ESPECES' }, _sum: { amount: true } }),
              prismaInternal.stockMovement.aggregate({ where: { type: MovementType.RETURN, paymentMethod: 'CASH' }, _sum: { amount: true } })
          ]);

          const realCash = (toNumber(cashSales._sum.amount) + toNumber(cashPayments._sum.amount)) - toNumber(cashReturns._sum.amount);
          const checksOnHand = await prismaInternal.clientPayment.aggregate({ where: { method: 'CHEQUE' }, _sum: { amount: true } });
          const totalDebtsB = await prismaInternal.clientB.aggregate({ _sum: { balance: true } });

          // --- [C] CHART DATA ---
          const daysMap = new Map<string, any>();
          const getDay = (d: Date) => d.toISOString().split('T')[0];
          
          invoicesA.forEach(inv => {
              const day = getDay(inv.issuedAt);
              if (!daysMap.has(day)) daysMap.set(day, { date: day, legal: 0, internalSales: 0, internalRefunds: 0 });
              const val = toNumber(inv.totalHT);
              const node = daysMap.get(day);
              if (inv.type === 'AVOIR') node.legal -= val; else node.legal += val;
          });

          movementsB.forEach(mov => {
              const day = getDay(mov.createdAt);
              if (!daysMap.has(day)) daysMap.set(day, { date: day, legal: 0, internalSales: 0, internalRefunds: 0 });
              const val = toNumber(mov.amount);
              const node = daysMap.get(day);
              if (mov.type === MovementType.RETURN) node.internalRefunds += val; else node.internalSales += val;
          });

          const charts = Array.from(daysMap.values()).sort((a, b) => a.date.localeCompare(b.date));

          res.json({
              metrics: {
                  totalCA: caLegal + caCash,
                  salesCount,
                  totalProfits: marginLegal + marginCash,
                  stockValue: valueStockA + valueStockB,
                  split: { legal: caLegal, cash: caCash, stockA: valueStockA, stockB: valueStockB },
                  treasury: {
                      realCash: realCash,
                      checks: toNumber(checksOnHand._sum.amount),
                      totalDue: toNumber(totalDebtsB._sum.balance)
                  }
              },
              charts
          });
      } catch (error) {
          console.error("Dashboard Stats Error:", error);
          res.status(500).json({ error: "Erreur calcul statistiques globales" });
      }
  },

  // =========================================
  // 📦 PRODUCTS (Silo B Management)
  // =========================================
  getProducts: async (req: Request, res: Response) => {
    try {
      const products = await prismaInternal.productB.findMany({ orderBy: { name: 'asc' } });
      const safe = products.map(p => ({
          ...p,
          purchaseCost: toNumber(p.purchaseCost),
          sellingPrice: toNumber(p.sellingPrice)
      }));
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
            data: { 
                name, internalSku, 
                purchaseCost: toNumber(purchaseCost), 
                sellingPrice: toNumber(sellingPrice), 
                quantity: qty, 
                measureUnit: measureUnit || 'UNIT', 
                technicalSpecs 
            }
          });
          if (qty > 0) {
              await tx.stockMovement.create({
                  data: { 
                      productId: product.id, 
                      userId: (req as any).user?.id || null,
                      quantity: qty, 
                      type: MovementType.RESTOCK, 
                      amount: 0, 
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
        const { name, purchaseCost, sellingPrice, measureUnit, technicalSpecs } = req.body;
        await prismaInternal.productB.update({
            where: { id },
            data: { name, purchaseCost: toNumber(purchaseCost), sellingPrice: toNumber(sellingPrice), measureUnit, technicalSpecs }
        });
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

  // =========================================
  // 👥 CLIENTS & INTERCONNECTION
  // =========================================
  getClients: async (req: Request, res: Response) => {
      try {
          const clientsB = await prismaInternal.clientB.findMany({ orderBy: { updatedAt: 'desc' }, take: 100 });
          const clientsA = await prismaLegal.clientA.findMany({ select: { id: true, name: true, ice: true, phone: true } });

          const enhancedClients = clientsB.map(cb => {
              const b_ice = normalize(cb.ice);
              const b_phone = normalize(cb.phone);
              const b_name = normalize(cb.name);

              const match = clientsA.find(ca => {
                  const a_ice = normalize(ca.ice);
                  const a_phone = normalize(ca.phone);
                  const a_name = normalize(ca.name);
                  if (b_ice.length > 3 && b_ice === a_ice) return true;
                  if (b_phone.length > 6 && b_phone === a_phone) return true;
                  if (b_name.length > 3 && b_name === a_name) return true;
                  return false;
              });

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
         
         const clientB = await prismaInternal.clientB.create({
             data: { name, ice, address, city, phone, balance: 0, totalSpent: 0 }
         });

         if (syncToLegal) {
             await prismaLegal.clientA.create({
                 data: { id: clientB.id, name, ice, address, city, phone }
             }).catch(() => console.log("Legal sync skipped (duplicate?)"));
         }
         res.json(clientB);
     } catch (e) { res.status(500).json({ error: "Erreur création client" }); }
  },
  
  updateClient: async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, ice, address, city, phone } = req.body;
        await prismaInternal.clientB.update({
            where: { id },
            data: { name, ice, address, city, phone }
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erreur mise à jour client" }); }
  },

  deleteClient: async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const client = await prismaInternal.clientB.findUnique({ where: { id } });
        if (client && Math.abs(toNumber(client.balance)) > 0.1) {
            return res.status(400).json({ error: "Impossible de supprimer: Solde non nul." });
        }
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
         
         res.json({ 
             profile: { ...clientB, balance: toNumber(clientB.balance) },
             history: movements
         });
     } catch (e) { res.status(500).json({ error: "Erreur client global" }); }
  },
  
  // 📝 STATEMENT (Relevé de Compte)
  getClientStatement: async (req: Request, res: Response) => {
      try {
          const { clientId } = req.params;
          const client = await prismaInternal.clientB.findUnique({ where: { id: clientId } });
          if (!client) return res.status(404).json({ error: "Client introuvable" });

          const sales = await prismaInternal.stockMovement.findMany({
              where: { clientId, type: { in: [MovementType.SALE_CASH, MovementType.RETURN] } },
              orderBy: { createdAt: 'asc' }
          });

          const payments = await prismaInternal.clientPayment.findMany({
              where: { clientId },
              orderBy: { createdAt: 'asc' }
          });

          const history = [
              ...sales.map(s => ({
                  date: s.createdAt,
                  type: s.type === MovementType.SALE_CASH ? 'VENTE' : 'RETOUR',
                  ref: s.snapshotProductName || 'Article',
                  debit: s.type === MovementType.SALE_CASH ? toNumber(s.amount) : 0,
                  credit: s.type === MovementType.RETURN ? toNumber(s.amount) : 0,
                  note: s.paymentMethod
              })),
              ...payments.map(p => ({
                  date: p.createdAt,
                  type: 'PAIEMENT',
                  ref: `Reglement: ${p.method}`,
                  debit: 0,
                  credit: toNumber(p.amount),
                  note: p.note
              }))
          ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          let runningBalance = 0;
          const statement = history.map(item => {
              runningBalance = (runningBalance - item.credit) + item.debit;
              return { ...item, balance: runningBalance };
          });

          res.json({ client, statement, finalBalance: runningBalance });
      } catch (error) { res.status(500).json({ error: "Erreur génération relevé" }); }
  },

  // 📝 GENERAL HISTORY
  getHistory: async (req: Request, res: Response) => {
    try {
        const movements = await prismaInternal.stockMovement.findMany({
            take: 50,
            orderBy: { createdAt: 'desc' },
            include: { product: true, client: true }
        });
        
        const formatted = movements.map(m => ({
            id: m.id, type: m.type,
            productName: m.snapshotProductName || m.product?.name || "Inconnu",
            clientName: m.client?.name || "-", 
            quantity: m.quantity,
            amount: toNumber(m.amount),
            date: m.createdAt
        }));
        res.json(formatted);
    } catch (error) { res.status(500).json({ error: "Erreur historique" }); }
  },

  // 💸 TRANSACTIONS & PAYMENTS
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
                 if (increment < 0 && product.quantity < qty) throw new Error("Stock insuffisant");
                 await tx.productB.update({ where: { id: productId }, data: { quantity: { increment } } });
             }

             if (clientId) {
                 await tx.clientB.update({
                     where: { id: clientId },
                     data: { totalSpent: { increment: amount }, balance: { increment: paymentMethod === 'CREDIT' ? amount : 0 } }
                 });
             }

             await tx.stockMovement.create({
                 data: {
                     productId, userId: userId || null, clientId: clientId || null,
                     quantity: qty, type, paymentMethod: paymentMethod || 'CASH',
                     amount, snapshotProductName: product.name,
                     snapshotSellingPrice: product.sellingPrice,
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
             await tx.clientPayment.create({
                 data: { clientId, amount: toNumber(amount), method, reference, note, userId: userId || null }
             });
             await tx.clientB.update({
                 where: { id: clientId },
                 data: { balance: { decrement: toNumber(amount) } }
             });
         });
         res.json({ success: true });
     } catch (e) { res.status(500).json({ error: "Erreur paiement" }); }
  }
};