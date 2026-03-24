// apps/api/src/controllers/LegalReportController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { Prisma } from '@prisma/client-legal';

// Helper: Safe Decimal Conversion
const toDec = (val: any): Prisma.Decimal => new Prisma.Decimal(val || 0);

// Helper: Round & Format for French Excel (1234.56 -> "1234,56")
const formatExcelNum = (val: Prisma.Decimal | number) => {
    const num = typeof val === 'number' ? val : val.toNumber();
    return (Math.round(num * 100) / 100).toString().replace('.', ',');
};

// Helper: Format Date (DD/MM/YYYY)
const fmtDate = (d: Date) => d.toLocaleDateString('fr-MA');

// Helper: Clean Strings (No semicolons/newlines)
const clean = (str: any) => String(str || "").replace(/;/g, " ").replace(/\n/g, " ").trim();

export const LegalReportController = {

  // 📊 ANALYTICS (Dashboard Data)
  getAnalytics: async (req: Request, res: Response) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
      const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

      // ( ... Keep existing Analytics Logic unchanged ... )
      // To save space in this message, assume the previous Analytics logic is here.
      // If you need me to repost the full Analytics logic block, let me know. 
      // For now, I focus on the CSV Export function below.
      
      // ... [Insert Previous Analytics Logic Here] ...
      
      // Placeholder for compilation if you copy-paste (remove this block if merging):
      res.json({ message: "Analytics logic remains the same as previous version" });

    } catch (error) { 
        console.error("Analytics Error:", error); 
        res.status(500).json({ error: "Erreur analytique" }); 
    }
  },

  // ====================================================
  // 📝 EXPORT CSV "AUDIT GRADE" (Context + Totals)
  // ====================================================
  getExport: async (req: Request, res: Response) => {
    try {
        const { type } = req.params; // journal, receipts, inventory, bilan
        const { start, end } = req.query;

        // 🛡️ TIMEZONE LOCK: Ensure we cover the FULL day (00:00:00 to 23:59:59)
        const startDate = new Date(`${start}T00:00:00.000Z`);
        const endDate = new Date(`${end}T23:59:59.999Z`);

        // 1. HEADER CONTEXT (The "Long Term Logic" Fix)
        // Ensures the printed file proves its own date range.
        let csvContent = "sep=;\n"; // Magic Header for Excel
        csvContent += `RAPPORT;${type.toUpperCase()}\n`;
        csvContent += `SOCIETE;ISSLI PECHE S.A.R.L\n`;
        csvContent += `PERIODE DU;${fmtDate(startDate)}\n`;
        csvContent += `AU;${fmtDate(endDate)}\n`;
        csvContent += `GENERE LE;${new Date().toLocaleString('fr-MA')}\n\n`; // Empty line separator

        let filename = `Export_${type}_${start}_${end}.csv`;

        // ====================================================
        // A. JOURNAL DES VENTES (TVA Declaration)
        // ====================================================
        if (type === 'journal') {
            const invoices = await prismaLegal.invoice.findMany({
                where: { issuedAt: { gte: startDate, lte: endDate }, status: { not: 'ANNULEE' } },
                orderBy: { issuedAt: 'asc' },
                include: { client: true }
            });

            csvContent += "Date;Reference;Client;ICE;Total HT;Total TVA;Total TTC;Etat\n";
            
            let sumHT = new Prisma.Decimal(0);
            let sumTVA = new Prisma.Decimal(0);
            let sumTTC = new Prisma.Decimal(0);

            invoices.forEach(inv => {
                const ht = toDec(inv.totalHT);
                const ttc = toDec(inv.totalTTC);
                const tva = ttc.sub(ht);
                
                sumHT = sumHT.add(ht);
                sumTVA = sumTVA.add(tva);
                sumTTC = sumTTC.add(ttc);

                const status = inv.status === 'PAYEE' ? 'Payee' : inv.status === 'AVOIR_EMIS' ? 'Rembourse' : 'En Attente';
                
                csvContent += `${fmtDate(inv.issuedAt)};${clean(inv.reference)};${clean(inv.clientNameSnapshot)};${clean(inv.clientIceSnapshot)};${formatExcelNum(ht)};${formatExcelNum(tva)};${formatExcelNum(ttc)};${status}\n`;
            });

            // Footer Summary Row
            csvContent += `;;;TOTAUX PÉRIODE;${formatExcelNum(sumHT)};${formatExcelNum(sumTVA)};${formatExcelNum(sumTTC)};\n`;
            
            filename = `Journal_Ventes_${start}.csv`;
        }

        // ====================================================
        // B. RELEVE ENCAISSEMENTS (Cash Flow Audit)
        // ====================================================
        else if (type === 'receipts') {
            const payments = await prismaLegal.payment.findMany({
                where: { paidAt: { gte: startDate, lte: endDate } },
                orderBy: { paidAt: 'asc' },
                include: { invoice: true }
            });

            csvContent += "Date;Ref Paiement;Client;Facture Liee;Mode;Montant;Note\n";
            
            let totalCash = new Prisma.Decimal(0);

            payments.forEach(pay => {
                const amount = toDec(pay.amount);
                totalCash = totalCash.add(amount);
                csvContent += `${fmtDate(pay.paidAt)};${clean(pay.reference || "-")};${clean(pay.invoice?.clientNameSnapshot)};${clean(pay.invoice?.reference)};${clean(pay.method)};${formatExcelNum(amount)};${clean(pay.note)}\n`;
            });

            csvContent += `;;;;TOTAL ENCAISSÉ;${formatExcelNum(totalCash)};\n`;
            filename = `Releve_Encaissements_${start}.csv`;
        }

        // ====================================================
        // C. INVENTAIRE (Asset Valuation)
        // ====================================================
        else if (type === 'inventory') {
            const products = await prismaLegal.productA.findMany({
                orderBy: { name: 'asc' }
            });

            csvContent += "Reference;Designation;Quantite;Unite;PAMP (Cout);Prix Vente (HT);Valeur Stock (HT)\n";
            
            let totalValue = new Prisma.Decimal(0);

            products.forEach(p => {
                const qty = toDec(p.quantity);
                const cost = toDec(p.purchaseCost);
                const val = qty.mul(cost);
                
                totalValue = totalValue.add(val);

                csvContent += `${clean(p.serialNumber)};${clean(p.name)};${formatExcelNum(qty)};${clean(p.measureUnit)};${formatExcelNum(cost)};${formatExcelNum(toDec(p.priceHT))};${formatExcelNum(val)}\n`;
            });

            csvContent += `;;;;;;${formatExcelNum(totalValue)}\n`;
            filename = `Inventaire_Stock_${new Date().toISOString().split('T')[0]}.csv`;
        }

        // ====================================================
        // D. BILAN (Snapshot)
        // ====================================================
        else if (type === 'bilan') {
            csvContent += "METRIQUE;VALEUR (MAD)\n";
            csvContent += `Export Bilan;Non disponible en format CSV simple. Voir PDF.\n`;
            filename = `Bilan_Simple_${start}.csv`;
        }

        else {
            return res.status(400).json({ error: "Type de rapport inconnu" });
        }

        // ✅ SEND FILE
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send('\uFEFF' + csvContent); // BOM for Excel

    } catch (error) {
        console.error("Export Error:", error);
        res.status(500).json({ error: "Erreur génération export" });
    }
  }
};