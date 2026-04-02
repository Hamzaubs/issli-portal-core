import { Request, Response } from 'express';
import { prismaInternal } from '@marine/db-internal'; 
import { v4 as uuidv4 } from 'uuid';

export const InternalPurchaseController = {
  // 1. Create Internal Supplier
  createSupplier: async (req: Request, res: Response) => {
    try {
      const { name, phone, ice, address, contactName } = req.body;
      if (!name) return res.status(400).json({ error: "Nom obligatoire" });

      const supplier = await prismaInternal.supplierB.create({
        data: { id: uuidv4(), name, phone, ice, address, contactName }
      });
      res.json(supplier);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erreur création fournisseur interne" });
    }
  },

  // 2. List Internal Suppliers
  getSuppliers: async (req: Request, res: Response) => {
    try {
      const suppliers = await prismaInternal.supplierB.findMany({
        orderBy: { name: 'asc' }
      });
      res.json(suppliers);
    } catch (e) {
      res.status(500).json({ error: "Erreur chargement fournisseurs" });
    }
  },

  // 3. Create Internal Purchase (Pure Financial)
  createPurchase: async (req: Request, res: Response) => {
    try {
      const { supplierId, reference, type, items, note } = req.body;

      const supplier = await prismaInternal.supplierB.findUnique({ where: { id: supplierId } });
      if (!supplier) return res.status(404).json({ error: "Fournisseur introuvable" });

      let totalHT = 0;
      let totalTTC = 0;

      const formattedItems = items.map((item: any) => {
        const qty = Number(item.quantity) || 0;
        const priceHT = Number(item.unitPriceHT) || 0;
        const vat = Number(item.vatRate) || 0.20;
        
        const itemTotalHT = qty * priceHT;
        const itemTotalTTC = itemTotalHT * (1 + vat);
        
        totalHT += itemTotalHT;
        totalTTC += itemTotalTTC;

        return {
          id: uuidv4(),
          productName: item.productName,
          quantity: qty,
          unitPriceHT: priceHT,
          vatRateSnapshot: vat
        };
      });

      const purchase = await prismaInternal.purchaseB.create({
        data: {
          id: uuidv4(),
          reference: reference || `INT-ACH-${Date.now().toString().slice(-6)}`,
          supplierId,
          type: type || 'FACTURE_ACHAT',
          totalHT,
          totalTTC,
          note,
          supplierNameSnapshot: supplier.name,
          supplierIceSnapshot: supplier.ice,
          items: { create: formattedItems }
        },
        include: { items: true }
      });

      res.status(201).json(purchase);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erreur enregistrement achat interne" });
    }
  },

  // 4. Get Internal Purchase History
  getPurchaseHistory: async (req: Request, res: Response) => {
    try {
      const purchases = await prismaInternal.purchaseB.findMany({
        include: { supplier: { select: { name: true } } },
        orderBy: { issuedAt: 'desc' }
      });
      res.json(purchases);
    } catch (e) {
      res.status(500).json({ error: "Erreur historique achats" });
    }
  }
};