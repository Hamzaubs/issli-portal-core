import { Request, Response } from 'express';
import { prismaInternal, MovementType } from '@marine/db-internal';
import { prismaLegal } from '@marine/db-legal';
import { v4 as uuidv4 } from 'uuid'; 

const toNumber = (val: any) => val ? Number(val) : 0;

const normalize = (str: string | null | undefined) => {
    if (!str) return '';
    return str.toString().trim().replace(/[\s\-\.]+/g, '').toLowerCase();
};

const safeDbCall = async (promise: Promise<any>, fallback: any) => {
    try {
        return await promise;
    } catch (error) {
        console.warn("⚠️ Silo B Sync Warning:", error);
        return fallback;
    }
};

const calculateFinancials = (docs: any[]) => {
    let volume = 0;       
    let grossDebt = 0;    
    let availableCredit = 0; 

    docs.forEach(doc => {
        const total = toNumber(doc.totalTTC);
        const paid = toNumber(doc.amountPaid);
        const remaining = total - paid;

        if (doc.type === 'FACTURE') {
            volume += total;
            if (doc.status !== 'PAYEE') {
                grossDebt += (remaining > 0 ? remaining : 0);
            }
        } 
        else if (doc.type === 'AVOIR') {
            volume -= total;
            if (remaining > 0) {
                availableCredit += remaining;
            }
        }
    });

    return { volume, grossDebt, availableCredit };
};

