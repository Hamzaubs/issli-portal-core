import { Request, Response } from 'express';
import { prismaInternal } from '@marine/db-internal';
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
        console.warn("⚠️ Silo B Warning:", error);
        return fallback;
    }
};

// 🧠 CORE LOGIC: Strict Separation (No more "Mixing")
const calculateFinancials = (docs: any[]) => {
    let volume = 0;       
    let grossDebt = 0;    
    let availableCredit = 0; 

    docs.forEach(doc => {
        const total = toNumber(doc.totalTTC);
        const paid = toNumber(doc.amountPaid);
        const remaining = total - paid;

        if (doc.type === 'FACTURE') {
            // Volume: Add to total sales
            volume += total;
            
            // Debt: Strictly Unpaid Invoices. 
            // We do NOT subtract Avoirs from this. This is the "Gross Debt".
            if (doc.status !== 'PAYEE') {
                grossDebt += (remaining > 0 ? remaining : 0);
            }
        } 
        else if (doc.type === 'AVOIR') {
            // Volume: Subtract returns from total volume
            volume -= total;
            
            // Credit: This is money we owe the client (or can be applied to future invoices).
            // We track this separately so it doesn't magically lower the debt on screen.
            if (remaining > 0) {
                availableCredit += remaining;
            }
        }
    });

    return { 
        volume: volume, // Allow negative volume if they returned more than they bought (Math correctness)
        grossDebt,      // Money THEY owe US
        availableCredit // Money WE owe THEM
    };
};

