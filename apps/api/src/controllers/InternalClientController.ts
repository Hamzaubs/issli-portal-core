import { Request, Response } from 'express';
import { prismaInternal, Prisma, MovementType } from '@marine/db-internal';

const toNumber = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'object' && 'toNumber' in val) return val.toNumber();
    return Number(val);
};

export const InternalClientController = {

  searchClients: async (req: Request, res: Response) => {
    try {
      const { q = '', page = 1, limit = 12, mode = 'ALL' } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const search = String(q).trim();
      
      const textFilter: Prisma.ClientBWhereInput = search ? {
        OR: [
            { name: { contains: search, mode: 'insensitive' } }, 
            { phone: { contains: search } }, 
            { ice: { contains: search } }
        ]
      } : {};
      
      const whereClause: Prisma.ClientBWhereInput = { ...textFilter, ...(mode === 'DEBT' ? { balance: { gt: 0.1 } } : {}) };
      
      const [total, clients, debtStats] = await Promise.all([
        prismaInternal.clientB.count({ where: whereClause }),
        prismaInternal.clientB.findMany({ 
            where: whereClause, 
            take: Number(limit), 
            skip: skip, 
            orderBy: mode === 'DEBT' ? { balance: 'desc' } : { name: 'asc' }, 
            include: { _count: { select: { movements: true } } } 
        }),
        prismaInternal.clientB.aggregate({ _sum: { balance: true }, where: { balance: { gt: 0 } } })
      ]);
      
      const safeClients = clients.map(c => ({ ...c, balance: c.balance.toNumber(), totalSpent: c.totalSpent.toNumber() }));
      res.json({ data: safeClients, meta: { total, page: Number(page), pages: Math.ceil(total / Number(limit)), globalDebt: debtStats._sum.balance?.toNumber() || 0 } });
    } catch (e) { res.status(500).json({ error: "Erreur recherche clients" }); }
  },

  getClientDetails: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const client = await prismaInternal.clientB.findUnique({ where: { id }, include: { _count: { select: { movements: true } } } });
      if (!client) return res.status(404).json({ error: "Client introuvable" });

      // 🛡️ THE SHIELD: Calculate Volume D'Achats strictly from REAL sales, entirely ignoring Legacy Debt injections.
      const stats = await prismaInternal.stockMovement.aggregate({ 
          where: { 
              clientId: id, 
              type: { in: ['SALE_CASH', 'SALE_CREDIT', 'RETURN'] },
              snapshotProductName: { not: { contains: '[REPRISE DE DETTE]' } } // <--- Blocks Debt from inflating Sales
          }, 
          _sum: { amount: true }, 
          _max: { createdAt: true } 
      });

      res.json({ profile: { ...client, balance: client.balance.toNumber() }, stats: { totalSpent: stats._sum.amount?.toNumber() || 0, lastPurchase: stats._max.createdAt, transactionCount: client._count.movements } });
    } catch (e) { res.status(500).json({ error: "Erreur profil" }); }
  },

  getClientHistory: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20, type } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const whereClause: Prisma.StockMovementWhereInput = { clientId: id, ...(type ? { type: type as MovementType } : {}) };

      const [total, movements] = await Promise.all([
        prismaInternal.stockMovement.count({ where: whereClause }),
        prismaInternal.stockMovement.findMany({
          where: whereClause, take: Number(limit), skip: skip, orderBy: { createdAt: 'desc' },
          include: { product: { select: { name: true, internalSku: true, measureUnit: true } } }
        })
      ]);

      const history = movements.map(m => {
        let finalName = m.snapshotProductName || m.product?.name || 'Article Inconnu';
        if (m.type === 'PAYMENT') finalName = `Règlement (${m.paymentMethod})`;
        if (m.type === 'SALE_CASH' || m.type === 'SALE_CREDIT') finalName = `Vente Comptoir - ${finalName}`;

        return {
            id: m.id, date: m.createdAt, type: m.type, productName: finalName, 
            sku: m.product?.internalSku || '-', quantity: m.quantity, measureUnit: m.product?.measureUnit || 'UNIT',
            amount: Math.abs(m.amount?.toNumber() ?? 0), 
            paid: m.paidAmount?.toNumber() ?? 0, 
            returnedQuantity: m.returnedQuantity || 0, 
            paymentMethod: m.paymentMethod, paymentRef: m.paymentRef || null
        };
      });
      res.json({ data: history, meta: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
    } catch (e) { res.status(500).json({ error: "Erreur historique" }); }
  },

  getClientStatement: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const client = await prismaInternal.clientB.findUnique({ where: { id } });
          if (!client) return res.status(404).json({ error: "Client introuvable" });

          const allMovements = await prismaInternal.stockMovement.findMany({
              where: { clientId: id, type: { in: [MovementType.SALE_CASH, MovementType.SALE_CREDIT, MovementType.RETURN, MovementType.PAYMENT] } }
          });

          const history = allMovements.map(m => {
              const amount = toNumber(m.amount);
              const isDebit = m.type === 'SALE_CASH' || m.type === 'SALE_CREDIT';
              
              const debit = isDebit ? Math.abs(amount) : 0;
              const credit = !isDebit ? Math.abs(amount) : 0;

              // Visually separate Legacy Debt in the PDF statement
              const isLegacyDebt = m.snapshotProductName?.includes('[REPRISE DE DETTE]');

              return {
                  date: m.createdAt,
                  type: isLegacyDebt ? 'REPRISE DETTE' : (m.type === 'PAYMENT' ? 'PAIEMENT' : m.type === 'RETURN' ? 'RETOUR' : 'VENTE'),
                  ref: m.paymentRef || m.snapshotProductName || 'Transaction',
                  debit,
                  credit
              };
          });

          history.sort((a, b) => {
              const timeA = new Date(a.date).getTime();
              const timeB = new Date(b.date).getTime();
              if (timeA === timeB) return b.debit - a.debit;
              return timeA - timeB;
          });

          let runningBalance = 0;
          const statement = history.map(item => {
              const rBalanceCents = Math.round(runningBalance * 100);
              const debitCents = Math.round(item.debit * 100);
              const creditCents = Math.round(item.credit * 100);
              runningBalance = (rBalanceCents + debitCents - creditCents) / 100;
              return { ...item, balance: runningBalance };
          });

          res.json({ client, statement, finalBalance: runningBalance });
      } catch (error) { res.status(500).json({ error: "Erreur génération relevé" }); }
  },

  registerPayment: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { amount, method, ref, note, movementId } = req.body;
      const rawUserId = (req as any).user?.id;
      const payAmount = new Prisma.Decimal(amount);

      if (!amount || payAmount.lte(0)) return res.status(400).json({ error: "Montant invalide" });

      await prismaInternal.$transaction(async (tx) => {
          const userExists = await tx.user.findUnique({ where: { id: rawUserId } });
          const safeUserId = userExists ? rawUserId : null;

          const anyProduct = await tx.productB.findFirst();
          if (!anyProduct) throw new Error("Veuillez créer au moins un produit pour initialiser les mouvements.");

          await tx.stockMovement.create({
              data: { 
                  type: MovementType.PAYMENT, clientId: id, userId: safeUserId,
                  amount: payAmount.negated(), paidAmount: payAmount, quantity: 0, 
                  productId: anyProduct.id, snapshotProductName: note || `Règlement Dette (${method})`,
                  paymentMethod: method, paymentRef: ref
              }
          });

          await tx.clientB.update({ where: { id }, data: { balance: { decrement: payAmount } } });

          if (movementId) {
              await tx.stockMovement.update({ where: { id: movementId }, data: { paidAmount: { increment: payAmount } } });
          } else {
              let remaining = payAmount;
              const unpaid = await tx.stockMovement.findMany({
                  where: { clientId: id, type: { in: ['SALE_CASH', 'SALE_CREDIT'] } },
                  orderBy: { createdAt: 'asc' }
              });
              
              for (const ticket of unpaid) {
                  if (remaining.lte(0)) break;
                  
                  const ticketAmount = ticket.amount || new Prisma.Decimal(0);
                  const ticketPaid = ticket.paidAmount || new Prisma.Decimal(0);
                  const returnedQty = ticket.returnedQuantity || 0;
                  const qty = ticket.quantity || 1;
                  
                  const returnedRatio = new Prisma.Decimal(returnedQty).div(qty);
                  const returnedValue = ticketAmount.mul(returnedRatio);
                  
                  const effectiveAmount = ticketAmount.sub(returnedValue);
                  const due = effectiveAmount.sub(ticketPaid);
                  
                  if (due.gt(0)) {
                      const toApply = remaining.gte(due) ? due : remaining;
                      await tx.stockMovement.update({ where: { id: ticket.id }, data: { paidAmount: { increment: toApply } } });
                      remaining = remaining.sub(toApply);
                  }
              }
          }
      });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message || "Erreur paiement" }); }
  },

  createClient: async (req: Request, res: Response) => {
    try {
      const { name, phone, ice, address } = req.body;
      const cleanName = name?.trim();
      if (!cleanName) return res.status(400).json({ error: "Le nom est obligatoire" });

      const existingName = await prismaInternal.clientB.findFirst({ where: { name: { equals: cleanName, mode: 'insensitive' } } });
      if (existingName) return res.status(400).json({ error: "Un client avec ce nom existe déjà." });

      if (phone?.trim()) { 
          const existingPhone = await prismaInternal.clientB.findFirst({ where: { phone: phone.trim() } }); 
          if (existingPhone) return res.status(400).json({ error: `Ce numéro est utilisé par ${existingPhone.name}` }); 
      }
      
      if (ice?.trim()) { 
          const existingIce = await prismaInternal.clientB.findFirst({ where: { ice: ice.trim() } }); 
          if (existingIce) return res.status(400).json({ error: `Cet ICE est utilisé par ${existingIce.name}` }); 
      }

      const client = await prismaInternal.clientB.create({ 
          data: { name: cleanName, phone: phone?.trim(), ice: ice?.trim(), address: address?.trim(), balance: 0, totalSpent: 0 } 
      });
      res.json(client);
    } catch (e) { res.status(500).json({ error: "Erreur création client" }); }
  },

  updateClient: async (req: Request, res: Response) => { 
      try { 
          const { id } = req.params; const { name, phone, ice, address } = req.body; 
          await prismaInternal.clientB.update({ where: { id }, data: { name: name?.trim(), phone: phone?.trim(), ice: ice?.trim(), address: address?.trim() } }); 
          res.json({ success: true }); 
      } catch (e) { res.status(500).json({ error: "Erreur modification" }); } 
  },

  deleteClient: async (req: Request, res: Response) => { 
      try { 
          const { id } = req.params; const client = await prismaInternal.clientB.findUnique({ where: { id } }); 
          if (client && client.balance.toNumber() > 1) return res.status(400).json({ error: "Impossible de supprimer: Dette active." }); 
          await prismaInternal.clientB.delete({ where: { id } }); 
          res.json({ success: true }); 
      } catch (e) { res.status(500).json({ error: "Erreur suppression" }); } 
  },

  // 🛡️ THE DECOUPLING FIX
  importLegacyDebt: async (req: Request, res: Response) => {
      try {
          const { id } = req.params; 
          const { amount, note, legacyRef, issuedAt } = req.body;
          const rawUserId = (req as any).user?.id;
          
          const debtAmount = new Prisma.Decimal(amount);
          if (debtAmount.lte(0)) return res.status(400).json({ error: "Montant invalide" });

          const movementDate = issuedAt ? new Date(issuedAt) : new Date();

          await prismaInternal.$transaction(async (tx) => {
              const client = await tx.clientB.findUnique({ where: { id } });
              if (!client) throw new Error("Client introuvable");

              const userExists = rawUserId ? await tx.user.findUnique({ where: { id: rawUserId } }) : null;
              const safeUserId = userExists ? rawUserId : null;

              const anyProduct = await tx.productB.findFirst();
              if (!anyProduct) throw new Error("Veuillez créer au moins un produit dans le système avant d'importer une dette.");

              await tx.stockMovement.create({
                  data: {
                      type: MovementType.SALE_CREDIT,
                      clientId: id,
                      userId: safeUserId,
                      productId: anyProduct.id,
                      quantity: 0, 
                      amount: debtAmount,
                      paidAmount: new Prisma.Decimal(0),
                      paymentMethod: 'CREDIT',
                      paymentRef: legacyRef || 'DETTE-ANCIENNE',
                      snapshotProductName: `[REPRISE DE DETTE] ${note || 'Solde Antérieur'}`,
                      snapshotPurchaseCost: new Prisma.Decimal(0),
                      snapshotSellingPrice: debtAmount,
                      createdAt: movementDate 
                  }
              });

              // 🚨 FIX: We ONLY increment the Balance (Debt). 
              // We explicitly DO NOT touch totalSpent so it doesn't inflate Volume d'Achats.
              await tx.clientB.update({
                  where: { id },
                  data: {
                      balance: { increment: debtAmount }
                  }
              });
          });

          res.json({ success: true });
      } catch (e: any) {
          res.status(500).json({ error: e.message || "Erreur lors de l'importation de la dette" });
      }
  }
};