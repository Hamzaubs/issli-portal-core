// apps/api/src/services/InvoiceService.ts
import { prismaLegal } from '@marine/db-legal';
import { Prisma } from '@marine/db-legal';

// 🛡️ MATH ENGINE: Work in "Centimes" (Integers) to avoid Floating Point Drift
const toCents = (n: number | Prisma.Decimal | string | null): number => {
    if (!n) return 0;
    const floatVal = typeof n === 'object' && 'toNumber' in n ? n.toNumber() : Number(n);
    return Math.round(floatVal * 100);
};

const fromCents = (cents: number): number => {
    return Number((cents / 100).toFixed(2));
};

export const InvoiceService = {

  // ==========================================
  // 1. CREATE DOCUMENT (Strict State Machine)
  // ==========================================
  async createDocument(data: any) {
    return await prismaLegal.$transaction(async (tx) => {
      
      const year = new Date().getFullYear();
      let prefix = '';
      let seqTable: 'quoteSequence' | 'invoiceSequence';

      if (data.type === 'DEVIS') { prefix = 'DEV'; seqTable = 'quoteSequence'; }
      else if (data.type === 'AVOIR') { prefix = 'AVR'; seqTable = 'invoiceSequence'; }
      else { prefix = 'FAC'; seqTable = 'invoiceSequence'; }

      let currentSeq;
      if (seqTable === 'quoteSequence') {
          currentSeq = await tx.quoteSequence.findUnique({ where: { year } });
          if (!currentSeq) currentSeq = await tx.quoteSequence.create({ data: { year, lastCount: 0 } });
      } else {
          currentSeq = await tx.invoiceSequence.findUnique({ where: { year } });
          if (!currentSeq) currentSeq = await tx.invoiceSequence.create({ data: { year, lastCount: 0 } });
      }

      let nextCount = currentSeq.lastCount;
      let reference = '';
      let isUnique = false;
      while (!isUnique) {
          nextCount++;
          reference = `${prefix}-${year}-${String(nextCount).padStart(4, '0')}`;
          const existing = await tx.invoice.findUnique({ where: { reference } });
          if (!existing) isUnique = true;
      }

      if (seqTable === 'quoteSequence') {
          await tx.quoteSequence.update({ where: { year }, data: { lastCount: nextCount } });
      } else {
          await tx.invoiceSequence.update({ where: { year }, data: { lastCount: nextCount } });
      }

      const client = await tx.clientA.findUnique({ where: { id: data.clientId } });
      if (!client) throw new Error("Client introuvable");

      let totalHTCents = 0;
      let totalTTCCents = 0;
      const invoiceItems = [];

      for (const item of data.items) {
        let productId = item.productId;
        let product: any = null;

        if (!productId && item.productName && data.type === 'AVOIR') {
            const cleanName = item.productName.trim();
            const legacySerial = `LEGACY-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            product = await tx.productA.create({
                data: {
                    name: cleanName, priceHT: item.unitPrice, vatRate: item.vatRate || 0.20,
                    serialNumber: legacySerial, quantity: 0, measureUnit: 'UNIT', technicalSpecs: 'Retour Hors Catalogue'
                }
            });
            productId = product.id;
        } else {
            product = await tx.productA.findUnique({ where: { id: productId } });
            if (!product) throw new Error(`Produit introuvable: ${productId}`);
        }

        if (data.type === 'FACTURE') {
          if (product.quantity < item.quantity) throw new Error(`Stock insuffisant: ${product.name}`);
          await tx.productA.update({ where: { id: productId }, data: { quantity: { decrement: item.quantity } } });
        } else if (data.type === 'AVOIR') {
          await tx.productA.update({ where: { id: productId }, data: { quantity: { increment: item.quantity } } });
        }

        const qty = Number(item.quantity);
        const priceCents = toCents(item.unitPrice || product.priceHT);
        const vatRate = Number(item.vatRate || product.vatRate || 0.20);
        
        const lineHTCents = Math.round(priceCents * qty);
        const lineTTCCents = Math.round(lineHTCents * (1 + vatRate));

        totalHTCents += lineHTCents;
        totalTTCCents += lineTTCCents;

        invoiceItems.push({
          productId: productId, productName: product.name, quantity: qty, unitPriceHT: fromCents(priceCents),
          unitPurchaseCostSnapshot: product.purchaseCost, vatRateSnapshot: vatRate,
          technicalSpecs: product.technicalSpecs || '', measureUnit: product.measureUnit || 'UNIT'
        });
      }

      // 🟢 FINANCIAL LOGIC (Strict State Machine)
      let initialStatus = 'EN_ATTENTE';
      let amountPaidCents = 0;

      if (data.type === 'FACTURE') {
          if (data.isCredit === true) {
             amountPaidCents = toCents(data.initialPayment || 0);
             if (amountPaidCents > totalTTCCents + 1) {
                throw new Error(`Le montant payé (${fromCents(amountPaidCents)}) dépasse le total (${fromCents(totalTTCCents)})`);
             }
             // ✅ FIX: Introduced 'PARTIEL' state
             if (amountPaidCents >= (totalTTCCents - 1)) initialStatus = 'PAYEE';
             else if (amountPaidCents > 0) initialStatus = 'PARTIEL';
             else initialStatus = 'EN_ATTENTE';
          } else {
             amountPaidCents = totalTTCCents;
             initialStatus = 'PAYEE';
          }
      } else if (data.type === 'AVOIR') {
          initialStatus = 'PAYEE'; // Avoirs are intrinsically 'settled'
          amountPaidCents = totalTTCCents;
      } else if (data.type === 'DEVIS') {
          initialStatus = 'DEVIS'; // Explicit Devis state
          amountPaidCents = 0;
      }

      const invoice = await tx.invoice.create({
        data: {
          reference, clientId: client.id, type: data.type || 'FACTURE', 
          status: initialStatus, totalHT: fromCents(totalHTCents), 
          totalTTC: fromCents(totalTTCCents), amountPaid: fromCents(amountPaidCents),
          note: data.note || '',
          clientNameSnapshot: client.name, clientIceSnapshot: client.ice,
          clientRcSnapshot: client.rc, clientIfSnapshot: client.if,
          clientAddressSnapshot: client.address,
          items: { create: invoiceItems }
        },
        include: { items: true }
      });

      if (amountPaidCents > 0 && data.type === 'FACTURE') {
          await tx.payment.create({
              data: {
                  invoiceId: invoice.id, amount: fromCents(amountPaidCents),
                  method: data.paymentMethod || 'ESPECES', reference: data.paymentRef || null,
                  note: initialStatus === 'PAYEE' ? 'Paiement Comptant' : 'Acompte Initial',
                  paidAt: new Date()
              }
          });
      }

      return invoice;
    });
  },

  // ==========================================
  // 2. ADD PAYMENT (Strict Mode)
  // ==========================================
  async addPayment(data: any) {
      return await prismaLegal.$transaction(async (tx) => {
          const invoice = await tx.invoice.findUnique({ where: { id: data.invoiceId } });
          if (!invoice) throw new Error("Facture introuvable");

          const currentPaidCents = toCents(invoice.amountPaid);
          const totalTTCCents = toCents(invoice.totalTTC);
          const incomingAmountCents = toCents(data.amount);

          const newTotalPaidCents = currentPaidCents + incomingAmountCents;
          
          if (newTotalPaidCents > totalTTCCents + 1) {
              const remaining = fromCents(totalTTCCents - currentPaidCents);
              throw new Error(`Montant excessif. Reste à payer exact: ${remaining} MAD`);
          }

          // ✅ FIX: Advance to PARTIEL or PAYEE correctly
          let newStatus = invoice.status;
          if (newTotalPaidCents >= (totalTTCCents - 1)) newStatus = 'PAYEE';
          else if (newTotalPaidCents > 0) newStatus = 'PARTIEL';

          const updatedInvoice = await tx.invoice.update({
              where: { id: data.invoiceId },
              data: { amountPaid: fromCents(newTotalPaidCents), status: newStatus }
          });

          await tx.payment.create({
              data: {
                  invoiceId: invoice.id, amount: fromCents(incomingAmountCents),
                  method: data.method || 'ESPECES', reference: data.reference || null,
                  note: data.note || 'Réglement de solde', paidAt: new Date()
              }
          });

          return updatedInvoice;
      });
  },

  // ==========================================
  // 3. CANCEL OR CREDIT NOTE (Refund Integrity)
  // ==========================================
  async cancelOrCreditNote(invoiceId: string) {
      return await prismaLegal.$transaction(async (tx) => {
        const original = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { items: true, client: true } });
        if (!original) throw new Error("Facture introuvable");
        if (original.status === 'ANNULEE' || original.status === 'AVOIR_EMIS') throw new Error("Déjà annulé.");
  
        const year = new Date().getFullYear();
        let seq = await tx.invoiceSequence.findUnique({ where: { year } });
        if (!seq) seq = await tx.invoiceSequence.create({ data: { year, lastCount: 0 } });
        let nextCount = seq.lastCount;
        let reference = '';
        let isUnique = false;
        while (!isUnique) {
            nextCount++;
            reference = `AVR-${year}-${String(nextCount).padStart(4, '0')}`;
            if (!await tx.invoice.findUnique({ where: { reference } })) isUnique = true;
        }
        await tx.invoiceSequence.update({ where: { year }, data: { lastCount: nextCount } });
  
        const newItems = [];
        for (const item of original.items) {
          if (item.productId) await tx.productA.update({ where: { id: item.productId }, data: { quantity: { increment: item.quantity } } });
          newItems.push({
            productId: item.productId, productName: item.productName, quantity: item.quantity, unitPriceHT: item.unitPriceHT,
            vatRateSnapshot: item.vatRateSnapshot, unitPurchaseCostSnapshot: item.unitPurchaseCostSnapshot,
            measureUnit: (item as any).measureUnit || 'UNIT', technicalSpecs: (item as any).technicalSpecs || ''
          });
        }
  
        const creditNote = await tx.invoice.create({
          data: {
            reference, clientId: original.clientId, type: 'AVOIR', 
            status: 'PAYEE', // ✅ FIX: Avoirs are instantly balanced
            totalHT: original.totalHT, totalTTC: original.totalTTC, 
            amountPaid: original.totalTTC, // ✅ FIX: Prevent floating debt
            clientNameSnapshot: original.clientNameSnapshot, clientIceSnapshot: original.clientIceSnapshot,
            clientRcSnapshot: original.clientRcSnapshot || original.client?.rc,
            clientIfSnapshot: original.clientIfSnapshot || original.client?.if,
            clientAddressSnapshot: original.clientAddressSnapshot,
            note: "Annulation/Avoir pour " + original.reference,
            items: { create: newItems }
          }
        });

        // ✅ FIX: Safely process Cash Refund if client had already paid part of the invoice
        const paidCents = toCents(original.amountPaid);
        if (paidCents > 0) {
            await tx.payment.create({
                data: {
                    invoiceId: creditNote.id, amount: fromCents(paidCents),
                    method: 'CASH', // Defaults to cash return
                    note: `Remboursement suite à l'annulation de ${original.reference}`,
                    paidAt: new Date()
                }
            });
        }

        await tx.invoice.update({ where: { id: invoiceId }, data: { status: 'AVOIR_EMIS' } });
        return creditNote;
      });
  },

  // ==========================================
  // 4. CONVERT QUOTE (Deferred Payment Fix)
  // ==========================================
  async convertQuote(quoteId: string) {
      return await prismaLegal.$transaction(async (tx) => {
        const quote = await tx.invoice.findUnique({ where: { id: quoteId }, include: { items: true } });
        if (!quote || quote.type !== 'DEVIS') throw new Error("Document invalide");
  
        const year = new Date().getFullYear();
        let seq = await tx.invoiceSequence.findUnique({ where: { year } });
        if (!seq) seq = await tx.invoiceSequence.create({ data: { year, lastCount: 0 } });
        let nextCount = seq.lastCount;
        let reference = '';
        let isUnique = false;
        while (!isUnique) {
            nextCount++;
            reference = `FAC-${year}-${String(nextCount).padStart(4, '0')}`;
            if (!await tx.invoice.findUnique({ where: { reference } })) isUnique = true;
        }
        await tx.invoiceSequence.update({ where: { year }, data: { lastCount: nextCount } });
  
        for (const item of quote.items) {
          if (item.productId) {
            const product = await tx.productA.findUnique({ where: { id: item.productId } });
            if (!product) throw new Error(`Produit introuvable: ${item.productName}`);
            if (product.quantity < item.quantity) throw new Error(`Stock insuffisant pour ${product.name}`);
            await tx.productA.update({ where: { id: product.id }, data: { quantity: { decrement: item.quantity } } });
          }
        }
  
        // ✅ FIX: Converted quotes start as UNPAID ('EN_ATTENTE'), allowing the user to add payment later
        const invoice = await tx.invoice.update({
          where: { id: quoteId },
          data: { 
              type: 'FACTURE', reference: reference, 
              status: 'EN_ATTENTE', // Not forced to 'PAYEE'
              amountPaid: 0, // No fake cash generated
              issuedAt: new Date() 
          }
        });
        
        return invoice;
      });
  }
};