export const ClientsController = {
  
  // 🔍 LIST GLOBAL CLIENTS (Silo A focused)
  getClients: async (req: Request, res: Response) => {
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
          { phone: { contains: search } }
        ];
      }

      const rawClients = await prismaLegal.clientA.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: 'asc' },
          include: {
              invoices: {
                  where: { status: { not: 'ANNULEE' } }, 
                  select: { type: true, status: true, totalTTC: true, amountPaid: true } 
              }
          }
      });

      const data = rawClients.map((c: any) => {
          const fins = calculateFinancials(c.invoices);
          const { invoices, ...cleanClient } = c;
          return { 
              ...cleanClient, 
              debt: fins.grossDebt,
              credit: fins.availableCredit,
              totalVolume: fins.volume 
          };
      });

      const total = await prismaLegal.clientA.count({ where });

      res.json({
        data,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });

    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erreur chargement clients" });
    }
  },

  // ⚡ SHARED PROFILE VIEW (Merging Silo A & B)
  getClientDetailsGlobal: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const [clientB, clientA] = await Promise.all([
              safeDbCall(prismaInternal.clientB.findUnique({ where: { id } }), null),
              prismaLegal.clientA.findUnique({ where: { id } })
          ]);

          if (!clientB && !clientA) return res.status(404).json({ error: "Client introuvable" });

          const [statsB, legalDocs] = await Promise.all([
              // Fetch movements from Silo B Truth Engine
              safeDbCall(prismaInternal.stockMovement.aggregate({
                  where: { clientId: id, type: { in: [MovementType.SALE_CASH, MovementType.RETURN] } },
                  _sum: { amount: true }
              }), { _sum: { amount: 0 } }),
              
              prismaLegal.invoice.findMany({
                  where: { clientId: id, status: { not: 'ANNULEE' } },
                  select: { type: true, status: true, totalTTC: true, amountPaid: true }
              })
          ]);

          const fins = calculateFinancials(legalDocs);

          res.json({
              profile: {
                  id,
                  name: clientB?.name || clientA?.name || 'Inconnu',
                  phone: clientB?.phone || clientA?.phone,
                  ice: clientA?.ice,
                  balance: toNumber(clientB?.balance) // Internal Truth Balance
              },
              stats: {
                  currentDebt: fins.grossDebt, 
                  internalDebt: toNumber(clientB?.balance),
                  legalInvoiced: fins.volume,
                  internalSpent: toNumber(statsB._sum.amount),
                  totalVolume: fins.volume + toNumber(statsB._sum.amount)
              }
          });
      } catch (e) { res.status(500).json({ error: "Erreur chargement profil" }); }
  },

  // 📜 UNIFIED HISTORY (Corrected for deleted clientPayment table)
  getClientHistory: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const limit = Number(req.query.limit) || 20;
          const cursorDate = req.query.cursor ? new Date(String(req.query.cursor)) : new Date();

          const [rawMovements, rawInvoices] = await Promise.all([
              // Silo B: Now includes SALE, RETURN, and PAYMENT in one query
              safeDbCall(prismaInternal.stockMovement.findMany({ 
                  where: { clientId: id, createdAt: { lt: cursorDate } },
                  include: { product: true }, 
                  orderBy: { createdAt: 'desc' }, 
                  take: limit 
              }), []),
              // Silo A: Legal invoices
              prismaLegal.invoice.findMany({ 
                  where: { clientId: id, issuedAt: { lt: cursorDate } }, 
                  orderBy: { issuedAt: 'desc' }, 
                  take: limit 
              })
          ]);

          const combined = [
              ...rawMovements.map((m: any) => ({
                  id: m.id, 
                  type: m.type === MovementType.PAYMENT ? 'PAIEMENT' : (m.type === MovementType.RETURN ? 'RETOUR' : 'VENTE_INTERNE'),
                  date: m.createdAt, 
                  amount: toNumber(m.amount),
                  ref: m.type === MovementType.PAYMENT ? `Règlement (${m.paymentMethod})` : (m.snapshotProductName || m.product?.name || 'Article'), 
                  source: m.type === MovementType.PAYMENT ? 'PAYMENT' : 'INTERNAL'
              })),
              ...rawInvoices.map((i: any) => ({
                  id: i.id, type: i.type, date: i.issuedAt, amount: toNumber(i.totalTTC),
                  ref: i.reference, status: i.status, source: 'LEGAL'
              }))
          ];

          combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const finalResult = combined.slice(0, limit);
          const nextCursor = finalResult.length === limit ? finalResult[finalResult.length - 1].date : null;
          
          res.json({ data: finalResult, nextCursor });
      } catch (e) { res.status(500).json({ error: "Erreur historique global" }); }
  },

  // 🛡️ CRUD GLOBAL (Keep both databases in sync)
  createClientGlobal: async (req: Request, res: Response) => {
    try {
      const { name, phone, ice, address, city } = req.body;
      if (!name) return res.status(400).json({ error: "Nom obligatoire" });
      
      const sharedId = uuidv4();
      await Promise.all([
        safeDbCall(prismaInternal.clientB.create({ 
            data: { id: sharedId, name, phone, balance: 0, totalSpent: 0 } 
        }), null),
        prismaLegal.clientA.create({ 
            data: { id: sharedId, name, ice: ice || null, phone, address, city } 
        })
      ]);
      res.json({ success: true, id: sharedId }); 
    } catch (e) { res.status(500).json({ error: "Erreur création client" }); }
  },

  updateClientGlobal: async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, phone, ice, address, city } = req.body;
        await Promise.all([
            safeDbCall(prismaInternal.clientB.update({ where: { id }, data: { name, phone } }), null),
            prismaLegal.clientA.update({ where: { id }, data: { name, ice, address, city, phone } })
        ]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erreur mise à jour" }); }
  },

  deleteClientGlobal: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const hasInvoices = await prismaLegal.invoice.count({ where: { clientId: id } });
          if (hasInvoices > 0) return res.status(400).json({ error: "Impossible: Factures légales existantes." });
          
          await Promise.all([
             safeDbCall(prismaInternal.clientB.delete({ where: { id } }), null),
             prismaLegal.clientA.delete({ where: { id } }).catch(() => {})
          ]);
          res.json({ success: true });
      } catch (e) { res.status(500).json({ error: "Erreur suppression" }); }
  }
};