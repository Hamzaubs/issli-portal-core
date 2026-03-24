import { Request, Response } from 'express';
import { prismaInternal, Prisma } from '@marine/db-internal';

// ✅ Safety Helper: Ensures we never crash on null/undefined numbers
const safeDecimal = (val: any): Prisma.Decimal => {
  if (!val) return new Prisma.Decimal(0);
  return new Prisma.Decimal(val.toString());
};

export const InternalClientController = {

  // 🔍 BIG DATA SEARCH (Updated for Debt Mode)
  searchClients: async (req: Request, res: Response) => {
    try {
      const { q = '', page = 1, limit = 12, mode = 'ALL' } = req.query; // Added 'mode'
      const skip = (Number(page) - 1) * Number(limit);
      const search = String(q).trim();

      // 1. Base Filter (Search Text)
      const textFilter: Prisma.ClientBWhereInput = search ? {
        OR: [
          { name: { contains: search } }, 
          { phone: { contains: search } },
          { ice: { contains: search } }
        ]
      } : {};

      // 2. Debt Filter (If Mode == DEBT)
      const whereClause: Prisma.ClientBWhereInput = {
        ...textFilter,
        ...(mode === 'DEBT' ? { balance: { gt: 0.1 } } : {}) // Only positive balance > 0.1 DH
      };

      // 3. Parallel Fetch (Count + Data + Total Debt Stats)
      const [total, clients, debtStats] = await Promise.all([
        prismaInternal.clientB.count({ where: whereClause }),
        prismaInternal.clientB.findMany({
          where: whereClause,
          take: Number(limit),
          skip: skip,
          // If Debt Mode: Sort by Balance DESC (Highest debt first). Else: Name ASC.
          orderBy: mode === 'DEBT' ? { balance: 'desc' } : { name: 'asc' },
          include: { _count: { select: { movements: true } } } 
        }),
        // Calculate Global Debt across ALL pages
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
          globalDebt: debtStats._sum.balance?.toNumber() || 0 // ✅ Sends Total Debt to Frontend
        }
      });

    } catch (e) {
      console.error("Client Search Error:", e);
      res.status(500).json({ error: "Erreur recherche clients" });
    }
  },
  