// apps/api/src/controllers/InternalController.ts
import { Request, Response } from 'express';
import { prismaInternal, MovementType, Prisma } from '@marine/db-internal';

// 🛡️ MAINTAINED: Your original safety helper
const safeDecimal = (val: any): Prisma.Decimal => {
    if (!val) return new Prisma.Decimal(0);
    return new Prisma.Decimal(val.toString());
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
          sellingPrice: p.sellingPrice.toNumber(),
      }));
      res.json(safeResponse);
    } catch (e) { res.status(500).json({ error: "Erreur chargement stock" }); }
  },
  
  createProduct: async (req: Request, res: Response) => {
      try {
          const { name, internalSku, purchaseCost, sellingPrice, quantity, measureUnit, technicalSpecs } = req.body;
          if (!internalSku || !name) return res.status(400).json({error: "Nom et SKU requis"});
          const product = await prismaInternal.productB.create({
              data: { 
                  name, internalSku, 
                  purchaseCost: safeDecimal(purchaseCost), 
                  sellingPrice: safeDecimal(sellingPrice), 
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
          const { name, purchaseCost, sellingPrice, quantity, measureUnit, technicalSpecs } = req.body;
          await prismaInternal.productB.update({ 
              where: { id }, 
              data: { 
                name, purchaseCost: safeDecimal(purchaseCost), sellingPrice: safeDecimal(sellingPrice), 
                quantity: Number(quantity), measureUnit, technicalSpecs 
              } 
          });
          res.json({ success: true });
      } catch (e) { res.status(500).json({ error: "Erreur mise à jour" }); }
  },
  
  deleteProduct: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          await prismaInternal.productB.delete({ where: { id } });
          res.json({ success: true });
      } catch (e) { res.status(500).json({ error: "Erreur suppression" }); }
  },

  // ====================================================
  // 📥 BATCH IMPORT (SILO B)
  // ====================================================
  importBatchProducts: async (req: Request, res: Response) => {
      try {
          const { products } = req.body;
          if (!products || !Array.isArray(products)) {
              return res.status(400).json({ error: "Données invalides" });
          }

          let successCount = 0;
          let errorCount = 0;
          const errorDetails: string[] = [];

          for (const item of products) {
              try {
                  await prismaInternal.productB.upsert({
                      where: { internalSku: item.internalSku },
                      update: {
                          name: item.name,
                          purchaseCost: safeDecimal(item.purchaseCost),
                          sellingPrice: safeDecimal(item.sellingPrice),
                          quantity: Number(item.quantity) || 0,
                          measureUnit: item.measureUnit || 'UNIT',
                      },
                      create: {
                          name: item.name,
                          internalSku: item.internalSku,
                          purchaseCost: safeDecimal(item.purchaseCost),
                          sellingPrice: safeDecimal(item.sellingPrice),
                          quantity: Number(item.quantity) || 0,
                          measureUnit: item.measureUnit || 'UNIT',
                      }
                  });
                  successCount++;
              } catch (err: any) {
                  errorCount++;
                  errorDetails.push(`❌ Ligne ${item.internalSku}: ${err.message}`);
              }
          }

          res.json({ success: successCount, errors: errorCount, errorDetails });
      } catch (e: any) {
          res.status(500).json({ error: "Erreur serveur lors de l'import." });
      }
  },

  // ====================================================
  // 💰 2. TRANSACTION ENGINE (Atomic & Big Data Safe)
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
          
          if (search) {
              where.OR = [
                  { id: { contains: search, mode: 'insensitive' } },
                  { paymentRef: { contains: search, mode: 'insensitive' } },
                  { snapshotProductName: { contains: search, mode: 'insensitive' } },
                  { client: { name: { contains: search, mode: 'insensitive' } } }
              ];
          }

          if (startDate || endDate) {
              where.createdAt = {};
              if (startDate) where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
              if (endDate) {
                  const end = new Date(`${endDate}T23:59:59.999Z`);
                  where.createdAt.lte = end;
              }
          }

          const [totalCount, movements] = await Promise.all([
              prismaInternal.stockMovement.count({ where }),
              prismaInternal.stockMovement.findMany({
                  where, skip, take: limit, orderBy: { createdAt: 'desc' },
                  include: {
                      product: { select: { name: true, internalSku: true, measureUnit: true } },
                      client: { select: { name: true } },
                      user: { select: { username: true } }
                  }
              })
          ]);

          const safeMovements = movements.map(m => ({
              id: m.id,
              type: m.type,
              productName: m.snapshotProductName || m.product?.name || 'Produit Supprimé',
              productSku: m.product?.internalSku || '-',
              clientName: m.client?.name || '-',
              quantity: m.quantity,
              measureUnit: m.product?.measureUnit || 'U',
              amount: m.amount ? m.amount.toNumber() : 0,
              paid: m.paidAmount ? m.paidAmount.toNumber() : 0, 
              date: m.createdAt,
              paymentMethod: m.paymentMethod,
              paymentRef: m.paymentRef,
              userName: m.user?.username
          }));

          res.json({
              data: safeMovements,
              meta: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) }
          });
      } catch (e) { res.status(500).json({ error: "Erreur chargement historique" }); }
  },

 createTransaction: async (req: Request, res: Response) => {
    try {
      const { productId, quantity, type, clientId, paymentMethod, paymentRef } = req.body; 
      const rawUserId = req.body.userId || (req as any).user?.id;

      if (!productId || !quantity || !type) return res.status(400).json({ error: "Données incomplètes" });
      
      // ✅ FIX: Use parseFloat to support decimals (1.5 kg, 2.5 meters)
      const qtyNum = parseFloat(quantity);
      
      if (isNaN(qtyNum) || qtyNum === 0) return res.status(400).json({ error: "Quantité invalide" });
      if (qtyNum < 0 && type !== 'ADJUSTMENT') return res.status(400).json({ error: "Quantité négative interdite pour ce type d'opération" });

      const result = await prismaInternal.$transaction(async (tx) => {
          const userExists = rawUserId ? await tx.user.findUnique({ where: { id: rawUserId } }) : null;
          const safeUserId = userExists ? rawUserId : null;

          const product = await tx.productB.findUnique({ where: { id: productId } });
          if (!product) throw new Error("Produit introuvable");

          const isAdjustment = type === 'ADJUSTMENT';
          
          const totalAmount = isAdjustment ? new Prisma.Decimal(0) : product.sellingPrice.mul(Math.abs(qtyNum)); 
          let newStockLevel = product.quantity;

          const isCredit = paymentMethod === 'CREDIT' || type === 'SALE_CREDIT';
          const initialPaid = isCredit || isAdjustment ? new Prisma.Decimal(0) : totalAmount;

          if (type === 'QUOTE') {
              await tx.stockMovement.create({
                data: {
                  productId, userId: safeUserId, clientId, quantity: Math.abs(qtyNum), type: MovementType.QUOTE, 
                  amount: totalAmount, paidAmount: new Prisma.Decimal(0),
                  snapshotPurchaseCost: product.purchaseCost, snapshotSellingPrice: product.sellingPrice, snapshotProductName: product.name
                }
              });
              return { success: true, message: "Devis enregistré", newStock: product.quantity };
          }

          if (type === 'SALE_CASH' || type === 'SALE_CREDIT') {
              const updatedProduct = await tx.productB.update({ 
                  where: { id: productId }, data: { quantity: { decrement: qtyNum } } 
              });
              if (updatedProduct.quantity < 0) throw new Error(`Stock insuffisant pour ${product.name}`);
              newStockLevel = updatedProduct.quantity;

              if (clientId) {
                  const balanceInc = isCredit ? totalAmount : new Prisma.Decimal(0);
                  await tx.clientB.update({ 
                      where: { id: clientId }, data: { totalSpent: { increment: totalAmount }, balance: { increment: balanceInc } } 
                  });
              }
          }

          if (type === 'RETURN' || type === 'RESTOCK' || type === 'ADJUSTMENT') {
              const updatedProduct = await tx.productB.update({ 
                  where: { id: productId }, data: { quantity: { increment: qtyNum } } 
              });
              newStockLevel = updatedProduct.quantity;

              // ✅ FIX: Strict Return Math. Do not force negative balances.
              if (type === 'RETURN' && clientId) {
                  // If they return an item, it reduces their total spent.
                  // We ONLY decrement debt if the original sale was a credit. Handled by voidTransaction properly now.
                  await tx.clientB.update({ 
                      where: { id: clientId }, data: { totalSpent: { decrement: totalAmount } } 
                  });
              }
          }

          const financialImpact = (type === 'RETURN') ? totalAmount.negated() : totalAmount;
          
          let snapshotName = product.name;
          if (isAdjustment) {
              snapshotName = qtyNum < 0 ? `PERTE/CASSE: ${product.name}` : `SURPLUS: ${product.name}`;
          }

          await tx.stockMovement.create({
              data: {
                productId, userId: safeUserId, clientId, quantity: Math.abs(qtyNum), type: type as MovementType, 
                paymentMethod: isAdjustment ? null : (paymentMethod || 'CASH'), 
                paymentRef: paymentRef || null, 
                amount: financialImpact, 
                paidAmount: type === 'RETURN' ? financialImpact : initialPaid,
                snapshotPurchaseCost: product.purchaseCost, snapshotSellingPrice: product.sellingPrice, 
                snapshotProductName: snapshotName
              }
          });

          return { success: true, newStock: newStockLevel };
      });

      res.json(result);

    } catch (error: any) { res.status(400).json({ error: error.message || "Erreur transaction" }); }
  },

  createBatchTransaction: async (req: Request, res: Response) => {
    try {
      const { items, type, clientId, paymentMethod, paymentRef } = req.body;
      const rawUserId = req.body.userId || (req as any).user?.id;

      if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Panier vide" });

      await prismaInternal.$transaction(async (tx) => {
          const userExists = rawUserId ? await tx.user.findUnique({ where: { id: rawUserId } }) : null;
          const safeUserId = userExists ? rawUserId : null;

          const timestamp = new Date();
          let globalCartTotal = new Prisma.Decimal(0);
          const isCredit = paymentMethod === 'CREDIT' || type === 'SALE_CREDIT';

          for (const item of items) {
              const product = await tx.productB.findUnique({ where: { id: item.productId } });
              if (!product) throw new Error(`Produit introuvable`);

              // ✅ FIX: Use parseFloat to support decimals (1.5 kg, 2.5 meters)
              const qty = parseFloat(item.quantity);
              if (isNaN(qty) || qty <= 0) continue;

              const unitPrice = new Prisma.Decimal(item.unitPrice || product.sellingPrice);
              const totalLine = unitPrice.mul(qty);
              const initialPaid = isCredit ? new Prisma.Decimal(0) : totalLine;
              globalCartTotal = globalCartTotal.add(totalLine);

              if (type === 'QUOTE') {
                 await tx.stockMovement.create({
                    data: {
                       productId: item.productId, userId: safeUserId, clientId, quantity: qty, type: MovementType.QUOTE,
                       amount: totalLine, paidAmount: new Prisma.Decimal(0),
                       snapshotPurchaseCost: product.purchaseCost, snapshotSellingPrice: unitPrice,
                       snapshotProductName: product.name, createdAt: timestamp 
                    }
                 });
              } 
              else if (type === 'SALE_CASH' || type === 'SALE_CREDIT') {
                  const updatedP = await tx.productB.update({ where: { id: item.productId }, data: { quantity: { decrement: qty } } });
                  if (updatedP.quantity < 0) throw new Error(`Stock insuffisant: ${product.name}`);
                  
                  await tx.stockMovement.create({
                      data: {
                          productId: item.productId, userId: safeUserId, clientId, quantity: qty, type: type as MovementType,
                          paymentMethod: paymentMethod || 'CASH', paymentRef, 
                          amount: totalLine, paidAmount: initialPaid, 
                          snapshotPurchaseCost: product.purchaseCost, snapshotSellingPrice: unitPrice,
                          snapshotProductName: product.name, createdAt: timestamp 
                      }
                  });
              }
              else if (type === 'RETURN') {
                  await tx.productB.update({ where: { id: item.productId }, data: { quantity: { increment: qty } } });
                  await tx.stockMovement.create({
                      data: {
                          productId: item.productId, userId: safeUserId, clientId, quantity: qty, type: MovementType.RETURN,
                          paymentMethod: paymentMethod || 'CASH', paymentRef, 
                          amount: totalLine.negated(), paidAmount: totalLine.negated(), 
                          snapshotPurchaseCost: product.purchaseCost, snapshotSellingPrice: unitPrice,
                          snapshotProductName: product.name, createdAt: timestamp 
                      }
                  });
              }
          }

          if (clientId && type !== 'QUOTE' && !globalCartTotal.isZero()) {
              if (type === 'SALE_CASH' || type === 'SALE_CREDIT') {
                  const debtInc = isCredit ? globalCartTotal : new Prisma.Decimal(0);
                  await tx.clientB.update({ where: { id: clientId }, data: { totalSpent: { increment: globalCartTotal }, balance: { increment: debtInc } } });
              } 
              // ✅ FIX: Removed the global balance decrement from basic batch return. 
              // Returning an item does not automatically wipe away global debt unless it is an explicit credit note refund.
              else if (type === 'RETURN') {
                  await tx.clientB.update({ where: { id: clientId }, data: { totalSpent: { decrement: globalCartTotal } } });
              }
          }
      });

      res.json({ success: true, itemCount: items.length });
    } catch (e: any) { res.status(400).json({ error: e.message || "Erreur enregistrement" }); }
  },

  // =========================================================================
  // 🛑 UPGRADED VOID PROTOCOL (PARTIAL RETURNS & DEVIS SHIELD)
  // =========================================================================
  voidTransaction: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { returnQty } = req.body; 
      const rawUserId = req.body.userId || (req as any).user?.id;

      await prismaInternal.$transaction(async (tx) => {
          const original = await tx.stockMovement.findUnique({ where: { id }, include: { product: true } });
          if (!original) throw new Error("Introuvable");

          if (original.type === 'QUOTE') {
              await tx.stockMovement.delete({ where: { id } });
              return;
          }

          const safeUserId = rawUserId ? (await tx.user.findUnique({ where: { id: rawUserId } }) ? rawUserId : null) : null;

          const qtyToReverse = returnQty ? Number(returnQty) : original.quantity;
          if (qtyToReverse <= 0 || qtyToReverse > original.quantity) throw new Error("Quantité invalide pour ce retour");

          let reverseType: MovementType;
          let stockMultiplier: number; 
          
          if (original.type === 'SALE_CASH' || original.type === 'SALE_CREDIT') { 
              reverseType = MovementType.RETURN; stockMultiplier = 1; 
          } else if (original.type === 'RETURN') { 
              reverseType = MovementType.SALE_CASH; stockMultiplier = -1; 
          } else { 
              reverseType = MovementType.ADJUSTMENT; stockMultiplier = -1; 
          }

          const unitPrice = original.snapshotSellingPrice || new Prisma.Decimal(0);
          const reverseAmount = unitPrice.mul(qtyToReverse).negated();
          const absoluteAmount = reverseAmount.abs();

          // ✅ FIX: Determine how much debt is actually owed vs paid on this specific item
          const originalPaidRatio = original.amount && !original.amount.isZero() ? (original.paidAmount || new Prisma.Decimal(0)).div(original.amount) : new Prisma.Decimal(1);
          const debtReduction = absoluteAmount.mul(new Prisma.Decimal(1).sub(originalPaidRatio));

          await tx.stockMovement.create({
              data: {
                  productId: original.productId, userId: safeUserId, clientId: original.clientId,
                  quantity: qtyToReverse, type: reverseType, paymentMethod: original.paymentMethod,
                  amount: reverseAmount, paidAmount: reverseAmount,
                  snapshotPurchaseCost: original.snapshotPurchaseCost, snapshotSellingPrice: original.snapshotSellingPrice,
                  snapshotProductName: returnQty ? `RETOUR (${qtyToReverse}): ${original.snapshotProductName}` : `ANNULATION: ${original.snapshotProductName}`
              }
          });

          const updatedP = await tx.productB.update({
              where: { id: original.productId },
              data: { quantity: { increment: qtyToReverse * stockMultiplier } }
          });
          if (updatedP.quantity < 0) throw new Error("Stock négatif.");

          // ✅ FIX: Accurate Client Debt & Spent reduction
          if (original.clientId && !absoluteAmount.isZero()) {
              if (original.type === 'SALE_CREDIT' || (original.type === 'SALE_CASH' && original.paymentMethod === 'CREDIT')) {
                  await tx.clientB.update({ where: { id: original.clientId }, data: { totalSpent: { decrement: absoluteAmount }, balance: { decrement: debtReduction } } });
              } else if (original.type === 'SALE_CASH') {
                  await tx.clientB.update({ where: { id: original.clientId }, data: { totalSpent: { decrement: absoluteAmount } } });
              } else if (original.type === 'RETURN') {
                  await tx.clientB.update({ where: { id: original.clientId }, data: { totalSpent: { increment: absoluteAmount }, balance: { increment: absoluteAmount } } });
              }
          }
      });

      res.json({ success: true, message: "Annulation/Retour effectué avec succès" });
    } catch (e: any) { res.status(400).json({ error: e.message || "Erreur annulation" }); }
  },

  // =========================================================================
  // 📝 BATCH INVENTORY ADJUSTMENT (Vérification de Stock)
  // =========================================================================
  adjustInventoryBatch: async (req: Request, res: Response) => {
    try {
      const { adjustments, reason } = req.body;
      const rawUserId = req.body.userId || (req as any).user?.id;

      if (!adjustments || !Array.isArray(adjustments)) {
          return res.status(400).json({ error: "Données d'ajustement invalides" });
      }

      await prismaInternal.$transaction(async (tx) => {
          const userExists = rawUserId ? await tx.user.findUnique({ where: { id: rawUserId } }) : null;
          const safeUserId = userExists ? rawUserId : null;

          for (const item of adjustments) {
              const { productId, theoreticalQuantity, realQuantity } = item;
              const diff = realQuantity - theoreticalQuantity;
              
              if (diff === 0) continue; 

              const product = await tx.productB.findUnique({ where: { id: productId } });
              if (!product) continue;

              await tx.productB.update({
                  where: { id: productId },
                  data: { quantity: realQuantity }
              });

              const snapshotName = diff > 0 
                  ? `SURPLUS (Inventaire): ${product.name}` 
                  : `PERTE/CASSE (Inventaire): ${product.name}`;

              await tx.stockMovement.create({
                  data: {
                      productId, userId: safeUserId, quantity: Math.abs(diff), type: MovementType.ADJUSTMENT,
                      amount: new Prisma.Decimal(0), paidAmount: new Prisma.Decimal(0),
                      snapshotPurchaseCost: product.purchaseCost, snapshotSellingPrice: product.sellingPrice,
                      snapshotProductName: snapshotName, paymentMethod: null, paymentRef: reason || 'Inventaire Global'
                  }
              });
          }
      });

      res.json({ success: true, message: "Inventaire synchronisé avec succès" });
    } catch (e: any) { res.status(500).json({ error: e.message || "Erreur système lors de l'inventaire" }); }
  }
};