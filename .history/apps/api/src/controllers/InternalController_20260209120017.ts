import { Request, Response } from 'express';
import { prismaInternal, MovementType, Prisma } from '@marine/db-internal';

// Helper for strict decimal math
const safeDecimal = (val: any): Prisma.Decimal => {
  if (!val) return new Prisma.Decimal(0);
  return new Prisma.Decimal(val.toString());
};

export const InternalController = {
  // ... (keep existing getProducts, createProduct, etc.)

  // ---------------------------------------------------------
  // ⚡ BATCH ENGINE (For Quotes & Multi-Item Sales)
  // ---------------------------------------------------------
  createBatchTransaction: async (req: Request, res: Response) => {
    try {
      const { items, type, clientId, paymentMethod } = req.body;
      // items = [{ productId, quantity, price }]
      const userId = (req as any).user?.id;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Panier vide" });
      }

      // 1. Prepare Operations
      const operations: any[] = [];
      const timestamp = new Date(); // Shared timestamp for grouping
      const batchId = `DEV-${Math.floor(Date.now() / 1000)}`; // Logical Reference

      for (const item of items) {
         const product = await prismaInternal.productB.findUnique({ where: { id: item.productId } });
         if (!product) throw new Error(`Produit introuvable: ${item.productId}`);

         const qty = Math.floor(Number(item.quantity));
         const unitPrice = new Prisma.Decimal(item.unitPrice || product.sellingPrice);
         const totalLine = unitPrice.mul(qty);

         // A. QUOTE LOGIC (No Stock Impact)
         if (type === 'QUOTE') {
            operations.push(prismaInternal.stockMovement.create({
               data: {
                  productId: item.productId,
                  userId,
                  clientId,
                  quantity: qty,
                  type: MovementType.QUOTE,
                  amount: totalLine,
                  snapshotPurchaseCost: product.purchaseCost,
                  snapshotSellingPrice: unitPrice, // Lock the price offered
                  snapshotProductName: product.name,
                  createdAt: timestamp // Grouping key
               }
            }));
         }
         
         // B. DIRECT BATCH SALE (Future proofing)
         // ... (Can be added here if we want multi-item sales in one go)
      }

      // 2. ATOMIC EXECUTION
      await prismaInternal.$transaction(operations);
      
      res.json({ success: true, batchId, itemCount: items.length });

    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || "Erreur enregistrement devis" });
    }
  },

  // ---------------------------------------------------------
  // 🔄 CONVERSION ENGINE (Quote -> Sale)
  // ---------------------------------------------------------
  convertQuoteToSale: async (req: Request, res: Response) => {
    try {
      // We expect a list of movement IDs that form the Quote
      const { movementIds, paymentMethod } = req.body; 
      const userId = (req as any).user?.id;

      const quoteLines = await prismaInternal.stockMovement.findMany({
        where: { id: { in: movementIds }, type: 'QUOTE' },
        include: { product: true }
      });

      if (quoteLines.length === 0) return res.status(404).json({ error: "Aucun devis trouvé" });

      const operations: any[] = [];
      let totalAmount = new Prisma.Decimal(0);

      // 1. Validate Stock & Prepare Sale
      for (const line of quoteLines) {
         if (line.product.quantity < line.quantity) {
            throw new Error(`Stock insuffisant pour ${line.product.name} (Requis: ${line.quantity}, Dispo: ${line.product.quantity})`);
         }

         // A. Create SALE movement (Impact Stock)
         operations.push(prismaInternal.stockMovement.create({
            data: {
               productId: line.productId,
               userId,
               clientId: line.clientId,
               quantity: line.quantity,
               type: MovementType.SALE_CASH,
               paymentMethod: paymentMethod || 'CASH',
               amount: line.amount, // Use the quoted amount (price guarantee)
               snapshotPurchaseCost: line.product.purchaseCost,
               snapshotSellingPrice: line.snapshotSellingPrice || line.product.sellingPrice,
               snapshotProductName: line.snapshotProductName
            }
         }));

         // B. Decrement Physical Stock
         operations.push(prismaInternal.productB.update({
            where: { id: line.productId },
            data: { quantity: { decrement: line.quantity } }
         }));
         
         // C. Void/Close the Quote line (Prevent double usage)
         // We essentially "Delete" the quote line or mark it converted. 
         // Since we don't have a status field, we delete it to keep history clean, 
         // OR we keep it but the UI must filter. 
         // *Better Approach*: Delete the QUOTE movements so they don't clutter, 
         // the SALE movement becomes the record.
         operations.push(prismaInternal.stockMovement.delete({ where: { id: line.id } }));

         if (line.amount) totalAmount = totalAmount.add(line.amount);
      }

      // 2. Financials (Client Debt)
      if (paymentMethod === 'CREDIT' && quoteLines[0].clientId) {
         operations.push(prismaInternal.clientB.update({
            where: { id: quoteLines[0].clientId },
            data: { balance: { increment: totalAmount }, totalSpent: { increment: totalAmount } }
         }));
      }

      await prismaInternal.$transaction(operations);
      res.json({ success: true, message: "Devis converti en vente avec succès" });

    } catch (e: any) {
       console.error(e);
       res.status(500).json({ error: e.message });
    }
  },
  
  // ... (keep existing voidTransaction, etc.)
};