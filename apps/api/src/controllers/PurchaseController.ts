import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { v4 as uuidv4 } from 'uuid';

export const PurchaseController = {
  // 1. Create a new Purchase Invoice or Purchase Order
  create: async (req: Request, res: Response) => {
    try {
      const { supplierId, reference, type, items, note } = req.body;
      
      if (!supplierId || !items || items.length === 0) {
        return res.status(400).json({ error: "Fournisseur et articles requis." });
      }

      // Fetch supplier for snapshots
      const supplier = await prismaLegal.supplierA.findUnique({ where: { id: supplierId } });
      if (!supplier) return res.status(404).json({ error: "Fournisseur introuvable." });

      // Calculate Totals
      let totalHT = 0;
      let totalTTC = 0;

      const formattedItems = items.map((item: any) => {
        const qty = Number(item.quantity) || 0;
        const priceHT = Number(item.unitPriceHT) || 0;
        const vat = Number(item.vatRate) || 0.20; // Default 20%
        
        const itemTotalHT = qty * priceHT;
        const itemTotalTTC = itemTotalHT * (1 + vat);
        
        totalHT += itemTotalHT;
        totalTTC += itemTotalTTC;

        return {
          id: uuidv4(),
          productId: item.productId || null,
          productName: item.productName,
          quantity: qty,
          unitPriceHT: priceHT,
          vatRateSnapshot: vat
        };
      });

      const purchaseId = uuidv4();
      
      const purchase = await prismaLegal.purchaseInvoice.create({
        data: {
          id: purchaseId,
          reference: reference || `ACH-${Date.now().toString().slice(-6)}`, // Auto-generate if empty
          supplierId,
          type: type || 'FACTURE_ACHAT',
          status: 'EN_ATTENTE',
          totalHT,
          totalTTC,
          note,
          supplierNameSnapshot: supplier.name,
          supplierIceSnapshot: supplier.ice,
          items: {
            create: formattedItems
          }
        },
        include: { items: true, supplier: true }
      });

      res.status(201).json(purchase);
    } catch (error) {
      console.error("Error creating purchase:", error);
      res.status(500).json({ error: "Erreur lors de la création de l'achat." });
    }
  },

  // 2. Get all Purchases (with optional supplier filter)
  getAll: async (req: Request, res: Response) => {
    try {
      const { supplierId, type } = req.query;
      
      const whereClause: any = {};
      if (supplierId) whereClause.supplierId = String(supplierId);
      if (type) whereClause.type = String(type);

      const purchases = await prismaLegal.purchaseInvoice.findMany({
        where: whereClause,
        include: { supplier: { select: { name: true, ice: true } } },
        orderBy: { issuedAt: 'desc' }
      });

      res.status(200).json(purchases);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erreur lors de la récupération des achats." });
    }
  }
};