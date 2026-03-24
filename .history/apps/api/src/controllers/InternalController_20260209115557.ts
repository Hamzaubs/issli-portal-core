import { Request, Response } from 'express';
import { prismaInternal, MovementType, Prisma } from '@marine/db-internal';

// ✅ Big Data Safety: Helper to ensure strings are converted to Decimals strictly
const safeDecimal = (val: any): Prisma.Decimal => {
  if (!val) return new Prisma.Decimal(0);
  return new Prisma.Decimal(val.toString());
};

export const InternalController = {
  
  // =================================================================
  // 📦 PRODUCT MANAGEMENT (CRUD)
  // =================================================================

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
    } catch (e) {
      console.error("Internal Stock Error:", e);
      res.status(500).json({ error: "Erreur chargement stock interne" });
    }
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

  // =================================================================
  // 💰 TRANSACTION & HISTORY ENGINE
  // =================================================================

  // ✅ NEW: History for Big Data Analytics
  getTransactions: async (req: Request, res: Response) => {
      try {
          const movements = await prismaInternal.stockMovement.findMany({
              take: 500, // Safety limit
              orderBy: { createdAt: 'desc' },
              include: {
                  product: { select: { name: true, internalSku: true, measureUnit: true } },
                  client: { select: { name: true } },
                  user: { select: { username: true } }
              }
          });

          // Flatten and format for UI
          const safeMovements = movements.map(m => ({
              id: m.id,
              type: m.type,
              productName: m.snapshotProductName || m.product.name,
              productSku: m.product.internalSku,
              clientName: m.client?.name || '-',
              quantity: m.quantity,
              measureUnit: m.product.measureUnit,
              amount: m.amount ? m.amount.toNumber() : 0,
              date: m.createdAt,
              paymentMethod: m.paymentMethod,
              userName: m.user?.username
          }));

          res.json(safeMovements);
      } catch (e) {
          console.error(e);
          res.status(500).json({ error: "Erreur chargement historique" });
      }
  },

  createTransaction: async (req: Request, res: Response) => {
    try {
      const { productId, userId, quantity, type, clientId, paymentMethod } = req.body; 
      
      if (!productId || !quantity || !type) return res.status(400).json({ error: "Données incomplètes" });
      const qtyInt = parseInt(quantity, 10);
      if (isNaN(qtyInt) || qtyInt <= 0) return res.status(400).json({ error: "Quantité invalide" });

      const product = await prismaInternal.productB.findUnique({ where: { id: productId } });
      if (!product) return res.status(404).json({ error: "Produit introuvable" });

      const unitPrice = product.sellingPrice;
      const totalAmount = unitPrice.mul(qtyInt); 

      const operations: any[] = [];
      let newStockLevel = product.quantity;

      if (type === 'QUOTE') {
          await prismaInternal.stockMovement.create({
            data: {
              productId, userId, clientId, quantity: qtyInt, type: MovementType.QUOTE, amount: totalAmount,
              snapshotPurchaseCost: product.purchaseCost, snapshotSellingPrice: product.sellingPrice, snapshotProductName: product.name
            }
          });
          return res.json({ success: true, message: "Devis enregistré" });
      }

      if (type === 'SALE_CASH') {
        if (product.quantity < qtyInt) return res.status(400).json({ error: `Stock insuffisant (${product.quantity})` });
        newStockLevel = product.quantity - qtyInt;
        
        operations.push(prismaInternal.productB.update({ where: { id: productId }, data: { quantity: { decrement: qtyInt } } }));
        if (clientId) {
          if (paymentMethod === 'CREDIT') {
             operations.push(prismaInternal.clientB.update({ where: { id: clientId }, data: { balance: { increment: totalAmount }, totalSpent: { increment: totalAmount } } }));
          } else {
             operations.push(prismaInternal.clientB.update({ where: { id: clientId }, data: { totalSpent: { increment: totalAmount } } }));
          }
        }
      }

      if (type === 'RETURN' || type === 'RESTOCK' || type === 'ADJUSTMENT') {
        newStockLevel = product.quantity + qtyInt;
        operations.push(prismaInternal.productB.update({ where: { id: productId }, data: { quantity: { increment: qtyInt } } }));
        if (type === 'RETURN' && clientId && paymentMethod === 'CREDIT') {
           operations.push(prismaInternal.clientB.update({ where: { id: clientId }, data: { balance: { decrement: totalAmount } } }));
        }
      }

      const financialImpact = (type === 'RETURN') ? totalAmount.negated() : totalAmount;

      operations.push(prismaInternal.stockMovement.create({
          data: {
            productId, userId, clientId, quantity: qtyInt, type: type as MovementType, 
            paymentMethod: paymentMethod || 'CASH', amount: financialImpact, 
            snapshotPurchaseCost: product.purchaseCost, snapshotSellingPrice: product.sellingPrice, snapshotProductName: product.name
          }
        })
      );

      await prismaInternal.$transaction(operations);
      res.json({ success: true, newStock: newStockLevel });

    } catch (error) { 
      console.error("Transaction Failed:", error);
      res.status(500).json({ error: "Erreur transaction critique" }); 
    }
  },

  // ✅ NEW: Safe Void / Cancellation Protocol
  voidTransaction: async (req: Request, res: Response) => {
    try {
      const { id } = req.params; 
      const userId = (req as any).user?.id;

      // 1. Find Original
      const original = await prismaInternal.stockMovement.findUnique({
        where: { id },
        include: { product: true }
      });

      if (!original) return res.status(404).json({ error: "Transaction introuvable" });
      if (original.type === MovementType.QUOTE) return res.status(400).json({ error: "Supprimez le devis directement." });

      // 2. Determine Reversal Logic
      let reverseType: MovementType;
      let stockMultiplier: number; // 1 = Add back, -1 = Remove
      
      if (original.type === 'SALE_CASH') {
          reverseType = MovementType.RETURN;
          stockMultiplier = 1; 
      } else if (original.type === 'RETURN') {
          reverseType = MovementType.SALE_CASH;
          stockMultiplier = -1; 
      } else {
          reverseType = original.type === 'RESTOCK' ? MovementType.ADJUSTMENT : MovementType.RESTOCK;
          stockMultiplier = -1; 
      }

      const operations: any[] = [];
      const reverseAmount = original.amount ? original.amount.negated() : new Prisma.Decimal(0);

      // Op 1: Audit Log (Counter-Entry)
      operations.push(prismaInternal.stockMovement.create({
          data: {
              productId: original.productId, userId, clientId: original.clientId,
              quantity: original.quantity, type: reverseType, paymentMethod: original.paymentMethod,
              amount: reverseAmount,
              snapshotPurchaseCost: original.snapshotPurchaseCost, snapshotSellingPrice: original.snapshotSellingPrice,
              snapshotProductName: `ANNULATION: ${original.snapshotProductName}`
          }
      }));

      // Op 2: Revert Stock
      operations.push(prismaInternal.productB.update({
          where: { id: original.productId },
          data: { quantity: { increment: original.quantity * stockMultiplier } }
      }));

      // Op 3: Revert Client Debt (If Credit)
      if (original.clientId && original.paymentMethod === 'CREDIT' && original.amount) {
          // reverseAmount handles the math automatically (Sale -> Neg amount -> Decrement debt)
          operations.push(prismaInternal.clientB.update({
              where: { id: original.clientId },
              data: { balance: { increment: reverseAmount } }
          }));
      }

      await prismaInternal.$transaction(operations);
      res.json({ success: true, message: "Transaction annulée avec succès" });

    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erreur lors de l'annulation" });
    }
  }
};import { Request, Response } from 'express';
import { prismaInternal, MovementType, Prisma } from '@marine/db-internal';

