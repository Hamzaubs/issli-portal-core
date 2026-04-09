// apps/api/src/controllers/LegalProductsController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { Prisma } from '@prisma/client-legal';

// Helper: Safe Big Data Math
const toDec = (val: any) => new Prisma.Decimal(val || 0);

export const LegalProductsController = {

  // 1. GET ALL (Stock View)
  getProducts: async (req: Request, res: Response) => {
    try {
      const search = req.query.search ? String(req.query.search) : undefined;
      const where: any = {};
      
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { serialNumber: { contains: search, mode: 'insensitive' } }
        ];
      }

      const products = await prismaLegal.productA.findMany({
        where,
        orderBy: { name: 'asc' }
      });
      res.json(products);
    } catch (e) { res.status(500).json({ error: "Erreur chargement stock" }); }
  },

  // 2. CREATE (Import/Purchase)
  createProduct: async (req: Request, res: Response) => {
    try {
      const { name, serialNumber, priceHT, purchaseCost, vatRate, quantity, measureUnit, technicalSpecs } = req.body;

      // 🛡️ Decimal Safety
      const existing = await prismaLegal.productA.findUnique({ where: { serialNumber } });
      if (existing) return res.status(400).json({ error: "Ce numéro de série existe déjà." });

      const product = await prismaLegal.productA.create({
        data: {
          name,
          serialNumber,
          priceHT: toDec(priceHT),
          purchaseCost: toDec(purchaseCost),
          quantity: toDec(quantity), // ✅ Accepts 10.5
          vatRate: toDec(vatRate || 0.20),
          measureUnit: measureUnit || 'UNIT',
          technicalSpecs
        }
      });
      res.json(product);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  },

  // 3. UPDATE
  updateProduct: async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { priceHT, purchaseCost, quantity, ...rest } = req.body;
        
        const updated = await prismaLegal.productA.update({
            where: { id },
            data: {
                ...rest,
                priceHT: toDec(priceHT),
                purchaseCost: toDec(purchaseCost),
                quantity: toDec(quantity)
            }
        });
        res.json(updated);
    } catch (e) { res.status(400).json({ error: "Erreur mise à jour" }); }
  },

  // 4. DELETE
  deleteProduct: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          // Security Check: Has history?
          const history = await prismaLegal.invoiceItem.count({ where: { productId: id } });
          if(history > 0) return res.status(400).json({ error: "Impossible de supprimer: Ce produit a un historique de ventes." });

          await prismaLegal.productA.delete({ where: { id } });
          res.json({ success: true });
      } catch (e) { res.status(400).json({ error: "Erreur suppression" }); }
  },

  // ============================================================
  // 5. 🔍 AUDIT HISTORY (THE TRUTH ENGINE)
  // ============================================================
  getProductHistory: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          
          // A. Get The Product
          const product = await prismaLegal.productA.findUnique({ where: { id } });
          if (!product) return res.status(404).json({ error: "Produit introuvable" });

          // B. Get All Movements (From Invoices)
          // Since Silo A is "Invoice Driven", every movement comes from an Invoice Item.
          const movements = await prismaLegal.invoiceItem.findMany({
              where: { productId: id },
              include: { 
                  invoice: { 
                      select: { 
                          reference: true, 
                          type: true, 
                          issuedAt: true, 
                          clientNameSnapshot: true,
                          status: true
                      } 
                  } 
              },
              orderBy: { invoice: { issuedAt: 'desc' } }
          });

          // C. Calculate Logic
          const history = movements.map(m => {
              const isOut = m.invoice.type === 'FACTURE' && m.invoice.status !== 'ANNULEE';
              const isIn = m.invoice.type === 'AVOIR'; // Return = Stock IN
              
              // If it's a Quote (DEVIS) or Cancelled, it doesn't affect stock
              const isNeutral = m.invoice.type === 'DEVIS' || m.invoice.status === 'ANNULEE';

              let impact = 0;
              if (isOut) impact = -Number(m.quantity);
              else if (isIn) impact = Number(m.quantity);

              return {
                  id: m.id,
                  date: m.invoice.issuedAt,
                  docRef: m.invoice.reference,
                  docType: m.invoice.type, // FACTURE / AVOIR / DEVIS
                  client: m.invoice.clientNameSnapshot,
                  quantity: Number(m.quantity),
                  price: Number(m.unitPriceHT),
                  impact: isNeutral ? 0 : impact, // -10.5 or +5
                  status: m.invoice.status
              };
          });

          // D. Return Combined Data
          res.json({
              product,
              history,
              stats: {
                  totalSold: history.filter(h => h.impact < 0).reduce((acc, h) => acc + Math.abs(h.impact), 0),
                  totalReturned: history.filter(h => h.impact > 0).reduce((acc, h) => acc + h.impact, 0),
              }
          });

      } catch (e: any) {
          console.error(e);
          res.status(500).json({ error: "Erreur historique produit" });
      }
  },

  // ====================================================
  // 📥 BATCH IMPORT (SILO A - LEGAL) - ACID COMPLIANT
  // ====================================================
  importBatchProducts: async (req: Request, res: Response) => {
      try {
          const { products } = req.body;
          if (!products || !Array.isArray(products) || products.length === 0) {
              return res.status(400).json({ error: "Données invalides ou vides." });
          }

          // 🛡️ Map all products into an array of Prisma Promises
          const upsertOperations = products.map((item: any) => {
              if (!item.serialNumber || !item.name) {
                  throw new Error(`Produit sans nom ou Référence (serialNumber) détecté.`);
              }

              return prismaLegal.productA.upsert({
                  where: { serialNumber: item.serialNumber },
                  update: {
                      name: item.name,
                      purchaseCost: item.purchaseCost ? new Prisma.Decimal(item.purchaseCost.toString()) : new Prisma.Decimal(0),
                      priceHT: item.priceHT ? new Prisma.Decimal(item.priceHT.toString()) : new Prisma.Decimal(0),
                      vatRate: item.vatRate ? new Prisma.Decimal(item.vatRate.toString()) : new Prisma.Decimal(0.20),
                      quantity: Number(item.quantity) || 0,
                      measureUnit: item.measureUnit || 'UNIT',
                  },
                  create: {
                      name: item.name,
                      serialNumber: item.serialNumber,
                      purchaseCost: item.purchaseCost ? new Prisma.Decimal(item.purchaseCost.toString()) : new Prisma.Decimal(0),
                      priceHT: item.priceHT ? new Prisma.Decimal(item.priceHT.toString()) : new Prisma.Decimal(0),
                      vatRate: item.vatRate ? new Prisma.Decimal(item.vatRate.toString()) : new Prisma.Decimal(0.20),
                      quantity: Number(item.quantity) || 0,
                      measureUnit: item.measureUnit || 'UNIT',
                  }
              });
          });

          // 🛡️ Execute ALL promises in a strict ACID Transaction
          // If ONE upsert fails, the entire transaction rolls back automatically
          await prismaLegal.$transaction(upsertOperations);

          res.json({ success: products.length, message: "Transaction ACID réussie." });

      } catch (e: any) {
          console.error("Erreur Transaction Batch Legal:", e);
          res.status(400).json({ 
              error: e.message || "Erreur de format de données. L'importation entière a été annulée par sécurité." 
          });
      }
  }
};