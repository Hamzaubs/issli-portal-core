import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { InvoiceService } from '../services/InvoiceService';

// ✅ SAFE DECIMAL CONVERTER
const toNum = (val: any): number => {
  if (!val) return 0;
  if (typeof val.toNumber === 'function') return val.toNumber();
  return Number(val);
};

// ✅ STRING SANITIZER (Safety Layer)
const cleanStr = (str: any) => str ? String(str).trim().toUpperCase() : null;

// Helper to calculate debt mathematically
const calculateDebt = (invoices: any[]) => {
    return invoices.reduce((acc, inv) => {
        if (['ANNULEE', 'AVOIR_EMIS', 'DEVIS'].includes(inv.status)) return acc;
        
        const total = toNum(inv.totalTTC);
        const paid = toNum(inv.amountPaid);
        const remaining = total - paid;
        
        return remaining > 0.5 ? acc + remaining : acc;
    }, 0);
};

export const LegalController = {

  // ==========================================
  // 👥 CLIENTS
  // ==========================================
  getClients: async (req: Request, res: Response) => {
      try {
          const clients = await prismaLegal.clientA.findMany({ 
              orderBy: { name: 'asc' },
              include: {
                  invoices: {
                      select: { totalTTC: true, amountPaid: true, status: true }
                  }
              }
          });

          const clientsWithStats = clients.map(c => {
              const debt = calculateDebt(c.invoices);
              const { invoices, ...clientData } = c; 
              return { ...clientData, totalDebt: debt };
          });

          res.json(clientsWithStats);
      } catch (e) {
          console.error("Legal Clients Error:", e);
          res.status(500).json({ error: "Erreur lors du chargement des clients" });
      }
  },
  
  getClientDetails: async (req: Request, res: Response) => {
      try {
          const client = await prismaLegal.clientA.findUnique({ 
              where: { id: req.params.id }, 
              include: { 
                  invoices: {
                      orderBy: { issuedAt: 'desc' },
                      where: { status: { not: 'ANNULEE' } } 
                  } 
              } 
          });
          
          if (!client) return res.status(404).json({ error: "Client introuvable" });

          const debt = calculateDebt(client.invoices);
          res.json({ ...client, totalDebt: debt });
      } catch (e) {
          res.status(500).json({ error: "Erreur détail client" });
      }
  },
  
  // 🛡️ NEW ROBUST CREATE METHOD
  createClient: async (req: Request, res: Response) => { 
    try { 
        // 1. Sanitize Inputs
        const name = cleanStr(req.body.name);
        const ice = req.body.ice ? String(req.body.ice).trim() : null; // ICE is numbers only usually
        const rc = cleanStr(req.body.rc);
        const if_tax = cleanStr(req.body.if);
        const city = cleanStr(req.body.city);
        const address = req.body.address ? String(req.body.address).trim() : null;
        const phone = req.body.phone ? String(req.body.phone).trim() : null;

        if (!name) return res.status(400).json({ error: "Le nom du client est obligatoire." });

        // 2. Security Check: Duplicate Name
        const existingName = await prismaLegal.clientA.findFirst({ where: { name } });
        if (existingName) {
            return res.status(409).json({ error: `Le client "${name}" existe déjà.` });
        }

        // 3. Security Check: Duplicate ICE
        if (ice) {
            const existingIce = await prismaLegal.clientA.findUnique({ where: { ice } });
            if (existingIce) {
                return res.status(409).json({ error: `Ce numéro ICE est déjà utilisé par "${existingIce.name}".` });
            }
        }

        // 4. Create
        const client = await prismaLegal.clientA.create({ 
            data: { name, ice, rc, if: if_tax, city, address, phone } 
        }); 
        
        res.json(client); 
    } catch (e: any) { 
        console.error("Create Client Error:", e);
        // Fallback for unexpected errors
        res.status(500).json({ error: e.message || "Impossible de créer le client." }); 
    } 
  },

  // 🛡️ SECURE UPDATE METHOD
  updateClient: async (req: Request, res: Response) => { 
      try { 
          const { id } = req.params;
          const data = req.body;
          
          // 1. Sanitize Inputs (Same as Create)
          if (data.name) data.name = cleanStr(data.name);
          if (data.city) data.city = cleanStr(data.city);
          if (data.ice) data.ice = String(data.ice).trim();
          if (data.rc) data.rc = cleanStr(data.rc);
          if (data.if) data.if = cleanStr(data.if);

          // 2. Security Check: Duplicate ICE on Update
          // We must check if the new ICE is used by someone ELSE (not self)
          if (data.ice) {
              const duplicate = await prismaLegal.clientA.findFirst({
                  where: { 
                      ice: data.ice,
                      id: { not: id } // Important: Ignore self!
                  }
              });
              if (duplicate) {
                  return res.status(409).json({ error: `Ce numéro ICE est déjà utilisé par "${duplicate.name}".` });
              }
          }

          await prismaLegal.clientA.update({ where: { id }, data }); 
          res.json({ success: true }); 
      } catch (e: any) {
          console.error("Update Client Error:", e);
          if (e.code === 'P2002') {
             return res.status(409).json({ error: "Ce numéro ICE ou Nom existe déjà." });
          }
          res.status(400).json({ error: "Erreur lors de la mise à jour." }); 
      } 
  },

  deleteClient: async (req: Request, res: Response) => { 
      try { 
           // 🛡️ Integrity Check
          const count = await prismaLegal.invoice.count({ where: { clientId: req.params.id } });
          if (count > 0) return res.status(400).json({ error: "Impossible: Ce client possède des factures." });

          await prismaLegal.clientA.delete({ where: { id: req.params.id } }); 
          res.json({ success: true }); 
      } catch (e) { 
          res.status(400).json({ error: "Impossible de supprimer" }); 
      } 
  },

  // ==========================================
  // 📊 STATS (PRESERVED)
  // ==========================================
  getStats: async (req: Request, res: Response) => {
      try {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          
          const year = Number(req.query.year) || new Date().getFullYear();
          const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
          const yearEnd = new Date(`${year}-12-31T23:59:59.999Z`);

          // 1. 🛡️ REVENUE TODAY (Fixed Compensation & Refund Bug)
          const todayPayments = await prismaLegal.payment.findMany({
              where: { paidAt: { gte: todayStart } },
              include: { invoice: { select: { type: true } } }
          });
          
          let revenueToday = 0;
          todayPayments.forEach(p => {
              const method = String(p.method).toUpperCase();
              if (method === 'COMPENSATION' || method === 'AVOIR') return; // Ignore virtual money
              
              const amt = toNum(p.amount);
              if (p.invoice?.type === 'AVOIR') revenueToday -= amt; // Subtract Refunds
              else revenueToday += amt; // Add real payments
          });

          // 2. 🧠 MEMORY-SAFE DEBT ENGINE (SQL Level Aggregation)
          const debtAgg = await prismaLegal.invoice.aggregate({
              where: { 
                  type: 'FACTURE', 
                  status: { in: ['EN_ATTENTE', 'PAYEE_PARTIELLEMENT', 'PARTIEL', 'AVOIR_PARTIEL'] } 
              },
              _sum: { totalTTC: true, amountPaid: true }
          });
          
          const globalFactureDebt = toNum(debtAgg._sum.totalTTC) - toNum(debtAgg._sum.amountPaid);
          const totalDebt = Math.max(0, globalFactureDebt);

          // 3. 📝 QUOTES PIPELINE
          const activeQuotes = await prismaLegal.invoice.aggregate({
              where: { type: 'DEVIS', status: { not: 'ANNULEE' } }, 
              _sum: { totalTTC: true },
              _count: true
          });

          // 4. 📈 MONTHLY ANALYTICS (Charts & Margins)
          const yearInvoices = await prismaLegal.invoice.findMany({
              where: { issuedAt: { gte: yearStart, lte: yearEnd }, status: { not: 'ANNULEE' } },
              select: { issuedAt: true, type: true, totalHT: true, totalTTC: true, items: { select: { quantity: true, unitPurchaseCostSnapshot: true } } }
          });

          let yearlyHT = 0; let yearlyTTC = 0; let yearlyCost = 0;
          const monthlyStats = Array(12).fill(0).map(() => ({ revenueHT: 0, revenueTTC: 0, margin: 0 }));

          yearInvoices.forEach(inv => {
              const month = inv.issuedAt.getMonth();
              const ht = toNum(inv.totalHT);
              const ttc = toNum(inv.totalTTC);
              
              let docCost = 0;
              inv.items.forEach(i => { docCost += toNum(i.quantity) * toNum(i.unitPurchaseCostSnapshot); });

              if (inv.type === 'FACTURE') {
                  yearlyHT += ht; yearlyTTC += ttc; yearlyCost += docCost;
                  monthlyStats[month].revenueHT += ht;
                  monthlyStats[month].revenueTTC += ttc;
                  monthlyStats[month].margin += (ht - docCost);
              } else if (inv.type === 'AVOIR') {
                  yearlyHT -= ht; yearlyTTC -= ttc; yearlyCost -= docCost;
                  monthlyStats[month].revenueHT -= ht;
                  monthlyStats[month].revenueTTC -= ttc;
                  monthlyStats[month].margin -= (ht - docCost);
              }
          });

          const yearlyMargin = yearlyHT - yearlyCost;

          res.json({ 
              kpi: {
                  revenueToday: Number(revenueToday.toFixed(2)),
                  totalDebt: Number(totalDebt.toFixed(2)),
                  quotesVolume: toNum(activeQuotes._sum.totalTTC),
                  quotesCount: Number(activeQuotes._count),
                  yearlyHT: Number(yearlyHT.toFixed(2)),
                  yearlyTTC: Number(yearlyTTC.toFixed(2)),
                  yearlyMargin: Number(yearlyMargin.toFixed(2)),
                  marginRate: yearlyHT > 0 ? Number(((yearlyMargin / yearlyHT) * 100).toFixed(1)) : 0
              },
              charts: { monthly: monthlyStats }
          });

      } catch (e) { 
          console.error("Stats Error:", e);
          res.status(500).json({ error: "Erreur Analytics Silo A" });
      }
  },

  // ==========================================
  // 📄 DOCUMENTS (PRESERVED)
  // ==========================================
  getDocuments: async (req: Request, res: Response) => {
      try {
        const result = await prismaLegal.invoice.findMany({ 
            take: 20, 
            orderBy: { issuedAt: 'desc' }, 
            include: { client: true } 
        });
        
        const safeResult = result.map(doc => ({
            ...doc,
            totalHT: toNum(doc.totalHT),
            totalTTC: toNum(doc.totalTTC),
            amountPaid: toNum(doc.amountPaid)
        }));
        
        res.json({ data: safeResult });
      } catch (e) {
          console.error("Get Documents Error:", e);
          res.status(500).json({ error: "Erreur chargement documents" });
      }
  },
  
  getDocumentById: async (req: Request, res: Response) => {
      const { id } = req.params;
      const doc = await prismaLegal.invoice.findUnique({ 
          where: { id }, 
          include: { client: true, items: true, payments: true }
      });
      if (!doc) return res.status(404).json({ error: "Document introuvable" });
      res.json(doc);
  },

  createDocument: async (req: Request, res: Response) => { try { res.json(await InvoiceService.createDocument(req.body)); } catch(e: any) { res.status(500).json({ error: e.message }); } },
  convertQuote: async (req: Request, res: Response) => { try { res.json(await InvoiceService.convertQuote(req.params.id)); } catch(e: any) { res.status(400).json({ error: e.message }); } },
  cancelInvoice: async (req: Request, res: Response) => { try { res.json(await InvoiceService.cancelOrCreditNote(req.params.id)); } catch(e: any) { res.status(400).json({ error: e.message }); } },
  createCreditNote: async (req: Request, res: Response) => { try { res.json(await InvoiceService.cancelOrCreditNote(req.params.id)); } catch(e: any) { res.status(400).json({ error: e.message }); } },
  addPayment: async (req: Request, res: Response) => { try { const result = await InvoiceService.addPayment({ invoiceId: req.params.id, amount: req.body.amount, method: req.body.method, note: req.body.note }); res.json(result); } catch(e: any) { res.status(400).json({ error: e.message }); } },
  
  // ==========================================
  // 📦 ASSETS (PRESERVED)
  // ==========================================
  getAssets: async (req: Request, res: Response) => {
      const products = await prismaLegal.productA.findMany({ 
          where: { quantity: { gt: 0 } }, 
          orderBy: { name: 'asc' } 
      });
      const safeProducts = products.map(p => ({
          ...p,
          priceHT: toNum(p.priceHT),
          purchaseCost: toNum(p.purchaseCost),
          vatRate: toNum(p.vatRate)
      }));
      res.json(safeProducts);
  }
};