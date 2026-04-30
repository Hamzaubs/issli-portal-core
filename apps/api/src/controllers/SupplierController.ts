// apps/api/src/controllers/SupplierController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { v4 as uuidv4 } from 'uuid';

export const SupplierController = {
  // 1. Create a new supplier
  create: async (req: Request, res: Response) => {
    try {
      const data = req.body;
      
      // Check if a supplier with this ICE already exists
      if (data.ice) {
        const existing = await prismaLegal.supplierA.findUnique({ where: { ice: data.ice } });
        if (existing) {
          return res.status(400).json({ error: "Un fournisseur avec cet ICE existe déjà." });
        }
      }

      // Generate a UUID just like you do for clients
      const supplierId = uuidv4();
      const supplier = await prismaLegal.supplierA.create({ 
        data: {
            id: supplierId,
            ...data
        } 
      });
      res.status(201).json(supplier);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erreur lors de la création du fournisseur." });
    }
  },

  // 2. Get all suppliers (with pagination and search)
  getAll: async (req: Request, res: Response) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 12;
      const search = String(req.query.search || '').trim();
      const skip = (page - 1) * limit;

      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { ice: { contains: search } },
          { identifiantFiscal: { contains: search } }, // ✅ Search support for IF added
          { phone: { contains: search } },
          { contactName: { contains: search, mode: 'insensitive' } }
        ];
      }

      const suppliers = await prismaLegal.supplierA.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' } 
      });

      const total = await prismaLegal.supplierA.count({ where });

      res.status(200).json({
        data: suppliers,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erreur lors de la récupération des fournisseurs." });
    }
  },

  // 3. Get a single supplier by ID
  getById: async (req: Request, res: Response) => {
    try {
      const supplier = await prismaLegal.supplierA.findUnique({
        where: { id: req.params.id }
      });
      if (!supplier) return res.status(404).json({ error: "Fournisseur introuvable." });
      res.status(200).json(supplier);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erreur lors de la récupération du fournisseur." });
    }
  },

  // 4. Update a supplier
  update: async (req: Request, res: Response) => {
    try {
      const supplier = await prismaLegal.supplierA.update({
        where: { id: req.params.id },
        data: req.body
      });
      res.status(200).json(supplier);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erreur lors de la mise à jour." });
    }
  },

  // 5. Delete a supplier
  delete: async (req: Request, res: Response) => {
    try {
      await prismaLegal.supplierA.delete({
        where: { id: req.params.id }
      });
      res.status(200).json({ message: "Fournisseur supprimé avec succès." });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erreur lors de la suppression." });
    }
  }
};