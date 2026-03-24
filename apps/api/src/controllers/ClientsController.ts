// apps/api/src/controllers/ClientsController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { v4 as uuidv4 } from 'uuid'; 

const toNumber = (val: any) => val ? Number(val) : 0;

// 🛡️ PRECISION FINANCIAL CALCULATOR
const calculateFinancials = (docs: any[]) => {
    let volumeCents = 0; 
    let grossDebtCents = 0; 
    let availableCreditCents = 0; 

    docs.forEach(doc => {
        // 🛑 IGNORE CANCELLED OR REJECTED
        if (['ANNULEE', 'CANCELLED', 'REJETE'].includes(doc.status)) return;

        const total = Math.round(toNumber(doc.totalTTC) * 100);
        const paid = Math.round(toNumber(doc.amountPaid) * 100);
        const remaining = total - paid;

        if (doc.type === 'FACTURE') {
            volumeCents += total;
            
            // 🛑 CRITICAL FIX: 'AVOIR_EMIS' means the invoice was turned into a Credit Note.
            // It is no longer a debt. It is neutralized.
            if (doc.status !== 'PAYEE' && doc.status !== 'PAID' && doc.status !== 'AVOIR_EMIS' && remaining > 1) {
                grossDebtCents += remaining;
            }
        } 
        else if (doc.type === 'AVOIR') {
            volumeCents -= total; // Reduces global volume
            
            // Credit is available if NOT paid/consumed and has remaining balance
            if (doc.status !== 'PAYEE' && doc.status !== 'PAID' && remaining > 1) {
                availableCreditCents += remaining;
            }
        }
    });

    return { 
        volume: volumeCents / 100, 
        grossDebt: grossDebtCents / 100, 
        availableCredit: availableCreditCents / 100 
    };
};

