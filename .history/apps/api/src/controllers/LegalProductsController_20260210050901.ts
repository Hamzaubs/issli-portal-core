// apps/api/src/controllers/LegalProductsController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { Prisma } from '@marine/db-legal';

// Helper: Ensure we always work with Decimals
const toDecimal = (val: any) => new Prisma.Decimal(val || 0);

export const LegalProductsController = {

  // 1. GET (Read & Format for Big Data Analytics)
  getProducts: async (req: Request, res: Response) => {
    try {
      const products = await prismaLegal.productA.findMany({ 
        orderBy: { name: 'asc' } 
      });
      
      // 🛡️ BIG DATA TRANSFORMATION: EXECUTE MATH ON SERVER
      const safe = products.map(p => {
          // Perform math using Decimal engine to avoid "0.30000004" errors
          const priceHT = p.priceHT;
          const cost = p.purchaseCost;
          const qty = new Prisma.Decimal(p.quantity);
          const vat = p.vatRate;

          // KPIs calculated with High Precision
          const stockValue = cost.mul(qty);
          const potentialRevenue = priceHT.mul(qty);
          const potentialMarginGlobal = (priceHT.minus(cost)).mul(qty);
          const marginUnit = priceHT.minus(cost);

          return {
            ...p,
            // Convert to Number ONLY at the very end for JSON transport
            priceHT: priceHT.toNumber(),
            purchaseCost: cost.toNumber(),
            vatRate: vat.toNumber(),
            quantity: p.quantity, // Int
            
            // Analytics Fields
            stockValue: stockValue.toNumber(), 
            potentialRevenue: potentialRevenue.toNumber(),
            potentialMargin: potentialMarginGlobal.toNumber(),
            marginUnit: marginUnit.toNumber()
          };
      });
      
      res.json(safe);
    } catch (e) { 
      console.error("LegalProducts Get Error:", e);
      res.status(500).json({ error: "Erreur chargement stock (Silo A)" }); 
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

      // Auto-generate serial if empty (Safe Timestamp + Random suffix)
      const finalSerial = serialNumber || `GEN-${Date.now().toString(36).toUpperCase()}`;

      // 1. Pre-Check Duplicate Serial
      const existing = await prismaLegal.productA.findUnique({ 
        where: { serialNumber: finalSerial } 
      });
      if (existing) return res.status(400).json({ error: "Ce numéro de série existe déjà." });

      // 2. Create with Decimal Precision
      const product = await prismaLegal.productA.create({
        data: {
            name: name.trim(), 
            serialNumber: finalSerial,
            priceHT: toDecimal(priceHT),
            purchaseCost: toDecimal(purchaseCost),
            vatRate: toDecimal(vatRate).equals(0) ? new Prisma.Decimal(0.20) : toDecimal(vatRate),
            quantity: Math.floor(Number(quantity) || 0), // Force Int compliance
            measureUnit: measureUnit || 'UNIT',
            technicalSpecs
        }
      });
      res.json(product);
    } catch (e: any) { 
        console.error("Create Product Error:", e);
        if (e.code === 'P2002') return res.status(400).json({ error: "Duplication détectée (Série/Référence)." });
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
                quantity: Math.floor(Number(quantity)), // Force Int compliance
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
          if (usage) return res.status(400).json({ error: "Impossible: Produit lié à des factures existantes (Juridique)." });

          await prismaLegal.productA.delete({ where: { id } });
          res.json({ success: true });
      } catch (e) { res.status(400).json({ error: "Erreur suppression" }); }
  }
};