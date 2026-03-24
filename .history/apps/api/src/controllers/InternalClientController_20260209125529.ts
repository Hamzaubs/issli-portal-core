import { Request, Response } from 'express';
import { prismaInternal, Prisma } from '@marine/db-internal';

// ✅ Safety: Enforce strict type checking for money
const safeDecimal = (val: any) => new Prisma.Decimal(val || 0);

export const InternalClientController = {

  // 🔍 BIG DATA SEARCH (Server-Side)
  // Instead of sending 5000 clients, we send only the 20 matches requested.
  searchClients: async (req: Request, res: Response) => {
    try {
      const { q = '', page = 1, limit = 20 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const search = String(q).trim();

      const whereClause: Prisma.ClientBWhereInput = search ? {
        OR: [
          { name: { contains: search } }, // Case insensitive usually handled by DB collation or add mode: 'insensitive' if Postgres
          { phone: { contains: search } },
          { ice: { contains: search } }
        ]
      } : {};

      const [total, clients] = await Promise.all([
        prismaInternal.clientB.count({ where: whereClause }),
        prismaInternal.clientB.findMany({
          where: whereClause,
          take: Number(limit),
          skip: skip,
          orderBy: { name: 'asc' },
          include: { _count: { select: { movements: true } } } // Stats for UI
        })
      ]);

      const safeClients = clients.map(c => ({
        ...c,
        balance: c.balance.toNumber(),
        totalSpent: c.totalSpent.toNumber(),
        creditLimit: c.creditLimit?.toNumber() || 0
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

  // 🛡️ SAFE CREATION (Duplicate Prevention)
  createClient: async (req: Request, res: Response) => {
    try {
      const { name, phone, ice, address, creditLimit } = req.body;

      if (!name) return res.status(400).json({ error: "Le nom est obligatoire" });

      // Check Duplicates (Safety)
      if (phone) {
        const existing = await prismaInternal.clientB.findFirst({ where: { phone } });
        if (existing) return res.status(400).json({ error: `Ce numéro est déjà utilisé par ${existing.name}` });
      }

      const client = await prismaInternal.clientB.create({
        data: {
          name,
          phone,
          ice,
          address,
          creditLimit: safeDecimal(creditLimit),
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

  // 📝 UPDATE (Audit Safe)
  updateClient: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, phone, ice, address, creditLimit } = req.body;

      await prismaInternal.clientB.update({
        where: { id },
        data: {
          name, phone, ice, address,
          creditLimit: safeDecimal(creditLimit)
        }
      });

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erreur modification" });
    }
  },

  // 🗑️ DELETE (Safety Check)
  deleteClient: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Safety: Prevent deleting clients with debt
      const client = await prismaInternal.clientB.findUnique({ where: { id } });
      if (client && client.balance.toNumber() !== 0) {
        return res.status(400).json({ error: "Impossible de supprimer un client avec une dette active." });
      }

      await prismaInternal.clientB.delete({ where: { id } });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erreur suppression" });
    }
  }
};