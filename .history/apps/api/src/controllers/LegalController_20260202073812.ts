// apps/api/src/controllers/LegalController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { InvoiceService } from '../services/InvoiceService';

// Helper to calculate debt mathematically (Trust Math, Not Tags)
const calculateDebt = (invoices: any[]) => {
    return invoices.reduce((acc, inv) => {
        // Ignore Cancelled, Refunds, or Quotes
        if (['ANNULEE', 'AVOIR_EMIS', 'DEVIS'].includes(inv.status)) return acc;
        
        const total = Number(inv.totalTTC || 0);
        const paid = Number(inv.amountPaid || 0);
        const remaining = total - paid;
        
        // Only count if remaining debt is significant (> 0.5 MAD)
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
                      // We fetch EVERYTHING except Cancelled to show full history
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
  
  createClient: async (req: Request, res: Response) => { try { const client = await prismaLegal.clientA.create({ data: req.body }); res.json(client); } catch (e) { res.status(400).json({ error: "Impossible de créer le client" }); } },
  updateClient: async (req: Request, res: Response) => { try { await prismaLegal.clientA.update({ where: { id: req.params.id }, data: req.body }); res.json({ success: true }); } catch (e) { res.status(400).json({ error: "Erreur mise à jour" }); } },
  deleteClient: async (req: Request, res: Response) => { try { await prismaLegal.clientA.delete({ where: { id: req.params.id } }); res.json({ success: true }); } catch (e) { res.status(400).json({ error: "Impossible de supprimer" }); } },

  // ==========================================
  // 📊 STATS (ROBUST VERSION)
  // ==========================================
  getStats: async (req: Request, res: Response) => {
      try {
          // 1. Revenue Today (Cash Flow)
          // We set the time to 00:00:00.000 for TODAY
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          const paymentsToday = await prismaLegal.payment.aggregate({
              where: { paidAt: { gte: todayStart } },
              _sum: { amount: true }
          });

          // 2. Total Pending Debt (Math Based)
          // We fetch ALL active invoices (not just 'EN_ATTENTE') to ensure we don't miss anything
          const allActiveInvoices = await prismaLegal.invoice.findMany({
              where: { 
                  type: 'FACTURE', 
                  status: { notIn: ['ANNULEE', 'AVOIR_EMIS'] } // Fetch all potentially unpaid invoices
              },
              select: { totalTTC: true, amountPaid: true, status: true }
          });

          const totalDebt = allActiveInvoices.reduce((acc, inv) => {
              const total = Number(inv.totalTTC || 0);
              const paid = Number(inv.amountPaid || 0);
              const remaining = total - paid;
              // If there is significant debt, add it
              return remaining > 0.5 ? acc + remaining : acc;
          }, 0);

          // 3. Active Quotes
          const activeQuotes = await prismaLegal.invoice.aggregate({
              where: { type: 'DEVIS', status: { not: 'ANNULEE' } }, // Count all active quotes
              _sum: { totalTTC: true },
              _count: true
          });

          res.json({ 
              revenueToday: Number(paymentsToday._sum.amount) || 0,
              totalDebt: Number(totalDebt) || 0,
              quotesVolume: Number(activeQuotes._sum.totalTTC) || 0,
              quotesCount: Number(activeQuotes._count) || 0
          });

      } catch (e) { 
          console.error("Stats Error:", e);
          // Return 0s to prevent crash
          res.json({ revenueToday: 0, totalDebt: 0, quotesVolume: 0, quotesCount: 0 }); 
      }
  },

  // ==========================================
  // 📄 DOCUMENTS (Delegators)
  // ==========================================
  getDocuments: async (req: Request, res: Response) => {
     const result = await prismaLegal.invoice.findMany({ take: 20, orderBy: { issuedAt: 'desc' }, include: { client: true } });
     res.json({ data: result });
  },
  
  getDocumentById: async (req: Request, res: Response) => {
      const { id } = req.params;
      const doc = await prismaLegal.invoice.findUnique({ where: { id }, include: { client: true, items: true, payments: true }});
      res.json(doc);
  },

  createDocument: async (req: Request, res: Response) => { try { res.json(await InvoiceService.createDocument(req.body)); } catch(e: any) { res.status(500).json({ error: e.message }); } },
  convertQuote: async (req: Request, res: Response) => { try { res.json(await InvoiceService.convertQuote(req.params.id)); } catch(e: any) { res.status(400).json({ error: e.message }); } },
  cancelInvoice: async (req: Request, res: Response) => { try { res.json(await InvoiceService.cancelOrCreditNote(req.params.id)); } catch(e: any) { res.status(400).json({ error: e.message }); } },
  createCreditNote: async (req: Request, res: Response) => { try { res.json(await InvoiceService.cancelOrCreditNote(req.params.id)); } catch(e: any) { res.status(400).json({ error: e.message }); } },
  addPayment: async (req: Request, res: Response) => { try { const result = await InvoiceService.addPayment({ invoiceId: req.params.id, amount: req.body.amount, method: req.body.method, note: req.body.note }); res.json(result); } catch(e: any) { res.status(400).json({ error: e.message }); } },
  
  // ==========================================
  // 📦 ASSETS
  // ==========================================
  getAssets: async (req: Request, res: Response) => {
      const products = await prismaLegal.productA.findMany({ 
          where: { quantity: { gt: 0 } }, 
          orderBy: { name: 'asc' } 
      });
      res.json(products);
  }
};