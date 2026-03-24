import { Request, Response } from 'express';
import { prismaInternal, MovementType, Prisma } from '@marine/db-internal';

export const MovementController = {
  
  // ✅ GET HISTORY
  async getHistory(req: Request, res: Response) {
    try {
      const movements = await prismaInternal.stockMovement.findMany({
        include: { product: true },
        orderBy: { createdAt: 'desc' }, // Updated from timestamp to createdAt
        take: 50
      });
      res.json(movements);
    } catch (e) {
      res.status(500).json({ error: "Erreur chargement historique" });
    }
  },

  // ✅ CREATE MOVEMENT (SALE / RESTOCK)
  async createMovement(req: Request, res: Response) {
    try {
      const { productId, quantity, type, userId } = req.body;

      // 1. Fetch Product to get current Price/Cost
      const product = await prismaInternal.productB.findUnique({
        where: { id: productId }
      });

      if (!product) {
        return res.status(404).json({ error: "Produit introuvable (Stock B)" });
      }

      // 2. Validate Stock Logic
      if (type === MovementType.SALE_CASH) {
        if (product.quantity < quantity) {
          return res.status(400).json({ error: "Stock insuffisant !" });
        }
      }

      // 3. Prepare Snapshot Data (CRITICAL FOR ACCOUNTING)
      // We freeze the cost and price NOW so future changes don't affect past reports
      const snapshotPurchaseCost = product.purchaseCost;
      const snapshotSellingPrice = product.sellingPrice;
      
      // ✅ FIXED: SALE_CREDIT and RETURN must also register their financial value for StatsController
      const isFinancialMovement = [
        MovementType.SALE_CASH, 
        MovementType.SALE_CREDIT, 
        MovementType.RETURN
      ].includes(type);

      const amount = isFinancialMovement 
        ? Number(product.sellingPrice) * quantity 
        : 0;

      // 4. Create Movement Record
      const movement = await prismaInternal.stockMovement.create({
        data: {
          productId,
          quantity,
          type,
          userId: userId || 'SYSTEM', // Fallback if no user
          amount: new Prisma.Decimal(amount),
          
          // ✅ SNAPSHOTS SAVED HERE
          snapshotPurchaseCost,
          snapshotSellingPrice
        }
      });

      // 5. Update Actual Product Stock
      const increment = type === MovementType.RESTOCK || type === MovementType.RETURN ? quantity : -quantity;
      
      await prismaInternal.productB.update({
        where: { id: productId },
        data: { quantity: { increment } }
      });

      res.json(movement);

    } catch (e) {
      console.error("Movement Error:", e);
      res.status(500).json({ error: "Erreur lors du mouvement de stock" });
    }
  }
};