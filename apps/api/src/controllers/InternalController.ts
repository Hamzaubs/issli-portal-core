// apps/api/src/controllers/InternalController.ts
import { Request, Response } from 'express';
import { prismaInternal, MovementType, Prisma } from '@marine/db-internal';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// 🧮 CENT-BASED MATH ENGINE (Zero Floating-Point Drift)
// ============================================================================
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

export const InternalController = {
  
  // ====================================================
  // 📦 1. PRODUCT CRUD 
  // ====================================================
  getProducts: async (req: Request, res: Response) => {
    try {
      const products = await prismaInternal.productB.findMany({ 
        orderBy: { name: 'asc' },
        include: { _count: { select: { movements: true } } } 
      });
      const safeResponse = products.map(p => ({
          ...p,
          purchaseCost: p.purchaseCost.toNumber(),
          priceHT: p.priceHT.toNumber(),
          vatRate: p.vatRate.toNumber(),
          priceTTC: p.priceTTC.toNumber(), 
      }));
      res.json(safeResponse);
    } catch (e) { res.status(500).json({ error: "Erreur chargement stock" }); }
  },
  
  createProduct: async (req: Request, res: Response) => {
      try {
          const { name, internalSku, purchaseCost, priceHT, vatRate, quantity, measureUnit, technicalSpecs } = req.body;
          if (!internalSku || !name) return res.status(400).json({error: "Nom et SKU requis"});
          
          const safeVatRate = Number(vatRate) || 0;
          const safePriceHT = Number(priceHT) || 0;
          const math = calculateCentMath(safePriceHT, safeVatRate, 1);

          const product = await prismaInternal.productB.create({
              data: { 
                  name, internalSku, 
                  purchaseCost: safeDecimal(purchaseCost), 
                  priceHT: math.totalHT, 
                  vatRate: safeDecimal(safeVatRate),
                  priceTTC: math.totalTTC, 
                  quantity: Number(quantity) || 0, 
                  measureUnit: measureUnit || 'UNIT', 
                  technicalSpecs 
              }
          });
          res.json(product);
      } catch (e: any) { 
          if (e.code === 'P2002') return res.status(400).json({ error: "Ce SKU existe déjà." });
          res.status(500).json({ error: "Erreur création produit" }); 
      }
  },
  
  updateProduct: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const { name, purchaseCost, priceHT, vatRate, quantity, measureUnit, technicalSpecs } = req.body;
          
          const safeVatRate = Number(vatRate) || 0;
          const safePriceHT = Number(priceHT) || 0;
          const math = calculateCentMath(safePriceHT, safeVatRate, 1);

          await prismaInternal.productB.update({ 
              where: { id }, 
              data: { 
                name, purchaseCost: safeDecimal(purchaseCost), 
                priceHT: math.totalHT, vatRate: safeDecimal(safeVatRate), priceTTC: math.totalTTC, 
                quantity: Number(quantity), measureUnit, technicalSpecs 
              } 
          });
          res.json({ success: true });
      } catch (e) { res.status(500).json({ error: "Erreur mise à jour" }); }
  },
  
  deleteProduct: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const historyCount = await prismaInternal.stockMovement.count({ where: { productId: id } });

          if (historyCount > 0) {
              return res.status(400).json({ 
                  error: `Refusé : Ce produit est lié à ${historyCount} transaction(s). Pour préserver l'analytique globale, renommez-le (ex: [OBSOLÈTE]) et mettez son stock à 0.` 
              });
          }
          await prismaInternal.productB.delete({ where: { id } });
          res.json({ success: true });
      } catch (e: any) { res.status(500).json({ error: "Erreur serveur lors de la suppression." }); }
  },

  importBatchProducts: async (req: Request, res: Response) => {
      try {
          const { products } = req.body;
          if (!products || !Array.isArray(products) || products.length === 0) {
              return res.status(400).json({ error: "Données invalides ou vides." });
          }

          const upsertOperations = products.map((item: any) => {
              if (!item.internalSku || !item.name) throw new Error(`Produit sans nom ou SKU détecté.`);
              const math = calculateCentMath(Number(item.priceHT) || 0, Number(item.vatRate) || 0, 1);

              return prismaInternal.productB.upsert({
                  where: { internalSku: item.internalSku },
                  update: {
                      name: item.name, purchaseCost: safeDecimal(item.purchaseCost),
                      priceHT: math.totalHT, vatRate: safeDecimal(Number(item.vatRate) || 0), priceTTC: math.totalTTC,
                      quantity: Number(item.quantity) || 0, measureUnit: item.measureUnit || 'UNIT',
                  },
                  create: {
                      name: item.name, internalSku: item.internalSku, purchaseCost: safeDecimal(item.purchaseCost),
                      priceHT: math.totalHT, vatRate: safeDecimal(Number(item.vatRate) || 0), priceTTC: math.totalTTC,
                      quantity: Number(item.quantity) || 0, measureUnit: item.measureUnit || 'UNIT',
                  }
              });
          });

          await prismaInternal.$transaction(upsertOperations);
          res.json({ success: products.length, message: "Importation ACID réussie." });
      } catch (e: any) { res.status(400).json({ error: e.message || "Erreur de format. Importation annulée." }); }
  },

  // ====================================================
  // 💰 2. TRANSACTION ENGINE 
  // ====================================================
  
  getTransactions: async (req: Request, res: Response) => {
      try {
          const page = Math.max(1, Number(req.query.page) || 1);
          const limit = Math.max(1, Number(req.query.limit) || 50);
          const skip = (page - 1) * limit;
          
          const search = req.query.search ? String(req.query.search) : '';
          const startDate = req.query.startDate ? String(req.query.startDate) : null;
          const endDate = req.query.endDate ? String(req.query.endDate) : null;
          
          const where: any = {};
          
          if (startDate || endDate) {
              where.createdAt = {};
              if (startDate) where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
              if (endDate) where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
          }
          
          if (search) {
              where.OR = [
                  { id: { contains: search, mode: 'insensitive' } },
                  { paymentRef: { contains: search, mode: 'insensitive' } },
                  { snapshotProductName: { contains: search, mode: 'insensitive' } },
                  { client: { name: { contains: search, mode: 'insensitive' } } }
              ];
          }

          const movements = await prismaInternal.stockMovement.findMany({
              where, orderBy: { createdAt: 'desc' },
              include: {
                  product: { select: { name: true, internalSku: true, measureUnit: true } },
                  client: { select: { name: true } },
                  user: { select: { username: true } }
              }
          });

          const grouped = movements.reduce((acc: any[], m) => {
              const groupKey = m.batchId || m.id; 
              let doc = acc.find(d => d.groupId === groupKey);

              const itemData = {
                  id: m.id,
                  productName: m.snapshotProductName || m.product?.name || 'Produit Supprimé',
                  sku: m.product?.internalSku || '-',
                  quantity: m.quantity,
                  returnedQuantity: m.returnedQuantity || 0,
                  measureUnit: m.product?.measureUnit || 'U',
                  unitPrice: m.snapshotPriceTTC ? m.snapshotPriceTTC.toNumber() : 0, 
                  total: m.amount ? m.amount.toNumber() : 0,
                  totalHT: m.totalHT ? m.totalHT.toNumber() : 0,
                  totalTVA: m.totalTVA ? m.totalTVA.toNumber() : 0
              };

              if (!doc) {
                  acc.push({
                      groupId: groupKey, id: m.id.substring(0, 8).toUpperCase(),
                      type: m.type, date: m.createdAt, clientName: m.client?.name || '-',
                      paymentMethod: m.paymentMethod, paymentRef: m.paymentRef, userName: m.user?.username,
                      items: [itemData], totalAmount: itemData.total, paid: m.paidAmount ? m.paidAmount.toNumber() : 0,
                      totalHT: itemData.totalHT, totalTVA: itemData.totalTVA
                  });
              } else {
                  doc.items.push(itemData);
                  doc.totalAmount += itemData.total;
                  doc.totalHT += itemData.totalHT;
                  doc.totalTVA += itemData.totalTVA;
                  doc.paid += (m.paidAmount ? m.paidAmount.toNumber() : 0);
              }
              return acc;
          }, []);

          const paginatedData = grouped.slice(skip, skip + limit);
          res.json({ data: paginatedData, meta: { total: grouped.length, page, limit, totalPages: Math.ceil(grouped.length / limit) } });
      } catch (e) { res.status(500).json({ error: "Erreur chargement historique" }); }
  },

  createTransaction: async (req: Request, res: Response) => {
    try {
      const { productId, quantity, type, clientId, paymentMethod, paymentRef } = req.body; 
      const secureUserId = (req as any).user?.id || null;
      
      const qtyNum = parseFloat(quantity);
      if (isNaN(qtyNum) || qtyNum === 0) return res.status(400).json({ error: "Quantité invalide" });

      const dbType = type as MovementType;

      const result = await prismaInternal.$transaction(async (tx) => {
          const product = await tx.productB.findUnique({ where: { id: productId } });
          if (!product) throw new Error("Produit introuvable");

          const isAdjustment = dbType === 'ADJUSTMENT';
          const math = calculateCentMath(product.priceHT.toNumber(), product.vatRate.toNumber(), Math.abs(qtyNum));
          
          const totalAmount = isAdjustment ? new Prisma.Decimal(0) : math.totalTTC; 
          const initialPaid = (paymentMethod === 'CREDIT' || dbType === 'SALE_CREDIT' || isAdjustment) ? new Prisma.Decimal(0) : totalAmount;
          const financialImpact = (dbType === 'RETURN') ? totalAmount.negated() : totalAmount;

          let newStockLevel = product.quantity;
          
          if (dbType === 'SALE_CASH' || dbType === 'SALE_CREDIT') {
              const updatedProduct = await tx.productB.update({ where: { id: productId }, data: { quantity: { decrement: qtyNum } } });
              if (updatedProduct.quantity < 0) throw new Error(`Stock insuffisant`);
              newStockLevel = updatedProduct.quantity;
              
              if (clientId) {
                  const balanceInc = (paymentMethod === 'CREDIT' || dbType === 'SALE_CREDIT') ? totalAmount : new Prisma.Decimal(0);
                  await tx.clientB.update({ where: { id: clientId }, data: { totalSpent: { increment: totalAmount }, balance: { increment: balanceInc } } });
              }
          }

          if (dbType === 'RETURN' || dbType === 'RESTOCK' || dbType === 'ADJUSTMENT') {
              const updatedProduct = await tx.productB.update({ where: { id: productId }, data: { quantity: { increment: qtyNum } } });
              newStockLevel = updatedProduct.quantity;
              if (dbType === 'RETURN' && clientId) await tx.clientB.update({ where: { id: clientId }, data: { totalSpent: { decrement: totalAmount } } });
          }

          await tx.stockMovement.create({
              data: {
                  productId, userId: secureUserId, clientId, quantity: Math.abs(qtyNum), type: dbType, 
                  paymentMethod: isAdjustment ? null : (paymentMethod || 'CASH'), paymentRef: paymentRef || null, 
                  amount: financialImpact, paidAmount: dbType === 'RETURN' ? financialImpact : initialPaid,
                  totalHT: isAdjustment ? new Prisma.Decimal(0) : (dbType === 'RETURN' ? math.totalHT.negated() : math.totalHT),
                  totalTVA: isAdjustment ? new Prisma.Decimal(0) : (dbType === 'RETURN' ? math.totalTVA.negated() : math.totalTVA),
                  snapshotPurchaseCost: product.purchaseCost, snapshotPriceHT: product.priceHT, 
                  snapshotVatRate: product.vatRate, snapshotPriceTTC: product.priceTTC, 
                  snapshotProductName: isAdjustment ? (qtyNum < 0 ? `PERTE: ${product.name}` : `SURPLUS: ${product.name}`) : product.name
              }
          });
          return { success: true, newStock: newStockLevel };
      });
      res.json(result);
    } catch (error: any) { 
        if (error.code === 'P2003' && error.message.includes('user_id')) {
            return res.status(401).json({ error: "Session expirée (Utilisateur introuvable). Veuillez vous reconnecter." });
        }
        res.status(400).json({ error: error.message }); 
    }
  },

  createBatchTransaction: async (req: Request, res: Response) => {
    try {
      const { items, type, clientId, paymentMethod, paymentRef } = req.body;
      const secureUserId = (req as any).user?.id || null;

      if (!items || items.length === 0) return res.status(400).json({ error: "Panier vide" });

      const dbType = type as MovementType;
      const ticketId = `TKT-${Date.now().toString().slice(-6)}`;
      const batchUuid = uuidv4(); 

      await prismaInternal.$transaction(async (tx) => {
          let batchTotalTTC = new Prisma.Decimal(0);

          for (const item of items) {
              const product = await tx.productB.findUnique({ where: { id: item.productId } });
              if (!product) throw new Error(`Produit introuvable`);
              const qty = parseFloat(item.quantity);
              if (isNaN(qty) || qty <= 0) continue;

              const itemHT = item.unitPriceHT ? Number(item.unitPriceHT) : product.priceHT.toNumber();
              const math = calculateCentMath(itemHT, product.vatRate.toNumber(), qty);
              batchTotalTTC = batchTotalTTC.add(math.totalTTC);

              await tx.stockMovement.create({
                  data: {
                      batchId: batchUuid, productId: item.productId, userId: secureUserId, clientId, 
                      quantity: qty, type: dbType, paymentMethod: paymentMethod || 'CASH', paymentRef: paymentRef || ticketId, 
                      amount: dbType === 'RETURN' ? math.totalTTC.negated() : math.totalTTC, 
                      paidAmount: dbType === 'RETURN' ? math.totalTTC.negated() : (paymentMethod === 'CREDIT' ? 0 : math.totalTTC), 
                      totalHT: dbType === 'RETURN' ? math.totalHT.negated() : math.totalHT,
                      totalTVA: dbType === 'RETURN' ? math.totalTVA.negated() : math.totalTVA,
                      snapshotPurchaseCost: product.purchaseCost, snapshotPriceHT: new Prisma.Decimal(itemHT),
                      snapshotVatRate: product.vatRate, snapshotPriceTTC: new Prisma.Decimal((itemHT * (1 + product.vatRate.toNumber())).toFixed(2)),
                      snapshotProductName: product.name
                  }
              });

              if (dbType !== 'QUOTE') {
                const multiplier = (dbType === 'SALE_CASH' || dbType === 'SALE_CREDIT') ? -1 : 1;
                await tx.productB.update({ where: { id: item.productId }, data: { quantity: { increment: qty * multiplier } } });
              }
          }

          if (clientId && dbType !== 'QUOTE') {
              if (dbType === 'SALE_CREDIT' || (dbType === 'SALE_CASH' && paymentMethod === 'CREDIT')) {
                  await tx.clientB.update({ where: { id: clientId }, data: { totalSpent: { increment: batchTotalTTC }, balance: { increment: batchTotalTTC } } });
              } else if (dbType === 'SALE_CASH') {
                  await tx.clientB.update({ where: { id: clientId }, data: { totalSpent: { increment: batchTotalTTC } } });
              } else if (dbType === 'RETURN') {
                  await tx.clientB.update({ where: { id: clientId }, data: { totalSpent: { decrement: batchTotalTTC } } });
              }
          }
      });
      res.json({ success: true, ticketId });
    } catch (e: any) { 
        if (e.code === 'P2003' && e.message.includes('user_id')) {
            return res.status(401).json({ error: "Session expirée (Utilisateur introuvable). Veuillez vous reconnecter." });
        }
        res.status(400).json({ error: e.message }); 
    }
  },

  // =========================================================================
  // 🛑 UPGRADED VOID PROTOCOL
  // =========================================================================
  voidTransaction: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { returnQty } = req.body; 

      await prismaInternal.$transaction(async (tx) => {
          const original = await tx.stockMovement.findUnique({ where: { id }, include: { product: true } });
          if (!original) throw new Error("Introuvable");

          if (original.type === 'QUOTE') {
              await tx.stockMovement.delete({ where: { id: original.id } });
              return; 
          }

          const qtyAvailableToReturn = original.quantity - (original.returnedQuantity || 0);
          const qtyToReverse = returnQty ? Number(returnQty) : qtyAvailableToReturn;

          if (qtyAvailableToReturn <= 0) {
              throw new Error("Cet article a déjà été entièrement retourné/annulé.");
          }
          if (qtyToReverse <= 0) {
              throw new Error("La quantité à retourner doit être supérieure à zéro.");
          }
          if (qtyToReverse > qtyAvailableToReturn) {
              throw new Error(`Impossible de retourner ${qtyToReverse}. Maximum autorisé : ${qtyAvailableToReturn}.`);
          }

          let reverseType = (original.type === 'SALE_CASH' || original.type === 'SALE_CREDIT') ? MovementType.RETURN : MovementType.SALE_CASH;
          const stockMultiplier = reverseType === MovementType.RETURN ? 1 : -1; 

          const unitHT = original.snapshotPriceHT?.toNumber() || 0;
          const unitVat = original.snapshotVatRate?.toNumber() || 0;
          const math = calculateCentMath(unitHT, unitVat, qtyToReverse);

          const reverseAmountTTC = math.totalTTC.negated();
          
          let debtReduction = new Prisma.Decimal(0);
          const currentDue = (original.amount || new Prisma.Decimal(0)).sub(original.snapshotPriceTTC?.mul(original.returnedQuantity) || 0).sub(original.paidAmount || 0);
          if (currentDue.gt(0)) debtReduction = Prisma.Decimal.max(0, Prisma.Decimal.min(currentDue, math.totalTTC));

          await tx.stockMovement.update({ where: { id: original.id }, data: { returnedQuantity: { increment: qtyToReverse } } });

          await tx.stockMovement.create({
              data: {
                  productId: original.productId, clientId: original.clientId,
                  quantity: qtyToReverse, type: reverseType, paymentMethod: original.paymentMethod,
                  amount: reverseAmountTTC, paidAmount: reverseAmountTTC,
                  totalHT: math.totalHT.negated(), totalTVA: math.totalTVA.negated(),
                  snapshotPurchaseCost: original.snapshotPurchaseCost, snapshotPriceHT: original.snapshotPriceHT,
                  snapshotVatRate: original.snapshotVatRate, snapshotPriceTTC: original.snapshotPriceTTC,
                  snapshotProductName: returnQty ? `RETOUR (${qtyToReverse}): ${original.snapshotProductName}` : `ANNULATION: ${original.snapshotProductName}`
              }
          });

          await tx.productB.update({ where: { id: original.productId }, data: { quantity: { increment: qtyToReverse * stockMultiplier } } });

          if (original.clientId && !math.totalTTC.isZero()) {
              if (original.type === 'SALE_CREDIT' || (original.type === 'SALE_CASH' && original.paymentMethod === 'CREDIT')) {
                  await tx.clientB.update({ where: { id: original.clientId }, data: { totalSpent: { decrement: math.totalTTC }, balance: { decrement: debtReduction } } });
              } else if (original.type === 'SALE_CASH') {
                  await tx.clientB.update({ where: { id: original.clientId }, data: { totalSpent: { decrement: math.totalTTC } } });
              }
          }
      });
      res.json({ success: true, message: "Annulation/Retour effectué avec succès" });
    } catch (e: any) { res.status(400).json({ error: e.message || "Erreur annulation" }); }
  },

  adjustInventoryBatch: async (req: Request, res: Response) => {
    try {
      const { adjustments, reason } = req.body;
      await prismaInternal.$transaction(async (tx) => {
          for (const item of adjustments) {
              const diff = item.realQuantity - item.theoreticalQuantity;
              if (diff === 0) continue; 
              const product = await tx.productB.findUnique({ where: { id: item.productId } });
              if (!product) continue;

              await tx.productB.update({ where: { id: item.productId }, data: { quantity: item.realQuantity } });

              await tx.stockMovement.create({
                  data: {
                      productId: item.productId, quantity: Math.abs(diff), type: MovementType.ADJUSTMENT,
                      amount: new Prisma.Decimal(0), paidAmount: new Prisma.Decimal(0), totalHT: new Prisma.Decimal(0), totalTVA: new Prisma.Decimal(0),
                      snapshotPurchaseCost: product.purchaseCost, snapshotPriceHT: product.priceHT, snapshotVatRate: product.vatRate, snapshotPriceTTC: product.priceTTC,
                      snapshotProductName: diff > 0 ? `SURPLUS: ${product.name}` : `PERTE: ${product.name}`, paymentRef: reason || 'Inventaire Global'
                  }
              });
          }
      });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: "Erreur système lors de l'inventaire" }); }
  }
};