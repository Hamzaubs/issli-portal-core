import { Request, Response } from 'express';
import { prismaInternal, Prisma } from '@marine/db-internal';

// ✅ Safety Helper
const safeDecimal = (val: any): Prisma.Decimal => {
  if (!val) return new Prisma.Decimal(0);
  return new Prisma.Decimal(val.toString());
};

export const InternalClientController = {

  // 🔍 SEARCH
  searchClients: async (req: Request, res: Response) => {
    try {
      const { q = '', page = 1, limit = 12 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const search = String(q).trim();

      const whereClause: Prisma.ClientBWhereInput = search ? {
        OR: [
          { name: { contains: search } }, 
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
          include: { _count: { select: { movements: true } } } 
        })
      ]);

      const safeClients = clients.map(c => ({
        ...c,
        balance: c.balance.toNumber(),
        totalSpent: c.totalSpent.toNumber(),
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

  // 📊 PROFILE
  getClientDetails: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const client = await prismaInternal.clientB.findUnique({
        where: { id },
        include: { _count: { select: { movements: true } } }
      });

      if (!client) return res.status(404).json({ error: "Client introuvable" });

      const stats = await prismaInternal.stockMovement.aggregate({
        where: { clientId: id, type: { in: ['SALE_CASH', 'RETURN'] } }, 
        _sum: { amount: true },
        _max: { createdAt: true }
      });

      res.json({
        profile: { ...client, balance: client.balance.toNumber() },
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

  // 📜 HISTORY
  getClientHistory: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20, type } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const whereClause: Prisma.StockMovementWhereInput = {
        clientId: id,
        ...(type ? { type: type as any } : {}) 
      };

      const [total, movements] = await Promise.all([
        prismaInternal.stockMovement.count({ where: whereClause }),
        prismaInternal.stockMovement.findMany({
          where: whereClause,
          take: Number(limit),
          skip: skip,
          orderBy: { createdAt: 'desc' },
          include: { 
            product: { select: { name: true, internalSku: true, measureUnit: true } } 
          }
        })
      ]);

      const history = movements.map(m => ({
        id: m.id,
        date: m.createdAt,
        type: m.type,
        productName: m.product?.name || m.snapshotProductName || 'Article Supprimé',
        sku: m.product?.internalSku || '-',
        quantity: m.quantity,
        measureUnit: m.product?.measureUnit || 'UNIT',
        amount: m.amount?.toNumber() ?? 0,
        paymentMethod: m.paymentMethod,
        // ✅ FIX: Removed direct 'paymentRef' access. 
        // Data is now usually in snapshotProductName for payments.
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
      console.error(e);
      res.status(500).json({ error: "Erreur historique" });
    }
  },

  // 💰 REGISTER PAYMENT (Decreases Debt)
  registerPayment: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { amount, method, ref, note } = req.body;

      if (!amount || amount <= 0) return res.status(400).json({ error: "Montant invalide" });

      // ✅ SMART WORKAROUND: Save Ref in name because column is missing
      const description = `${note || 'Règlement'}${ref ? ` (Ref: ${ref})` : ''}`;

      await prismaInternal.stockMovement.create({
        data: {
          type: 'PAYMENT' as any, 
          clientId: id,
          amount: new Prisma.Decimal(amount).neg(), // Payments are negative (Credit)
          quantity: 0,
          paymentMethod: method || 'CASH',
          // paymentRef: ref || null, // REMOVED (DB Column Missing)
          productId: '00000000-0000-0000-0000-000000000000', 
          snapshotProductName: description, // Saved Here Instead
          unitPrice: 0
        }
      });

      await prismaInternal.clientB.update({
        where: { id },
        data: { balance: { decrement: amount } }
      });

      res.json({ success: true });
    } catch (e) {
      console.error("Payment Error:", e);
      res.status(500).json({ error: "Erreur enregistrement paiement" });
    }
  },

  // 🛡️ CREATE CLIENT
  createClient: async (req: Request, res: Response) => {
    try {
      const { name, phone, ice, address } = req.body;
      if (!name) return res.status(400).json({ error: "Le nom est obligatoire" });

      if (phone) {
        const existing = await prismaInternal.clientB.findFirst({ where: { phone } });
        if (existing) return res.status(400).json({ error: `Ce numéro est déjà utilisé par ${existing.name}` });
      }

      const client = await prismaInternal.clientB.create({
        data: { name, phone, ice, address, balance: 0, totalSpent: 0 }
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

  // 🗑️ DELETE
  deleteClient: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const client = await prismaInternal.clientB.findUnique({ where: { id } });
      if (client && client.balance.toNumber() > 1) { 
        return res.status(400).json({ error: "Impossible de supprimer un client avec une dette active." });
      }
      await prismaInternal.clientB.delete({ where: { id } });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erreur suppression" });
    }
  }
};