import { Request, Response } from 'express';
import { prismaInternal, MovementType, Prisma } from '@marine/db-internal';

const toDecimal = (val: any) => new Prisma.Decimal(Number(val) || 0);

export const InternalController = {
  
  // Get All Products (Stock B)
  getProducts: async (req: Request, res: Response) => {
    try {
      const products = await prismaInternal.productB.findMany({ orderBy: { name: 'asc' } });
      const safe = products.map(p => ({
          ...p,
          purchaseCost: Number(p.purchaseCost),
          sellingPrice: Number(p.sellingPrice)
      }));
      res.json(safe);
    } catch (e) {
      res.status(500).json({ error: "Erreur chargement stock" });
    }
  },

  // Create Product (Silo B)
  createProduct: async (req: Request, res: Response) => {
      try {
          const { name, internalSku, purchaseCost, sellingPrice, quantity, measureUnit, technicalSpecs } = req.body;
          
          if (!internalSku || !name) return res.status(400).json({error: "Nom et SKU requis"});

          const product = await prismaInternal.productB.create({
              data: { 
                  name, 
                  internalSku, 
                  purchaseCost: toDecimal(purchaseCost), 
                  sellingPrice: toDecimal(sellingPrice), 
                  quantity: Number(quantity), 
                  measureUnit, 
                  technicalSpecs 
              }
          });
          res.json(product);
      } catch (e: any) { 
          if (e.code === 'P2002') return res.status(400).json({ error: "Ce SKU existe déjà." });
          res.status(500).json({ error: "Erreur création produit" }); 
      }
  },
  
  // Transaction logic (Fixed for Decimals)
  createTransaction: async (req: Request, res: Response) => {
    try {
      const { productId, userId, quantity, type, clientId, paymentMethod } = req.body; 
      const product = await prismaInternal.productB.findUnique({ where: { id: productId } });
      if (!product) return res.status(404).json({ error: "Produit introuvable" });

      const amount = Number(product.sellingPrice) * quantity;
      const decAmount = toDecimal(amount);

      if (type === 'QUOTE') {
          await prismaInternal.stockMovement.create({
            data: {
              productId, userId, clientId, quantity, type: MovementType.QUOTE, amount: decAmount,
              snapshotPurchaseCost: product.purchaseCost, snapshotSellingPrice: product.sellingPrice, snapshotProductName: product.name
            }
          });
          return res.json({ success: true, message: "Devis enregistré" });
      }

      if (type === 'SALE_CASH' && product.quantity < quantity) {
        return res.status(400).json({ error: `Stock insuffisant (${product.quantity} disp.)` });
      }

      const newQty = type === 'RETURN' || type === 'ADJUSTMENT' ? product.quantity + quantity : product.quantity - quantity;

      const operations: any[] = [
        prismaInternal.productB.update({ where: { id: productId }, data: { quantity: newQty } }),
        prismaInternal.stockMovement.create({
          data: {
            productId, userId, clientId, quantity, type: type as MovementType, paymentMethod: paymentMethod || 'CASH',
            amount: type === 'RETURN' ? toDecimal(-amount) : decAmount, 
            snapshotPurchaseCost: product.purchaseCost, snapshotSellingPrice: product.sellingPrice, snapshotProductName: product.name
          }
        })
      ];

      if (clientId) {
          if (type === 'SALE_CASH' && (paymentMethod === 'CREDIT' || paymentMethod === 'DELIVERY')) {
              operations.push(prismaInternal.clientB.update({ where: { id: clientId }, data: { balance: { increment: decAmount } } }));
          } else if (type === 'RETURN' && paymentMethod === 'CREDIT') {
              operations.push(prismaInternal.clientB.update({ where: { id: clientId }, data: { balance: { decrement: decAmount } } }));
          }
      }

      await prismaInternal.$transaction(operations);
      res.json({ success: true, newStock: newQty });

    } catch (error) { res.status(500).json({ error: "Erreur transaction" }); }
  },

  updateProduct: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const { name, purchaseCost, sellingPrice, quantity, measureUnit, technicalSpecs } = req.body;
          await prismaInternal.productB.update({ 
              where: { id }, 
              data: { name, purchaseCost: toDecimal(purchaseCost), sellingPrice: toDecimal(sellingPrice), quantity: Number(quantity), measureUnit, technicalSpecs } 
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
  }
};