export const ClientsController = {
  
  // 🔍 LIST CLIENTS
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
          { phone: { contains: search } },
          { city: { contains: search, mode: 'insensitive' } }
        ];
      }

      // 1. FILTER: Exclude 'ANNULEE'. Cancelled docs should not exist in math.
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

      // 2. MAP
      const data = rawClients.map((c: any) => {
          const fins = calculateFinancials(c.invoices);
          const { invoices, ...cleanClient } = c;
          return { 
              ...cleanClient, 
              debt: fins.grossDebt,      // Send Gross Debt as main 'debt'
              credit: fins.availableCredit, // Send Credit separately
              totalVolume: fins.volume 
          };
      });

      const total = await prismaLegal.clientA.count({ where });

      res.json({
        data,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });

    } catch (e: any) {
      console.error("Get Clients Error:", e);
      res.status(500).json({ error: "Erreur chargement clients" });
    }
  },

  // ... (createClientGlobal and updateClientGlobal remain unchanged)
  createClientGlobal: async (req: Request, res: Response) => {
    try {
      const { name, phone, ice, address, city, category, notes } = req.body;
      if (!name) return res.status(400).json({ error: "Nom obligatoire" });
      const orConditions: any[] = [{ name: { equals: name, mode: 'insensitive' } }];
      if (ice && ice.length > 2) orConditions.push({ ice: { equals: ice } }); 
      const normPhone = normalize(phone);
      if (normPhone.length > 8) orConditions.push({ phone: { contains: normPhone } });
      const existing = await prismaLegal.clientA.findFirst({ where: { OR: orConditions } });
      if (existing) return res.status(400).json({ error: `Client existant: ${existing.name}` });
      const sharedId = uuidv4();
      await Promise.all([
        safeDbCall(prismaInternal.clientB.create({ 
            data: { id: sharedId, name, phone, category: category || 'STANDARD', notes, balance: 0 } 
        }), null),
        prismaLegal.clientA.create({ 
            data: { id: sharedId, name, ice: ice || null, phone, address, city } 
        })
      ]);
      res.json({ success: true, id: sharedId }); 
    } catch (e: any) { res.status(500).json({ error: "Erreur serveur création" }); }
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

  // ⚡ PROFILE VIEW
  getClientDetailsGlobal: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const [clientB, clientA] = await Promise.all([
              safeDbCall(prismaInternal.clientB.findUnique({ where: { id } }), null),
              prismaLegal.clientA.findUnique({ where: { id } })
          ]);

          if (!clientB && !clientA) return res.status(404).json({ error: "Client introuvable" });

          const [statsB, legalDocs] = await Promise.all([
              safeDbCall(prismaInternal.stockMovement.aggregate({
                  where: { clientId: id, type: { in: ['SALE_CASH', 'QUOTE', 'RETURN'] } },
                  _sum: { amount: true }
              }), { _sum: { amount: 0 } }),
              
              prismaLegal.invoice.findMany({
                  where: { clientId: id, status: { not: 'ANNULEE' } },
                  select: { type: true, status: true, totalTTC: true, amountPaid: true }
              })
          ]);

          const fins = calculateFinancials(legalDocs);
          const internalDebt = toNumber(clientB?.balance);

          res.json({
              profile: {
                  id,
                  name: clientB?.name || clientA?.name || 'Inconnu',
                  phone: clientB?.phone || clientA?.phone,
                  ice: clientA?.ice,
                  address: clientA?.address,
                  city: clientA?.city,
                  balance: fins.grossDebt // Profile shows GROSS debt
              },
              matchFound: !!(clientB && clientA),
              legalClient: clientA,
              stats: {
                  currentDebt: fins.grossDebt,     // Debt = What they owe
                  credit: fins.availableCredit,    // Credit = What we owe them
                  internalDebt: internalDebt,
                  legalInvoiced: fins.volume,
                  internalSpent: toNumber(statsB._sum.amount),
                  totalVolume: fins.volume + toNumber(statsB._sum.amount)
              }
          });
      } catch (e) { res.status(500).json({ error: "Erreur chargement profil" }); }
  },

  // ... (History and Delete remain unchanged)
  getClientHistory: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const limit = Number(req.query.limit) || 20;
          const cursorDate = req.query.cursor ? new Date(String(req.query.cursor)) : new Date();
          const [rawMovements, rawInvoices, rawPayments] = await Promise.all([
              safeDbCall(prismaInternal.stockMovement.findMany({ 
                  where: { clientId: id, createdAt: { lt: cursorDate }, type: { in: ['SALE_CASH', 'QUOTE', 'RETURN'] } },
                  include: { product: true }, orderBy: { createdAt: 'desc' }, take: limit 
              }), []),
              prismaLegal.invoice.findMany({ 
                  where: { clientId: id, issuedAt: { lt: cursorDate } }, 
                  orderBy: { issuedAt: 'desc' }, take: limit 
              }),
              safeDbCall(prismaInternal.clientPayment.findMany({ 
                  where: { clientId: id, createdAt: { lt: cursorDate } }, 
                  orderBy: { createdAt: 'desc' }, take: limit 
              }), [])
          ]);
          const combined = [
              ...rawMovements.map((m: any) => ({
                  id: m.id, type: m.type === 'RETURN' ? 'RETOUR' : 'VENTE_INTERNE',
                  date: m.createdAt, amount: toNumber(m.amount),
                  ref: m.snapshotProductName || m.product?.name || 'Article', source: 'INTERNAL'
              })),
              ...rawInvoices.map((i: any) => ({
                  id: i.id, type: i.type, date: i.issuedAt, amount: toNumber(i.totalTTC),
                  ref: i.reference, status: i.status, source: 'LEGAL'
              })),
              ...rawPayments.map((p: any) => ({
                  id: p.id, type: 'PAIEMENT', date: p.createdAt, amount: toNumber(p.amount),
                  ref: p.method, note: p.note, source: 'PAYMENT'
              }))
          ];
          combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const finalResult = combined.slice(0, limit);
          const nextCursor = finalResult.length === limit ? finalResult[finalResult.length - 1].date : null;
          res.json({ data: finalResult, nextCursor });
      } catch (e) { res.status(500).json({ error: "Erreur historique" }); }
  },
  deleteClientGlobal: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const hasInvoices = await prismaLegal.invoice.count({ where: { clientId: id } });
          if (hasInvoices > 0) return res.status(400).json({ error: "Impossible: Client a des factures légales." });
          await Promise.all([
             safeDbCall(prismaInternal.clientB.delete({ where: { id } }), null),
             prismaLegal.clientA.delete({ where: { id } }).catch(() => {})
          ]);
          res.json({ success: true });
      } catch (e) { res.status(500).json({ error: "Erreur suppression" }); }
  }
};