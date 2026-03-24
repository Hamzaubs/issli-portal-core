// apps/api/src/controllers/InventoryController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';

export const InventoryController = {

  // SIMPLE RETURN TO SUPPLIER
  // Logic: "I am sending 5 items back to the factory."
  // Action: Safely decrements 5 from stock (if available).
  returnToSupplier: async (req: Request, res: Response) => {
    try {
      const { productId, quantity } = req.body;
      
      const qty = Number(quantity);
      if (!productId) return res.status(400).json({ error: "Produit requis" });
      if (qty <= 0) return res.status(400).json({ error: "Quantité invalide" });

      // 1. Check availability (Safety First)
      const product = await prismaLegal.productA.findUnique({ where: { id: productId } });
      
      if (!product) return res.status(404).json({ error: "Produit introuvable" });
      
      // 🛡️ TS FIX: Appended .toNumber() to Prisma.Decimal to compare with standard number
      if (product.quantity.toNumber() < qty) {
        return res.status(400).json({ error: `Impossible : Vous n'avez que ${product.quantity.toNumber()} en stock.` });
      }

      // 2. Simple Update (Direct Decrement)
      const updatedProduct = await prismaLegal.productA.update({
        where: { id: productId },
        data: { quantity: { decrement: qty } }
      });

      res.json(updatedProduct);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: "Erreur retour fournisseur" });
    }
  }
};