// ✅ Big Data Safety: Helper to ensure strings are converted to Decimals strictly
const safeDecimal = (val: any): Prisma.Decimal => {
  if (!val) return new Prisma.Decimal(0);
  return new Prisma.Decimal(val.toString());
};

export const InternalController = {
  
  // =================================================================
  // 📦 PRODUCT MANAGEMENT (CRUD)
  // =================================================================

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
    } catch (e) {
      console.error("Internal Stock Error:", e);
      res.status(500).json({ error: "Erreur chargement stock interne" });
    }
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

  // =================================================================
  // 💰 TRANSACTION & HISTORY ENGINE
  // =================================================================

  // ✅ NEW: History for Big Data Analytics
  getTransactions: async (req: Request, res: Response) => {
      try {
          const movements = await prismaInternal.stockMovement.findMany({
              take: 500, // Safety limit
              orderBy: { createdAt: 'desc' },
              include: {
                  product: { select: { name: true, internalSku: true, measureUnit: true } },
                  client: { select: { name: true } },
                  user: { select: { username: true } }
              }
          });

          // Flatten and format for UI
          const safeMovements = movements.map(m => ({
              id: m.id,
              type: m.type,
              productName: m.snapshotProductName || m.product.name,
              productSku: m.product.internalSku,
              clientName: m.client?.name || '-',
              quantity: m.quantity,
              measureUnit: m.product.measureUnit,
              amount: m.amount ? m.amount.toNumber() : 0,
              date: m.createdAt,
              paymentMethod: m.paymentMethod,
              userName: m.user?.username
          }));

          res.json(safeMovements);
      } catch (e) {
          console.error(e);
          res.status(500).json({ error: "Erreur chargement historique" });
      }
  },

  createTransaction: async (req: Request, res: Response) => {
    try {
      const { productId, userId, quantity, type, clientId, paymentMethod } = req.body; 
      
      if (!productId || !quantity || !type) return res.status(400).json({ error: "Données incomplètes" });
      const qtyInt = parseInt(quantity, 10);
      if (isNaN(qtyInt) || qtyInt <= 0) return res.status(400).json({ error: "Quantité invalide" });

      const product = await prismaInternal.productB.findUnique({ where: { id: productId } });
      if (!product) return res.status(404).json({ error: "Produit introuvable" });

      const unitPrice = product.sellingPrice;
      const totalAmount = unitPrice.mul(qtyInt); 

      const operations: any[] = [];
      let newStockLevel = product.quantity;

      if (type === 'QUOTE') {
          await prismaInternal.stockMovement.create({
            data: {
              productId, userId, clientId, quantity: qtyInt, type: MovementType.QUOTE, amount: totalAmount,
              snapshotPurchaseCost: product.purchaseCost, snapshotSellingPrice: product.sellingPrice, snapshotProductName: product.name
            }
          });
          return res.json({ success: true, message: "Devis enregistré" });
      }

      if (type === 'SALE_CASH') {
        if (product.quantity < qtyInt) return res.status(400).json({ error: `Stock insuffisant (${product.quantity})` });
        newStockLevel = product.quantity - qtyInt;
        
        operations.push(prismaInternal.productB.update({ where: { id: productId }, data: { quantity: { decrement: qtyInt } } }));
        if (clientId) {
          if (paymentMethod === 'CREDIT') {
             operations.push(prismaInternal.clientB.update({ where: { id: clientId }, data: { balance: { increment: totalAmount }, totalSpent: { increment: totalAmount } } }));
          } else {
             operations.push(prismaInternal.clientB.update({ where: { id: clientId }, data: { totalSpent: { increment: totalAmount } } }));
          }
        }
      }

      if (type === 'RETURN' || type === 'RESTOCK' || type === 'ADJUSTMENT') {
        newStockLevel = product.quantity + qtyInt;
        operations.push(prismaInternal.productB.update({ where: { id: productId }, data: { quantity: { increment: qtyInt } } }));
        if (type === 'RETURN' && clientId && paymentMethod === 'CREDIT') {
           operations.push(prismaInternal.clientB.update({ where: { id: clientId }, data: { balance: { decrement: totalAmount } } }));
        }
      }

      const financialImpact = (type === 'RETURN') ? totalAmount.negated() : totalAmount;

      operations.push(prismaInternal.stockMovement.create({
          data: {
            productId, userId, clientId, quantity: qtyInt, type: type as MovementType, 
            paymentMethod: paymentMethod || 'CASH', amount: financialImpact, 
            snapshotPurchaseCost: product.purchaseCost, snapshotSellingPrice: product.sellingPrice, snapshotProductName: product.name
          }
        })
      );

      await prismaInternal.$transaction(operations);
      res.json({ success: true, newStock: newStockLevel });

    } catch (error) { 
      console.error("Transaction Failed:", error);
      res.status(500).json({ error: "Erreur transaction critique" }); 
    }
  },

  // ✅ NEW: Safe Void / Cancellation Protocol
  voidTransaction: async (req: Request, res: Response) => {
    try {
      const { id } = req.params; 
      const userId = (req as any).user?.id;

      // 1. Find Original
      const original = await prismaInternal.stockMovement.findUnique({
        where: { id },
        include: { product: true }
      });

      if (!original) return res.status(404).json({ error: "Transaction introuvable" });
      if (original.type === MovementType.QUOTE) return res.status(400).json({ error: "Supprimez le devis directement." });

      // 2. Determine Reversal Logic
      let reverseType: MovementType;
      let stockMultiplier: number; // 1 = Add back, -1 = Remove
      
      if (original.type === 'SALE_CASH') {
          reverseType = MovementType.RETURN;
          stockMultiplier = 1; 
      } else if (original.type === 'RETURN') {
          reverseType = MovementType.SALE_CASH;
          stockMultiplier = -1; 
      } else {
          reverseType = original.type === 'RESTOCK' ? MovementType.ADJUSTMENT : MovementType.RESTOCK;
          stockMultiplier = -1; 
      }

      const operations: any[] = [];
      const reverseAmount = original.amount ? original.amount.negated() : new Prisma.Decimal(0);

      // Op 1: Audit Log (Counter-Entry)
      operations.push(prismaInternal.stockMovement.create({
          data: {
              productId: original.productId, userId, clientId: original.clientId,
              quantity: original.quantity, type: reverseType, paymentMethod: original.paymentMethod,
              amount: reverseAmount,
              snapshotPurchaseCost: original.snapshotPurchaseCost, snapshotSellingPrice: original.snapshotSellingPrice,
              snapshotProductName: `ANNULATION: ${original.snapshotProductName}`
          }
      }));

      // Op 2: Revert Stock
      operations.push(prismaInternal.productB.update({
          where: { id: original.productId },
          data: { quantity: { increment: original.quantity * stockMultiplier } }
      }));

      // Op 3: Revert Client Debt (If Credit)
      if (original.clientId && original.paymentMethod === 'CREDIT' && original.amount) {
          // reverseAmount handles the math automatically (Sale -> Neg amount -> Decrement debt)
          operations.push(prismaInternal.clientB.update({
              where: { id: original.clientId },
              data: { balance: { increment: reverseAmount } }
          }));
      }

      await prismaInternal.$transaction(operations);
      res.json({ success: true, message: "Transaction annulée avec succès" });

    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erreur lors de l'annulation" });
    }
  }
};