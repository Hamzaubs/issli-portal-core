import { Request, Response } from 'express';
import { prismaInternal, Prisma } from '@marine/db-internal';

// ✅ Safety: Enforce strict type checking for money
const safeDecimal = (val: any) => new Prisma.Decimal(val || 0);

export const InternalClientController = {

  // 🔍 BIG DATA SEARCH (Server-Side)
  searchClients: async (req: Request, res: Response) => {
    try {
      const { q = '', page = 1, limit = 12 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const search = String(q).trim();

      // Dynamic Where Clause
      const whereClause: Prisma.ClientBWhereInput = search ? {
        OR: [
          { name: { contains: search } }, 
          { phone: { contains: search } },
          { ice: { contains: search } }
        ]
      } : {};

      // Parallel Fetch (Count + Data) for Speed
      const [total, clients] = await Promise.all([
        prismaInternal.clientB.count({ where: whereClause }),
        prismaInternal.clientB.findMany({
          where: whereClause,
          take: Number(limit),
          skip: skip,
          orderBy: { name: 'asc' },
          include: { _count: { select: { movements: true } } } 
        })
      ]);

      // Safe Number Conversion for Frontend
      const safeClients = clients.map(c => ({
        ...c,
        balance: c.balance.toNumber(),
        totalSpent: c.totalSpent.toNumber(),
        // removed creditLimit to fix build error
      }));

      res.json({
        data: safeClients,
        meta: {
          total,
          page: Number(page),
          pages: Math.ceil(total / Number(limit))
        }
      });

    } catch (e) {
      console.error("Client Search Error:", e);
      res.status(500).json({ error: "Erreur recherche clients" });
    }
  },

  // 🛡️ SAFE CREATION
  createClient: async (req: Request, res: Response) => {
    try {
      const { name, phone, ice, address } = req.body;

      if (!name) return res.status(400).json({ error: "Le nom est obligatoire" });

      // Check Duplicates (Safety)
      if (phone) {
        const existing = await prismaInternal.clientB.findFirst({ where: { phone } });
        if (existing) return res.status(400).json({ error: `Ce numéro est déjà utilisé par ${existing.name}` });
      }

      const client = await prismaInternal.clientB.create({
        data: {
          name, phone, ice, address,
          balance: 0,
          totalSpent: 0
        }
      });

      res.json(client);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erreur création client" });
    }
  },

  // 📝 UPDATE
  updateClient: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, phone, ice, address } = req.body;

      await prismaInternal.clientB.update({
        where: { id },
        data: { name, phone, ice, address }
      });

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erreur modification" });
    }
  },
  getClientDetails: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const client = await prismaInternal.clientB.findUnique({
        where: { id },
        include: { 
          _count: { select: { movements: true } }
        }
      });

      if (!client) return res.status(404).json({ error: "Client introuvable" });

      // Calculate key stats efficiently
      const stats = await prismaInternal.stockMovement.aggregate({
        where: { clientId: id, type: { in: ['SALE_CASH', 'RETURN'] } },
        _sum: { amount: true },
        _max: { createdAt: true }
      });

      res.json({
        profile: client,
        stats: {
          totalSpent: stats._sum.amount?.toNumber() || 0,
          lastPurchase: stats._max.createdAt,
          transactionCount: client._count.movements
        }
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erreur chargement profil" });
    }
  },

  // 📜 GET HISTORY (Paginated & Filtered)
  getClientHistory: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20, type } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      // Allow filtering by type (e.g., only Show QUOTES or only SALES)
      const whereClause: Prisma.StockMovementWhereInput = {
        clientId: id,
        ...(type ? { type: String(type) } : {})
      };

      const [total, movements] = await Promise.all([
        prismaInternal.stockMovement.count({ where: whereClause }),
        prismaInternal.stockMovement.findMany({
          where: whereClause,
          take: Number(limit),
          skip: skip,
          orderBy: { createdAt: 'desc' }, // Newest first
          include: { 
            product: { select: { name: true, internalSku: true, measureUnit: true } } 
          }
        })
      ]);

      const history = movements.map(m => ({
        id: m.id,
        date: m.createdAt,
        type: m.type,
        productName: m.product?.name || 'Article Supprimé',
        sku: m.product?.internalSku || '-',
        quantity: m.quantity,
        measureUnit: m.product?.measureUnit || 'UNIT',
        amount: m.amount.toNumber(),
        paymentMethod: m.paymentMethod,
        paymentRef: m.paymentRef
      }));

      res.json({
        data: history,
        meta: {
          total,
          page: Number(page),
          pages: Math.ceil(total / Number(limit))
        }
      });

    } catch (e) {
      res.status(500).json({ error: "Erreur historique" });
    }
  },

  // 🗑️ DELETE (Safety Check)
  deleteClient: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Safety: Prevent deleting clients with debt
      const client = await prismaInternal.clientB.findUnique({ where: { id } });
      if (client && client.balance.toNumber() > 1) { // Tolerance of 1 DH
        return res.status(400).json({ error: "Impossible de supprimer un client avec une dette active." });
      }

      await prismaInternal.clientB.delete({ where: { id } });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erreur suppression" });
    }
  }
};