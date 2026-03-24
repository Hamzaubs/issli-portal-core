import { Request, Response } from 'express';
import { prismaInternal, Prisma } from '@marine/db-internal';

// ✅ Safety Helper
const safeDecimal = (val: any): Prisma.Decimal => {
  if (!val) return new Prisma.Decimal(0);
  return new Prisma.Decimal(val.toString());
};

export const InternalClientController = {

  // =================================================================
  // 🔍 BIG DATA SEARCH
  // =================================================================
  searchClients: async (req: Request, res: Response) => {
    try {
      const { q = '', page = 1, limit = 12, mode = 'ALL' } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const search = String(q).trim();

      const textFilter: Prisma.ClientBWhereInput = search ? {
        OR: [
          { name: { contains: search } }, 
          { phone: { contains: search } },
          { ice: { contains: search } }
        ]
      } : {};

      const whereClause: Prisma.ClientBWhereInput = {
        ...textFilter,
        ...(mode === 'DEBT' ? { balance: { gt: 0.1 } } : {}) 
      };

      const [total, clients, debtStats] = await Promise.all([
        prismaInternal.clientB.count({ where: whereClause }),
        prismaInternal.clientB.findMany({
          where: whereClause,
          take: Number(limit),
          skip: skip,
          orderBy: mode === 'DEBT' ? { balance: 'desc' } : { name: 'asc' },
          include: { _count: { select: { movements: true } } } 
        }),
        prismaInternal.clientB.aggregate({
          _sum: { balance: true },
          where: { balance: { gt: 0 } }
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
          pages: Math.ceil(total / Number(limit)),
          globalDebt: debtStats._sum.balance?.toNumber() || 0 
        }
      });

    } catch (e) {
      console.error("Client Search Error:", e);
      res.status(500).json({ error: "Erreur recherche clients" });
    }
  },

  // =================================================================
  // 📊 CLIENT PROFILE
  // =================================================================
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

  // =================================================================
  // 📜 HISTORY (Fixed "PAYMENT" Enum Crash)
  // =================================================================
  getClientHistory: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20, type } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      // 🛠️ FIX: Map 'PAYMENT' request to 'ADJUSTMENT' database value
      // This prevents the PrismaValidationError because 'PAYMENT' isn't in your Enum.
      let dbTypeFilter: any = undefined;
      
      if (type === 'PAYMENT') {
          dbTypeFilter = 'ADJUSTMENT'; // We search for ADJUSTMENTS (our proxy for payments)
      } else if (type) {
          dbTypeFilter = type;
      }

      const whereClause: Prisma.StockMovementWhereInput = {
        clientId: id,
        ...(dbTypeFilter ? { type: dbTypeFilter as any } : {}) 
      };

      // Specific logic: If looking for payments, ensure quantity is 0 (to distinguish from stock adjustments)
      if (type === 'PAYMENT') {
          (whereClause as any).quantity = 0;
      }

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

      const history = movements.map(m => {
        // 🛠️ FIX: Map 'ADJUSTMENT' back to 'PAYMENT' for the frontend
        let displayType = m.type as string;
        if (m.type === 'ADJUSTMENT' && m.quantity === 0) {
            displayType = 'PAYMENT';
        }

        return {
            id: m.id,
            date: m.createdAt,
            type: displayType, // ✅ Sends "PAYMENT" to frontend so icons work
            productName: m.snapshotProductName || m.product?.name || 'Article Supprimé',
            sku: m.product?.internalSku || '-',
            quantity: m.quantity,
            measureUnit: m.product?.measureUnit || 'UNIT',
            amount: m.amount?.toNumber() ?? 0,
            paymentMethod: m.paymentMethod,
        };
      });

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

  // =================================================================
  // 💰 REGISTER PAYMENT (Save as ADJUSTMENT)
  // =================================================================
  registerPayment: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { amount, method, ref, note } = req.body;

      if (!amount || amount <= 0) return res.status(400).json({ error: "Montant invalide" });

      const description = `${note || 'Règlement'}${ref ? ` (Ref: ${ref})` : ''}`;

      await prismaInternal.stockMovement.create({
        data: {
          // 🛠️ FIX: Save as 'ADJUSTMENT' because 'PAYMENT' is not in DB Enum
          type: 'ADJUSTMENT' as any, 
          clientId: id,
          amount: new Prisma.Decimal(amount).neg(), 
          quantity: 0, // 0 Quantity identifies this as a financial movement, not stock
          paymentMethod: method || 'CASH',
          productId: '00000000-0000-0000-0000-000000000000', 
          snapshotProductName: description
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

  // =================================================================
  // 🛡️ CLIENT CRUD
  // =================================================================
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