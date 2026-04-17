// apps/api/src/controllers/MovementController.ts
import { Request, Response } from 'express';
import { prismaInternal, MovementType, Prisma } from '@marine/db-internal';

export const MovementController = {
  
  // ✅ GET HISTORY
  async getHistory(req: Request, res: Response) {
    try {
      const movements = await prismaInternal.stockMovement.findMany({
        include: { product: true },
        orderBy: { createdAt: 'desc' }, 
        take: 50
      });
      res.json(movements);
    } catch (e) {
      res.status(500).json({ error: "Erreur chargement historique" });
    }
  },

  // ✅ CREATE MOVEMENT (Now with TVA Math Engine)
  async createMovement(req: Request, res: Response) {
    try {
      const { productId, quantity, type, userId } = req.body;
      const qty = Number(quantity);

      // 1. Fetch Product to get current Price/Cost
      const product = await prismaInternal.productB.findUnique({
        where: { id: productId }
      });

      if (!product) {
        return res.status(404).json({ error: "Produit introuvable (Stock B)" });
      }

      // 2. Validate Stock Logic
      if (type === MovementType.SALE_CASH) {
        if (product.quantity < qty) {
          return res.status(400).json({ error: "Stock insuffisant !" });
        }
      }

      // 3. Prepare Snapshot Data (CRITICAL FOR ACCOUNTING)
      const snapshotPurchaseCost = product.purchaseCost;
      const snapshotPriceHT = product.priceHT;
      const snapshotVatRate = product.vatRate;
      const snapshotPriceTTC = product.priceTTC;
      
      const isFinancialMovement = [
        MovementType.SALE_CASH, 
        MovementType.SALE_CREDIT, 
        MovementType.RETURN
      ].includes(type);

      // 🧮 Cent-Based Math Engine to prevent floating point drift
      const unitHT = Number(product.priceHT);
      const vat = Number(product.vatRate);

      const totalHTCents = Math.round(unitHT * qty * 100);
      const totalTTCCents = Math.round(totalHTCents * (1 + vat));
      const totalTVACents = totalTTCCents - totalHTCents;

      const amount = isFinancialMovement ? (totalTTCCents / 100) : 0;
      const totalHT = isFinancialMovement ? (totalHTCents / 100) : 0;
      const totalTVA = isFinancialMovement ? (totalTVACents / 100) : 0;

      // 4. Create Movement Record
      const movement = await prismaInternal.stockMovement.create({
        data: {
          productId,
          quantity: qty,
          type,
          userId: userId || 'SYSTEM', 
          amount: new Prisma.Decimal(amount),
          totalHT: new Prisma.Decimal(totalHT),
          totalTVA: new Prisma.Decimal(totalTVA),
          
          // ✅ SNAPSHOTS SAVED HERE
          snapshotPurchaseCost,
          snapshotPriceHT,
          snapshotVatRate,
          snapshotPriceTTC
        }
      });

      // 5. Update Actual Product Stock
      const increment = type === MovementType.RESTOCK || type === MovementType.RETURN ? qty : -qty;
      
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