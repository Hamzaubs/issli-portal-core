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

  // Get All Products (Optimized for UI Display)
  getProducts: async (req: Request, res: Response) => {
    try {
      const products = await prismaInternal.productB.findMany({ 
        orderBy: { name: 'asc' },
        include: {
           // Optional: Include recent movement count if needed for analytics
           _count: { select: { movements: true } }
        }
      });

      // Transform Decimals to Numbers ONLY for the JSON response (Display only)
      const safeResponse = products.map(p => ({
          ...p,
          purchaseCost: p.purchaseCost.toNumber(),
          sellingPrice: p.sellingPrice.toNumber(),
          // Don't expose internal Decimal objects to frontend
      }));
      
      res.json(safeResponse);
    } catch (e) {
      console.error("Internal Stock Error:", e);
      res.status(500).json({ error: "Erreur chargement stock interne" });
    }
  },

  // Create Product (Decimal Safe)
  createProduct: async (req: Request, res: Response) => {
      try {
          const { name, internalSku, purchaseCost, sellingPrice, quantity, measureUnit, technicalSpecs } = req.body;
          
          if (!internalSku || !name) return res.status(400).json({error: "Nom et SKU requis"});

          const product = await prismaInternal.productB.create({
              data: { 
                  name, 
                  internalSku, 
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

  // Update Product
  updateProduct: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const { name, purchaseCost, sellingPrice, quantity, measureUnit, technicalSpecs } = req.body;
          
          await prismaInternal.productB.update({ 
              where: { id }, 
              data: { 
                name, 
                purchaseCost: safeDecimal(purchaseCost), 
                sellingPrice: safeDecimal(sellingPrice), 
                quantity: Number(quantity), 
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
          await prismaInternal.productB.delete({ where: { id } });
          res.json({ success: true });
      } catch (e) { res.status(500).json({ error: "Erreur suppression" }); }
  },

  // =================================================================
  // 💰 TRANSACTION ENGINE (The "Invincibility Protocol")
  // =================================================================

  createTransaction: async (req: Request, res: Response) => {
    try {
      const { productId, userId, quantity, type, clientId, paymentMethod } = req.body; 
      
      // 1. Validation & Setup
      if (!productId || !quantity || !type) return res.status(400).json({ error: "Données incomplètes" });
      const qtyInt = parseInt(quantity, 10);
      if (isNaN(qtyInt) || qtyInt <= 0) return res.status(400).json({ error: "Quantité invalide" });

      const product = await prismaInternal.productB.findUnique({ where: { id: productId } });
      if (!product) return res.status(404).json({ error: "Produit introuvable" });

      // 2. Big Data Math (Decimal Arithmetic)
      // cost * qty = total (No floating point usage)
      const unitPrice = product.sellingPrice; // Already Decimal
      const totalAmount = unitPrice.mul(qtyInt); // Precise multiplication

      // 3. Logic Branching
      const operations: any[] = [];
      let newStockLevel = product.quantity;

      // --- SCENARIO A: QUOTE (No stock impact) ---
      if (type === 'QUOTE') {
          await prismaInternal.stockMovement.create({
            data: {
              productId, userId, clientId, 
              quantity: qtyInt, 
              type: MovementType.QUOTE, 
              amount: totalAmount,
              snapshotPurchaseCost: product.purchaseCost, 
              snapshotSellingPrice: product.sellingPrice, 
              snapshotProductName: product.name
            }
          });
          return res.json({ success: true, message: "Devis enregistré" });
      }

      // --- SCENARIO B: SALE (Decrement Stock) ---
      if (type === 'SALE_CASH') {
        if (product.quantity < qtyInt) {
          return res.status(400).json({ error: `Stock insuffisant (${product.quantity} disponible)` });
        }
        newStockLevel = product.quantity - qtyInt;
        
        // Operation 1: Decrement Product
        operations.push(
          prismaInternal.productB.update({ 
            where: { id: productId }, 
            data: { quantity: { decrement: qtyInt } } 
          })
        );

        // Operation 2: Update Client Balance (if Credit)
        if (clientId && paymentMethod === 'CREDIT') {
          operations.push(
            prismaInternal.clientB.update({
              where: { id: clientId },
              data: { 
                balance: { increment: totalAmount }, // Debt Increases
                totalSpent: { increment: totalAmount }
              }
            })
          );
        } else if (clientId) {
           // Track spending even if Cash
           operations.push(
            prismaInternal.clientB.update({
              where: { id: clientId },
              data: { totalSpent: { increment: totalAmount } }
            })
          );
        }
      }

      // --- SCENARIO C: RETURN / ADJUSTMENT (Increment Stock) ---
      if (type === 'RETURN' || type === 'RESTOCK' || type === 'ADJUSTMENT') {
        newStockLevel = product.quantity + qtyInt;

        // Operation 1: Increment Product
        operations.push(
          prismaInternal.productB.update({ 
            where: { id: productId }, 
            data: { quantity: { increment: qtyInt } } 
          })
        );

        // Operation 2: Update Client Balance (If Return on Credit)
        // If a client returns an item bought on credit, we reduce their debt.
        if (type === 'RETURN' && clientId && paymentMethod === 'CREDIT') {
           operations.push(
            prismaInternal.clientB.update({
              where: { id: clientId },
              data: { balance: { decrement: totalAmount } } // Debt Decreases
            })
          );
        }
      }

      // 4. Common Operation: Create Log Entry (The Audit Trail)
      // For returns, the "amount" impact on cash flow is negative
      const financialImpact = (type === 'RETURN') ? totalAmount.negated() : totalAmount;

      operations.push(
        prismaInternal.stockMovement.create({
          data: {
            productId, 
            userId, 
            clientId, 
            quantity: qtyInt, 
            type: type as MovementType, 
            paymentMethod: paymentMethod || 'CASH',
            amount: financialImpact, 
            // Audit snapshots:
            snapshotPurchaseCost: product.purchaseCost, 
            snapshotSellingPrice: product.sellingPrice, 
            snapshotProductName: product.name
          }
        })
      );

      // 5. ATOMIC EXECUTION (Invincibility Protocol)
      // All or nothing. If client update fails, stock doesn't change.
      await prismaInternal.$transaction(operations);

      res.json({ success: true, newStock: newStockLevel });

    } catch (error) { 
      console.error("Transaction Failed:", error);
      res.status(500).json({ error: "Erreur transaction critique" }); 
    }
  }
};