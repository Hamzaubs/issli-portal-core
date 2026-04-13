// apps/api/src/controllers/InvoicesController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { Prisma } from '@marine/db-legal';

// Helper for Big Data Math
const toDec = (val: any) => new Prisma.Decimal(val || 0);

export const InvoicesController = {
  
  // =========================================================================
  // 1. LIST DOCUMENTS (READ)
  // =========================================================================
  getDocuments: async (req: Request, res: Response) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const search = String(req.query.search || '').toLowerCase();
      const skip = (page - 1) * limit;

      const where: any = {};
      if (search) {
        where.OR = [
          { reference: { contains: search, mode: 'insensitive' } },
          { clientNameSnapshot: { contains: search, mode: 'insensitive' } },
          { client: { name: { contains: search, mode: 'insensitive' } } }
        ];
      }

      const [data, total] = await Promise.all([
        prismaLegal.invoice.findMany({
          where, skip, take: limit,
          orderBy: { issuedAt: 'desc' },
          include: { client: true, items: true }
        }),
        prismaLegal.invoice.count({ where })
      ]);

      res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (e: any) { 
        res.status(500).json({ error: "Erreur chargement documents" }); 
    }
  },

  // =========================================================================
  // 2. CREATE DOCUMENT (Standard Sale/Quote)
  // =========================================================================
  createDocument: async (req: Request, res: Response) => {
    try {
      const { type, clientId, items, note, isCredit, initialPayment, paymentMethod, paymentRef } = req.body;
      
      if (!clientId) return res.status(400).json({ error: "Client obligatoire" });
      if (!items?.length) return res.status(400).json({ error: "Panier vide" });

      const year = new Date().getFullYear();

      const result = await prismaLegal.$transaction(async (tx) => {
          const clientData = await tx.clientA.findUnique({ where: { id: clientId } });
          if (!clientData) throw new Error("Client introuvable");

          let totalHT = new Prisma.Decimal(0);
          let totalTTC = new Prisma.Decimal(0);
          const lineItems = [];
          
          for (const item of items) {
              const qty = toDec(item.quantity);
              if (qty.lte(0)) throw new Error(`Quantité invalide pour ${item.productName}`);

              let purchaseCostSnapshot = new Prisma.Decimal(0);

              if (item.productId) { 
                  const product = await tx.productA.findUnique({ where: { id: item.productId } });
                  if (!product) throw new Error(`Produit introuvable: ID ${item.productId}`);
                  
                  purchaseCostSnapshot = product.purchaseCost;

                  if (type === 'FACTURE') {
                      if (product.quantity.lt(qty)) {
                          throw new Error(`Stock insuffisant pour: ${product.name}`);
                      }
                      await tx.productA.update({
                          where: { id: item.productId },
                          data: { quantity: { decrement: qty } }
                      });
                  } else if (type === 'AVOIR') {
                      await tx.productA.update({
                          where: { id: item.productId },
                          data: { quantity: { increment: qty } }
                      });
                  }
              }

              const unitPrice = toDec(item.unitPrice);
              const rate = toDec(item.vatRate || 0.20); 
              
              const lineHT = unitPrice.mul(qty);
              const lineTTC = lineHT.mul(rate.add(1));

              totalHT = totalHT.add(lineHT);
              totalTTC = totalTTC.add(lineTTC);

              lineItems.push({
                  productId: item.productId || null,
                  productName: item.productName,
                  quantity: qty,
                  unitPriceHT: unitPrice,
                  vatRateSnapshot: rate,
                  unitPurchaseCostSnapshot: purchaseCostSnapshot,
                  measureUnit: item.measureUnit || 'UNIT',
                  technicalSpecs: item.technicalSpecs || ''
              });
          }

          // Sequence Generation
          let ref = '';
          if (type === 'FACTURE') {
              const seq = await tx.invoiceSequence.upsert({ where: { year }, update: { lastCount: { increment: 1 } }, create: { year, lastCount: 1 } });
              ref = `FAC-${year}-${seq.lastCount.toString().padStart(4, '0')}`;
          } else if (type === 'DEVIS') {
              const seq = await tx.quoteSequence.upsert({ where: { year }, update: { lastCount: { increment: 1 } }, create: { year, lastCount: 1 } });
              ref = `DEV-${year}-${seq.lastCount.toString().padStart(4, '0')}`;
          } else if (type === 'AVOIR') {
             const seq = await tx.invoiceSequence.upsert({ where: { year: 9999 }, update: { lastCount: { increment: 1 } }, create: { year: 9999, lastCount: 1 } });
            ref = `AVR-${year}-${seq.lastCount.toString().padStart(4, '0')}`;
          } else {
             ref = `DOC-${Date.now()}`;
          }

          let status = 'EN_ATTENTE';
          if (type === 'AVOIR') status = 'PAYEE'; 
          if (type === 'FACTURE' && Number(initialPayment) >= totalTTC.toNumber()) status = 'PAYEE';

          const invoice = await tx.invoice.create({
              data: {
                  reference: ref, type, status, clientId,
                  clientNameSnapshot: clientData.name,
                  clientIceSnapshot: clientData.ice,
                  clientAddressSnapshot: clientData.address,
                  totalHT, totalTTC,
                  amountPaid: isCredit ? toDec(initialPayment) : (type === 'FACTURE' ? totalTTC : toDec(0)),
                  note,
                  issuedAt: new Date(),
                  items: { create: lineItems }
              },
              include: { items: true, client: true }
          });

          if (type === 'FACTURE') {
              const payAmount = isCredit ? toDec(initialPayment) : totalTTC;
              if (payAmount.gt(0)) {
                  await tx.payment.create({
                      data: {
                          invoiceId: invoice.id,
                          amount: payAmount,
                          method: paymentMethod || 'ESPECES',
                          reference: paymentRef,
                          note: isCredit ? 'Acompte initial' : 'Paiement Comptant'
                      }
                  });
              }
          }
          return invoice;
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erreur transaction" });
    }
  },

  // =========================================================================
  // 3. CANCEL INVOICE
  // =========================================================================
  cancelInvoice: async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const result = await prismaLegal.$transaction(async (tx) => {
            const invoice = await tx.invoice.findUnique({ where: { id }, include: { items: true } });
            if (!invoice) throw new Error("Facture introuvable");
            if (invoice.type !== 'FACTURE') throw new Error("Impossible d'annuler ce document");
            if (invoice.status === 'ANNULEE' || invoice.status === 'AVOIR_EMIS') throw new Error("Déjà annulée");

            const year = new Date().getFullYear();
            const seq = await tx.invoiceSequence.upsert({ where: { year: 9999 }, update: { lastCount: { increment: 1 } }, create: { year: 9999, lastCount: 1 } });
            const creditRef = `AVR-${year}-${seq.lastCount.toString().padStart(4, '0')}`;

            await tx.invoice.update({ where: { id }, data: { status: 'AVOIR_EMIS', note: `Avoir généré: ${creditRef}` } });

            const creditNote = await tx.invoice.create({
                data: {
                    reference: creditRef, type: 'AVOIR', status: 'PAYEE',
                    clientId: invoice.clientId,
                    clientNameSnapshot: invoice.clientNameSnapshot,
                    totalHT: invoice.totalHT, totalTTC: invoice.totalTTC,
                    note: `Annulation Facture ${invoice.reference}`,
                    items: {
                        create: invoice.items.map(item => ({
                            productId: item.productId,
                            productName: item.productName,
                            quantity: item.quantity,
                            unitPriceHT: item.unitPriceHT,
                            vatRateSnapshot: item.vatRateSnapshot,
                            measureUnit: item.measureUnit
                        }))
                    }
                }
            });

            for (const item of invoice.items) {
                if (item.productId) {
                    const productExists = await tx.productA.findUnique({ where: { id: item.productId } });
                    if (productExists) {
                        await tx.productA.update({
                            where: { id: item.productId },
                            data: { quantity: { increment: item.quantity } } 
                        });
                    }
                }
            }
            return creditNote;
        });
        res.json(result);
      } catch (error: any) { res.status(400).json({ error: error.message }); }
  },

  // =========================================================================
  // 4. LEGACY EXCHANGE ENGINE (The "Truth" Logic)
  // Handles: Return Legacy Item (Stock+) -> Credit Note -> Buy New Item (Stock-) -> Invoice
  // =========================================================================
  processLegacyExchange: async (req: Request, res: Response) => {
    try {
        const { clientId, returnedItems, newItems, legacyRef } = req.body;

        if (!clientId || !returnedItems?.length) {
            return res.status(400).json({ error: "Données d'échange incomplètes." });
        }

        const year = new Date().getFullYear();

        const result = await prismaLegal.$transaction(async (tx) => {
            const clientData = await tx.clientA.findUnique({ where: { id: clientId } });
            if (!clientData) throw new Error("Client introuvable.");
            
            // --- PHASE 1: PROCESS RETURN (INGEST LEGACY STOCK) ---
            let creditTotalHT = new Prisma.Decimal(0);
            let creditTotalTTC = new Prisma.Decimal(0);
            const creditLines = [];
            
            for (const item of returnedItems) {
                const price = toDec(item.priceHT);
                const qty = toDec(item.quantity);
                const rate = toDec(item.vatRate || 0.20);
                const cost = toDec(item.purchaseCost || 0); // Estimated cost for legacy items

                if (qty.lte(0)) throw new Error(`Quantité retour invalide: ${item.name}`);

                // A. Smart Stock Re-Entry
                // If product doesn't exist (Legacy), CREATE IT so we can track it physically.
                let productId = '';
                const existingProduct = await tx.productA.findFirst({
                    where: { name: { equals: item.name, mode: 'insensitive' } }
                });

                if (existingProduct) {
                    // It exists in current catalog -> Just increment stock
                    await tx.productA.update({
                        where: { id: existingProduct.id },
                        data: { quantity: { increment: qty } }
                    });
                    productId = existingProduct.id;
                } else {
                    // It's a LEGACY item -> Create new asset
                    const autoSerial = `LEGACY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                    const newProduct = await tx.productA.create({
                        data: {
                            name: item.name,
                            priceHT: price,
                            purchaseCost: cost, // Crucial for margin calc
                            quantity: qty,
                            vatRate: rate,
                            serialNumber: autoSerial,
                            measureUnit: 'UNIT',
                            technicalSpecs: `Retour Ancien Système (Ref Facture: ${legacyRef || 'N/A'})`
                        }
                    });
                    productId = newProduct.id;
                }

                // B. Financial Accumulation
                const lineHT = price.mul(qty);
                const lineTTC = lineHT.mul(rate.add(1));
                creditTotalHT = creditTotalHT.add(lineHT);
                creditTotalTTC = creditTotalTTC.add(lineTTC);

                creditLines.push({
                    productId: productId,
                    productName: item.name,
                    quantity: qty,
                    unitPriceHT: price,
                    vatRateSnapshot: rate,
                    measureUnit: 'UNIT',
                    unitPurchaseCostSnapshot: cost
                });
            }

            // Generate Credit Note Reference
            const seqAvoir = await tx.invoiceSequence.upsert({ where: { year: 9999 }, update: { lastCount: { increment: 1 } }, create: { year: 9999, lastCount: 1 } });
            const creditRef = `AVR-${year}-${seqAvoir.lastCount.toString().padStart(4, '0')}`;

            // Create Credit Note
            const creditNote = await tx.invoice.create({
                data: {
                    reference: creditRef,
                    legacyReference: legacyRef, // ✅ Link to old paper invoice
                    type: 'AVOIR',
                    status: 'PAYEE',
                    clientId,
                    clientNameSnapshot: clientData.name,
                    totalHT: creditTotalHT,
                    totalTTC: creditTotalTTC,
                    note: `Retour Marchandise Legacy (Ref: ${legacyRef || 'Inconnue'})`,
                    items: { create: creditLines }
                }
            });

            // STOP IF NO NEW SALE (Simple Return)
            if (!newItems || newItems.length === 0) {
                return { creditNote, invoice: null, balance: creditTotalTTC.neg() };
            }

            // --- PHASE 2: PROCESS NEW SALE (DEBIT) ---
            let saleTotalHT = new Prisma.Decimal(0);
            let saleTotalTTC = new Prisma.Decimal(0);
            const saleLines = [];

            for (const item of newItems) {
                const product = await tx.productA.findUnique({ where: { id: item.productId } });
                const qty = toDec(item.quantity);
                
                if (!product || product.quantity.lt(qty)) {
                    throw new Error(`Stock insuffisant pour échange: ${item.productName}`);
                }

                await tx.productA.update({
                    where: { id: item.productId },
                    data: { quantity: { decrement: qty } }
                });

                const price = toDec(item.unitPrice);
                const rate = toDec(item.vatRate);
                
                const lineHT = price.mul(qty);
                const lineTTC = lineHT.mul(rate.add(1));

                saleTotalHT = saleTotalHT.add(lineHT);
                saleTotalTTC = saleTotalTTC.add(lineTTC);

                saleLines.push({
                    productId: item.productId,
                    productName: item.productName,
                    quantity: qty,
                    unitPriceHT: price,
                    vatRateSnapshot: rate,
                    measureUnit: item.measureUnit,
                    unitPurchaseCostSnapshot: product.purchaseCost
                });
            }

            // Generate Invoice Reference
            const seqFac = await tx.invoiceSequence.upsert({ where: { year }, update: { lastCount: { increment: 1 } }, create: { year, lastCount: 1 } });
            const invoiceRef = `FAC-${year}-${seqFac.lastCount.toString().padStart(4, '0')}`;

            // --- PHASE 3: THE SWAP (FINANCIAL LINK) ---
            const balanceToPay = saleTotalTTC.sub(creditTotalTTC);
            const isFullyCovered = balanceToPay.lte(0);
            const amountCoveredByCredit = isFullyCovered ? saleTotalTTC : creditTotalTTC;

            const invoice = await tx.invoice.create({
                data: {
                    reference: invoiceRef,
                    type: 'FACTURE',
                    status: isFullyCovered ? 'PAYEE' : 'EN_ATTENTE',
                    clientId,
                    clientNameSnapshot: clientData.name,
                    totalHT: saleTotalHT,
                    totalTTC: saleTotalTTC,
                    amountPaid: amountCoveredByCredit,
                    note: `Echange contre Avoir ${creditRef}`,
                    items: { create: saleLines }
                }
            });

            // 🔗 Create Payment Link (Burning the Credit Note)
            await tx.payment.create({
                data: {
                    invoiceId: invoice.id,
                    amount: amountCoveredByCredit,
                    method: 'AVOIR',
                    reference: creditRef,
                    note: `Compensation: ${creditRef} -> ${invoiceRef}`
                }
            });

            // Bidirectional Link Update
            await tx.invoice.update({
                where: { id: creditNote.id },
                data: { note: `${creditNote.note} (Utilisé pour ${invoiceRef})` }
            });

            return { 
                creditNote, 
                invoice, 
                balance: balanceToPay, 
                isFullyPaid: isFullyCovered 
            };

        }, { timeout: 20000 });

        res.json(result);
    } catch (e: any) {
        console.error("Exchange Error:", e);
        res.status(500).json({ error: e.message || "Erreur système lors de l'échange" });
    }
  },

  // Helpers
  convertQuote: async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const quote = await prismaLegal.invoice.findUnique({ where: { id }, include: { items: true } });
        if(!quote || quote.type !== 'DEVIS') return res.status(400).json({ error: "Devis invalide" });
        res.json(quote); 
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  },

  addPayment: async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { amount, method, note } = req.body;
        const result = await prismaLegal.$transaction(async (tx) => {
            const invoice = await tx.invoice.findUnique({ where: { id } });
            if (!invoice) throw new Error("Facture introuvable");
            
            const newTotalPaid = toDec(invoice.amountPaid).add(toDec(amount));
            const totalTTC = toDec(invoice.totalTTC);
            
            await tx.payment.create({
                data: {
                    invoiceId: id,
                    amount: toDec(amount),
                    method: method || 'ESPECES',
                    note
                }
            });
            const newStatus = newTotalPaid.gte(totalTTC.minus(0.5)) ? 'PAYEE' : 'EN_ATTENTE';
            await tx.invoice.update({
                where: { id },
                data: { amountPaid: newTotalPaid, status: newStatus }
            });
            return { success: true, newStatus };
        });
        res.json(result);
      } catch (error: any) { res.status(400).json({ error: error.message }); }
  },

  createCreditNote: async (req: Request, res: Response) => {
      return InvoicesController.cancelInvoice(req, res);
  }
};