export const ClientsController = {
  
  // 🔍 LIST LEGAL CLIENTS
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
                  where: { status: { notIn: ['ANNULEE', 'CANCELLED'] } }, 
                  select: { type: true, status: true, totalTTC: true, amountPaid: true } 
              }
          }
      });

      const data = rawClients.map((c: any) => {
          const fins = calculateFinancials(c.invoices);
          // Net Debt = Invoice Debt - Unused Credit Notes
          const netDebt = Math.max(0, fins.grossDebt - fins.availableCredit);
          
          const { invoices, ...cleanClient } = c;
          return { 
              ...cleanClient, 
              debt: netDebt,
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

  // ⚡ LEGAL PROFILE VIEW
  getClientDetailsGlobal: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const clientA = await prismaLegal.clientA.findUnique({ where: { id } });

          if (!clientA) return res.status(404).json({ error: "Client légal introuvable" });

          const legalDocs = await prismaLegal.invoice.findMany({
              where: { 
                  clientId: id, 
                  status: { notIn: ['ANNULEE', 'CANCELLED'] } 
              },
              select: { type: true, status: true, totalTTC: true, amountPaid: true }
          });

          const fins = calculateFinancials(legalDocs);
          const netLegalDebt = Math.max(0, fins.grossDebt - fins.availableCredit);

          res.json({
              profile: {
                  id,
                  name: clientA.name,
                  phone: clientA.phone,
                  ice: clientA.ice,
                  city: clientA.city,
                  address: clientA.address,
                  balance: netLegalDebt, // 🛑 CRITICAL FIX: Was hardcoded to 0
                  legalDebt: netLegalDebt
              },
              stats: {
                  currentDebt: netLegalDebt,
                  availableCredit: fins.availableCredit,
                  internalDebt: 0,
                  legalInvoiced: fins.volume,
                  internalSpent: 0,
                  totalVolume: fins.volume,
                  lastPurchase: clientA.createdAt 
              }
          });
      } catch (e) { res.status(500).json({ error: "Erreur chargement profil" }); }
  },

  // 📜 LEGAL LEDGER ENGINE (FIXED)
  getClientStatement: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const client = await prismaLegal.clientA.findUnique({ where: { id } });
          if (!client) return res.status(404).json({ error: "Client introuvable" });

          // 1. Fetch Legal Invoices & Avoirs
          const invoices = await prismaLegal.invoice.findMany({
              where: { clientId: id, status: { notIn: ['ANNULEE', 'CANCELLED', 'REJETE'] } },
              select: { id: true, reference: true, type: true, totalTTC: true, issuedAt: true }
          });

          // 2. Fetch Legal Payments tied to these invoices
          const payments = await prismaLegal.payment.findMany({
              where: { invoice: { clientId: id, status: { notIn: ['ANNULEE', 'CANCELLED', 'REJETE'] } } },
              select: { 
                  id: true, amount: true, method: true, reference: true, paidAt: true, 
                  invoice: { select: { reference: true, type: true } } // 🛑 FIX: Fetching Invoice Type
              }
          });

          const history: any[] = [];

          // 3. Map Invoices (Debit) & Avoirs (Credit)
          invoices.forEach(inv => {
              if (inv.type === 'DEVIS') return; // Exclude Quotes
              
              const amount = toNumber(inv.totalTTC);
              if (inv.type === 'FACTURE') {
                  history.push({ date: inv.issuedAt, type: 'FACTURE', ref: inv.reference, debit: amount, credit: 0 });
              } else if (inv.type === 'AVOIR') {
                  history.push({ date: inv.issuedAt, type: 'AVOIR', ref: inv.reference, debit: 0, credit: amount });
              }
          });

          // 4. Map Payments intelligently (Credit vs Refund Debit)
          payments.forEach(pay => {
              const amount = toNumber(pay.amount);
              // If payment is for an AVOIR, it's a cash refund (DEBIT). Otherwise, standard payment (CREDIT).
              const isRefund = pay.invoice?.type === 'AVOIR';
              
              history.push({
                  date: pay.paidAt,
                  type: 'PAIEMENT',
                  ref: pay.reference ? `${pay.method} (${pay.reference})` : pay.method,
                  note: isRefund ? `Remboursement Avoir ${pay.invoice.reference}` : `Règlement Facture ${pay.invoice.reference}`,
                  debit: isRefund ? amount : 0,
                  credit: !isRefund ? amount : 0
              });
          });

          // 5. Sort Chronologically (With Same-Millisecond Safety)
          history.sort((a, b) => {
              const timeA = new Date(a.date).getTime();
              const timeB = new Date(b.date).getTime();
              
              if (timeA === timeB) {
                  // 🛑 CRITICAL FIX: If exact same millisecond, Debits (Factures) always appear before Credits (Payments)
                  return b.debit - a.debit;
              }
              return timeA - timeB;
          });

          // 6. Calculate Running Balance Safely
          let runningBalance = 0;
          const statement = history.map(item => {
              // Convert to cents to avoid floating point math errors
              const rBalanceCents = Math.round(runningBalance * 100);
              const debitCents = Math.round(item.debit * 100);
              const creditCents = Math.round(item.credit * 100);
              
              runningBalance = (rBalanceCents + debitCents - creditCents) / 100;
              
              return { ...item, balance: runningBalance };
          });

          res.json({ client, statement, finalBalance: runningBalance });
      } catch (error) { 
          console.error(error);
          res.status(500).json({ error: "Erreur génération relevé" }); 
      }
  },
  // 📜 LEGAL HISTORY
  getClientHistory: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const page = Number(req.query.page) || 1;
          const limit = Number(req.query.limit) || 15;
          const offset = (page - 1) * limit;
          const typeFilter = String(req.query.type || ''); 

          const legalDocs = await prismaLegal.invoice.findMany({ 
              where: { 
                  clientId: id,
                  ...(typeFilter === 'QUOTE' ? { type: 'DEVIS' } : 
                      typeFilter === 'SALE_CASH' ? { type: 'FACTURE' } : 
                      typeFilter === 'RETURN' ? { type: 'AVOIR' } : {})
              }, 
              include: { payments: true }, 
              orderBy: { issuedAt: 'desc' }, 
              skip: offset,
              take: limit 
          });

          const totalLegal = await prismaLegal.invoice.count({ where: { clientId: id } });

          const normalizedLegal = legalDocs.map((i: any) => {
              let name = `Document #${i.reference || '???'}`;
              if (i.type === 'DEVIS') name = `Devis #${i.reference}`;
              if (i.type === 'AVOIR') name = `Avoir #${i.reference}`;
              if (i.type === 'FACTURE') name = `Facture #${i.reference}`;

              // 🧠 UNIFIED PAYMENT MODE LOGIC
              let mode = 'CRÉDIT';
              
              if (i.status === 'ANNULEE' || i.status === 'CANCELLED') {
                  mode = 'ANNULÉ';
              } else if (i.status === 'AVOIR_EMIS') {
                  mode = 'ANNULÉ (AVOIR)';
              } else if (i.payments && i.payments.length > 0) {
                   const methods = [...new Set(i.payments.map((p: any) => p.method))];
                   mode = methods.map(m => {
                        if (m === 'CHEQUE') return 'CHÈQUE';
                        if (m === 'ESPECES') return 'ESPÈCES';
                        if (m === 'VIREMENT') return 'VIREMENT';
                        if (m === 'LIVRAISON') return 'A LA LIVRAISON';
                        if (m === 'AVOIR') return 'COMPENSATION';
                        return m;
                   }).join(' + ');
              } else if (i.note && i.note.includes('[MODE:LIVRAISON]')) {
                  mode = 'A LA LIVRAISON';
              }

              return {
                  id: i.id, 
                  type: i.type === 'DEVIS' ? 'QUOTE' : i.type === 'AVOIR' ? 'RETURN' : 'SALE_CASH',
                  date: i.issuedAt, 
                  amount: toNumber(i.totalTTC),
                  productName: name,
                  paymentMethod: mode,
                  status: i.status,
                  paid: toNumber(i.amountPaid),
                  quantity: 1, 
                  source: 'LEGAL'
              };
          });

          res.json({ 
              data: normalizedLegal, 
              meta: { page, limit, total: totalLegal, pages: Math.ceil(totalLegal / limit) } 
          });

      } catch (e) { 
          res.status(500).json({ error: "Erreur historique légal" }); 
      }
  },

  createClientGlobal: async (req: Request, res: Response) => {
    try {
      const { name, phone, ice, address, city } = req.body;
      if (!name) return res.status(400).json({ error: "Nom obligatoire" });
      const sharedId = uuidv4();
      await prismaLegal.clientA.create({ data: { id: sharedId, name, ice: ice || null, phone, address, city } });
      res.json({ success: true, id: sharedId }); 
    } catch (e) { res.status(500).json({ error: "Erreur création client" }); }
  },

  updateClientGlobal: async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, phone, ice, address, city } = req.body;
        await prismaLegal.clientA.update({ where: { id }, data: { name, ice, address, city, phone } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erreur mise à jour" }); }
  },

  deleteClientGlobal: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const hasInvoices = await prismaLegal.invoice.count({ where: { clientId: id } });
          if (hasInvoices > 0) return res.status(400).json({ error: "Impossible: Factures légales existantes." });
          await prismaLegal.clientA.delete({ where: { id } }).catch(() => {});
          res.json({ success: true });
      } catch (e) { res.status(500).json({ error: "Erreur suppression" }); }
  }
};