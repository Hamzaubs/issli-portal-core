import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { Prisma } from '@marine/db-legal';

// Helper: Safe conversion for Big Data/Financials
const toDecimal = (val: any) => new Prisma.Decimal(val || 0);

export const LegalProductsController = {

  // 1. GET (Read & Format for Big Data Analytics)
  getProducts: async (req: Request, res: Response) => {
    try {
      const products = await prismaLegal.productA.findMany({ 
        orderBy: { name: 'asc' } 
      });
      
      // 🛡️ BIG DATA TRANSFORMATION
      // We calculate values Server-Side to avoid JS Floating Point errors
      const safe = products.map(p => {
          const price = p.priceHT.toNumber();
          const cost = p.purchaseCost.toNumber();
          const qty = p.quantity;
          const vat = p.vatRate.toNumber();

          return {
            ...p,
            priceHT: price,
            purchaseCost: cost,
            vatRate: vat,
            // Computed KPIs for Analytics
            stockValue: cost * qty, // Real Asset Value (Inventory)
            potentialRevenue: price * qty, // Projected Revenue
            potentialMargin: (price - cost) * qty, // Projected Profit
            marginUnit: price - cost
          };
      });
      
      res.json(safe);
    } catch (e) { 
      console.error(e);
      res.status(500).json({ error: "Erreur chargement stock" }); 
    }
  },

  // 2. CREATE (Atomic Safety)
  createProduct: async (req: Request, res: Response) => {
    try {
      const { 
        name, serialNumber, 
        priceHT, purchaseCost, vatRate, 
        quantity, measureUnit, technicalSpecs 
      } = req.body;
      
      if (!name) return res.status(400).json({ error: "Nom du produit obligatoire" });

      // Auto-generate serial if empty (Safe Timestamp)
      const finalSerial = serialNumber || `GEN-${Date.now().toString(36).toUpperCase()}`;

      // 1. Pre-Check Duplicate Serial
      const existing = await prismaLegal.productA.findUnique({ 
        where: { serialNumber: finalSerial } 
      });
      if (existing) return res.status(400).json({ error: "Ce numéro de série existe déjà." });

      // 2. Create with Decimal Precision
      const product = await prismaLegal.productA.create({
        data: {
            name, 
            serialNumber: finalSerial,
            priceHT: toDecimal(priceHT),
            purchaseCost: toDecimal(purchaseCost),
            vatRate: toDecimal(vatRate) || new Prisma.Decimal(0.20),
            quantity: Number(quantity) || 0,
            measureUnit: measureUnit || 'UNIT',
            technicalSpecs
        }
      });
      res.json(product);
    } catch (e: any) { 
        console.error("Create Product Error:", e);
        if (e.code === 'P2002') return res.status(400).json({ error: "Duplication détectée (Série)." });
        res.status(500).json({ error: "Erreur système création produit" }); 
    }
  },

  // 3. UPDATE (Preserve Logic & Safety)
  updateProduct: async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { 
            name, serialNumber,
            priceHT, purchaseCost, vatRate, 
            quantity, measureUnit, technicalSpecs 
        } = req.body;
        
        await prismaLegal.productA.update({
            where: { id },
            data: { 
                name, 
                serialNumber,
                priceHT: toDecimal(priceHT),
                purchaseCost: toDecimal(purchaseCost),
                vatRate: toDecimal(vatRate),
                quantity: Number(quantity),
                measureUnit, 
                technicalSpecs 
            }
        });
        res.json({ success: true });
    } catch (e: any) { 
        if (e.code === 'P2002') return res.status(400).json({ error: "Ce numéro de série est déjà utilisé." });
        res.status(500).json({ error: "Erreur mise à jour" }); 
    }
  },

  // 4. SAFE DELETE (Dependency Check)
  deleteProduct: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          // 🛡️ Guard: Check if product is used in any invoice line
          const usage = await prismaLegal.invoiceItem.findFirst({ where: { productId: id } });
          if (usage) return res.status(400).json({ error: "Impossible: Produit lié à des factures existantes." });

          await prismaLegal.productA.delete({ where: { id } });
          res.json({ success: true });
      } catch (e) { res.status(400).json({ error: "Erreur suppression" }); }
  }
};