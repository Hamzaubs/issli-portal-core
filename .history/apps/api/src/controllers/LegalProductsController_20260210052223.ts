// apps/api/src/controllers/LegalProductsController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { Prisma } from '@prisma/client-legal';

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
      const safe = products.map(p => {
          const priceHT = p.priceHT;
          const cost = p.purchaseCost;
          const qty = p.quantity; // Now a Decimal from DB
          const vat = p.vatRate;

          // KPIs calculated with High Precision (Decimal * Decimal)
          const stockValue = cost.mul(qty);
          const potentialRevenue = priceHT.mul(qty);
          const potentialMarginGlobal = (priceHT.minus(cost)).mul(qty);
          const marginUnit = priceHT.minus(cost);

          return {
            ...p,
            // Convert to Number ONLY for JSON transport
            priceHT: priceHT.toNumber(),
            purchaseCost: cost.toNumber(),
            vatRate: vat.toNumber(),
            quantity: qty.toNumber(), // Supports 1.5, 0.75, etc.
            
            // Analytics Fields
            stockValue: stockValue.toNumber(), 
            potentialRevenue: potentialRevenue.toNumber(),
            potentialMargin: potentialMarginGlobal.toNumber(),
            marginUnit: marginUnit.toNumber()
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

      const finalSerial = serialNumber || `GEN-${Date.now().toString(36).toUpperCase()}`;

      const existing = await prismaLegal.productA.findUnique({ 
        where: { serialNumber: finalSerial } 
      });
      if (existing) return res.status(400).json({ error: "Ce numéro de série existe déjà." });

      const product = await prismaLegal.productA.create({
        data: {
            name: name.trim(), 
            serialNumber: finalSerial,
            priceHT: toDecimal(priceHT),
            purchaseCost: toDecimal(purchaseCost),
            vatRate: toDecimal(vatRate).equals(0) ? new Prisma.Decimal(0.20) : toDecimal(vatRate),
            
            // ✅ UPDATED: Supports Decimal Quantity
            quantity: toDecimal(quantity), 
            
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
                name: name ? name.trim() : undefined, 
                serialNumber,
                priceHT: toDecimal(priceHT),
                purchaseCost: toDecimal(purchaseCost),
                vatRate: toDecimal(vatRate),
                
                // ✅ UPDATED: Supports Decimal Quantity
                quantity: toDecimal(quantity),
                
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

  // 4. SAFE DELETE
  deleteProduct: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const usage = await prismaLegal.invoiceItem.findFirst({ where: { productId: id } });
          if (usage) return res.status(400).json({ error: "Impossible: Produit lié à des factures existantes." });

          await prismaLegal.productA.delete({ where: { id } });
          res.json({ success: true });
      } catch (e) { res.status(400).json({ error: "Erreur suppression" }); }
  }
}; 