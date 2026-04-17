// apps/api/src/controllers/InvoicesController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { Prisma } from '@marine/db-legal';

// Helper for Big Data Math
const toDec = (val: any) => new Prisma.Decimal(val || 0);

// 🛡️ MATH ENGINE: Strict Centimes for Status Checks to prevent drift
const toCents = (n: any): number => {
    if (!n) return 0;
    const floatVal = typeof n === 'object' && 'toNumber' in n ? n.toNumber() : Number(n);
    return Math.round(floatVal * 100);
};

// 🧠 LOGIC: Determine the Human-Readable Payment Mode + REFERENCE
const computePaymentMode = (doc: any) => {
    // 1. If Cancelled
    if (doc.status === 'ANNULEE' || doc.status === 'CANCELLED') return 'ANNULÉ';
    if (doc.status === 'AVOIR_EMIS') return 'ANNULÉ (AVOIR)';
    if (doc.status === 'AVOIR_PARTIEL') return `AVOIR PARTIEL`; 
    if (doc.type === 'AVOIR') return 'AVOIR (REMBOURSÉ)'; 

    // 2. If Payments Exist (Paid or Partial)
    if (doc.payments && doc.payments.length > 0) {
        const methods = [...new Set(doc.payments.map((p: any) => p.method))];
        return methods.map(m => {
            if (m === 'CHEQUE') return 'CHÈQUE';
            if (m === 'ESPECES') return 'ESPÈCES';
            if (m === 'VIREMENT') return 'VIREMENT';
            if (m === 'EFFET') return 'EFFET';
            if (m === 'AVOIR') return 'COMPENSATION';
            if (m === 'LIVRAISON') return 'A LA LIVRAISON';
            return m;
        }).join(' + ');
    }

    // 3. If Unpaid but has specific intent in Note
    if (doc.note && doc.note.includes('[MODE:LIVRAISON]')) {
        return 'A LA LIVRAISON';
    }

    // 4. Default Unpaid
    return 'CRÉDIT';
};

export const InvoicesController = {
  
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
          include: { client: true, items: true, payments: true }
        }),
        prismaLegal.invoice.count({ where })
      ]);

      const enhancedData = data.map(doc => ({
          ...doc,
          paymentMode: computePaymentMode(doc) 
      }));

      res.json({ data: enhancedData, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (e: any) { 
        res.status(500).json({ error: "Erreur chargement documents" }); 
    }
  },

  getDocumentById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const doc = await prismaLegal.invoice.findUnique({
        where: { id },
        include: {
          client: true,
          items: true,
          payments: { orderBy: { paidAt: 'desc' } }
        }
      });

      if (!doc) return res.status(404).json({ error: "Document introuvable" });

      const safeDoc = {
          ...doc,
          paymentMode: computePaymentMode(doc),
          totalHT: Number(doc.totalHT),
          totalTTC: Number(doc.totalTTC),
          amountPaid: Number(doc.amountPaid),
          items: doc.items.map(i => ({
              ...i,
              unitPrice: Number(i.unitPriceHT), 
              unitPriceHT: Number(i.unitPriceHT),
              quantity: Number(i.quantity),
              vatRateSnapshot: Number(i.vatRateSnapshot)
          })),
          payments: doc.payments.map(p => ({
              ...p,
              amount: Number(p.amount)
          }))
      };

      res.json(safeDoc);
    } catch (e: any) {
      res.status(500).json({ error: "Erreur chargement détail document" });
    }
  },

  createDocument: async (req: Request, res: Response) => {
    try {
      const { type, clientId, items, note, isCredit, initialPayment, paymentMethod, paymentRef, legacyReference, issuedAt } = req.body;
      
      if (!clientId) return res.status(400).json({ error: "Client obligatoire" });
      if (!items?.length) return res.status(400).json({ error: "Panier vide" });

      const invoiceDate = issuedAt ? new Date(issuedAt) : new Date();
      const year = invoiceDate.getFullYear();

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
                      if (product.quantity.lt(qty)) throw new Error(`Stock insuffisant pour: ${product.name}`);
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

          let ref = '';
          if (type === 'FACTURE') {
              const isLegacyDebt = legacyReference || (note && note.includes('[REPRISE DE DETTE]'));
              
              if (isLegacyDebt) {
                  const repYear = year + 10000; 
                  const seq = await tx.invoiceSequence.upsert({ 
                      where: { year: repYear }, 
                      update: { lastCount: { increment: 1 } }, 
                      create: { year: repYear, lastCount: 1 } 
                  });
                  ref = `REP-${year}-${seq.lastCount.toString().padStart(4, '0')}`;
              } else {
                  const seq = await tx.invoiceSequence.upsert({ 
                      where: { year }, 
                      update: { lastCount: { increment: 1 } }, 
                      create: { year, lastCount: 1 } 
                  });
                  ref = `FAC-${year}-${seq.lastCount.toString().padStart(4, '0')}`;
              }
          } else if (type === 'DEVIS') {
              const seq = await tx.quoteSequence.upsert({ where: { year }, update: { lastCount: { increment: 1 } }, create: { year, lastCount: 1 } });
              ref = `DEV-${year}-${seq.lastCount.toString().padStart(4, '0')}`;
          } else if (type === 'AVOIR') {
             const seq = await tx.invoiceSequence.upsert({ where: { year: 9999 }, update: { lastCount: { increment: 1 } }, create: { year: 9999, lastCount: 1 } });
             ref = `AVR-${year}-${seq.lastCount.toString().padStart(4, '0')}`;
          } else {
             ref = `DOC-${Date.now()}`;
          }

          // 🛡️ REFERENCE COLLISION SHIELD FOR LEGAL DOCUMENTS
          const existingDoc = await tx.invoice.findUnique({ where: { reference: ref } });
          if (existingDoc) {
              throw new Error(`Collision détectée : La référence '${ref}' vient d'être utilisée par un autre opérateur. Veuillez simplement re-cliquer sur valider.`);
          }

          // 🛑 FIX: STRICT STATE MACHINE CALCULATION
          let status = 'EN_ATTENTE';
          if (type === 'AVOIR') {
              status = 'PAYEE'; 
          } else if (type === 'FACTURE') {
              const totalCents = toCents(totalTTC);
              const paidCents = isCredit ? toCents(initialPayment) : totalCents;
              
              if (paidCents >= totalCents - 1) status = 'PAYEE';
              else if (paidCents > 0) status = 'PARTIEL';
          }

          let finalNote = note || '';
          if (type === 'FACTURE' && paymentMethod === 'LIVRAISON' && Number(initialPayment) === 0) {
              finalNote += ' [MODE:LIVRAISON]'; 
          }

          const amountPaid = isCredit ? toDec(initialPayment) : (type === 'FACTURE' || type === 'AVOIR' ? totalTTC : toDec(0));

          const invoice = await tx.invoice.create({
              data: {
                  reference: ref, type, status, clientId,
                  legacyReference: legacyReference || null,
                  clientNameSnapshot: clientData.name,
                  clientIceSnapshot: clientData.ice,
                  clientAddressSnapshot: clientData.address,
                  totalHT, totalTTC,
                  amountPaid: amountPaid, 
                  note: finalNote.trim(),
                  issuedAt: invoiceDate,
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
                          note: isCredit ? 'Acompte initial' : 'Paiement Comptant',
                          paidAt: invoiceDate
                      }
                  });
              }
          } 
          else if (type === 'AVOIR') {
              await tx.payment.create({
                  data: {
                      invoiceId: invoice.id,
                      amount: totalTTC,
                      method: paymentMethod || 'ESPECES',
                      reference: paymentRef || 'Remboursement',
                      note: 'Remboursement Immédiat (Auto)',
                      paidAt: invoiceDate 
                  }
              });
          }

          return invoice;
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erreur transaction" });
    }
  },

  cancelInvoice: async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { partialReturns } = req.body; 

        const result = await prismaLegal.$transaction(async (tx) => {
            const invoice = await tx.invoice.findUnique({ where: { id }, include: { items: true } });
            if (!invoice) throw new Error("Facture introuvable");
            if (invoice.type !== 'FACTURE') throw new Error("Impossible d'annuler ce document");
            if (invoice.status === 'ANNULEE' || invoice.status === 'AVOIR_EMIS') throw new Error("Déjà annulée ou avoir émis");

            const year = new Date().getFullYear();
            const seq = await tx.invoiceSequence.upsert({ where: { year: 9999 }, update: { lastCount: { increment: 1 } }, create: { year: 9999, lastCount: 1 } });
            const creditRef = `AVR-${year}-${seq.lastCount.toString().padStart(4, '0')}`;

            // 🛡️ REFERENCE COLLISION SHIELD
            const existingAvoir = await tx.invoice.findUnique({ where: { reference: creditRef } });
            if (existingAvoir) {
                throw new Error(`Collision détectée : La référence '${creditRef}' vient d'être générée par un autre opérateur. Veuillez réessayer.`);
            }

            if (partialReturns && Array.isArray(partialReturns) && partialReturns.length > 0) {
                let totalHT = new Prisma.Decimal(0);
                let totalTTC = new Prisma.Decimal(0);
                const creditLines = [];

                for (const reqItem of partialReturns) {
                    const qtyToReturn = toDec(reqItem.returnQty);
                    if (qtyToReturn.lte(0)) continue;

                    const originalItem = invoice.items.find(i => i.id === reqItem.id);
                    if (!originalItem) continue;
                    if (qtyToReturn.gt(toDec(originalItem.quantity))) throw new Error(`Quantité retour invalide pour ${originalItem.productName}`);

                    const lineHT = originalItem.unitPriceHT.mul(qtyToReturn);
                    const lineTTC = lineHT.mul(originalItem.vatRateSnapshot.add(1));
                    totalHT = totalHT.add(lineHT);
                    totalTTC = totalTTC.add(lineTTC);

                    creditLines.push({
                        productId: originalItem.productId, productName: originalItem.productName, quantity: qtyToReturn, 
                        unitPriceHT: originalItem.unitPriceHT, vatRateSnapshot: originalItem.vatRateSnapshot, 
                        measureUnit: originalItem.measureUnit, unitPurchaseCostSnapshot: originalItem.unitPurchaseCostSnapshot
                    });

                    if (originalItem.productId) {
                        await tx.productA.update({ where: { id: originalItem.productId }, data: { quantity: { increment: qtyToReturn } } });
                    }
                }

                if (creditLines.length === 0) throw new Error("Aucun article valide à retourner");

                const creditNote = await tx.invoice.create({
                    data: {
                        reference: creditRef, type: 'AVOIR', status: 'PAYEE', clientId: invoice.clientId, 
                        clientNameSnapshot: invoice.clientNameSnapshot, totalHT, totalTTC, 
                        amountPaid: totalTTC, 
                        note: `Avoir partiel sur Facture ${invoice.reference}`, items: { create: creditLines }
                    }
                });

                await tx.payment.create({
                    data: {
                        invoiceId: creditNote.id,
                        amount: totalTTC,
                        method: 'ESPECES',
                        note: `Remboursement Auto pour Avoir ${creditRef}`
                    }
                });

                const isFullReturn = partialReturns.every(pr => {
                    const orig = invoice.items.find(i => i.id === pr.id);
                    return orig && toDec(pr.returnQty).equals(toDec(orig.quantity));
                }) && partialReturns.length === invoice.items.length;

                await tx.invoice.update({
                    where: { id },
                    data: { status: isFullReturn ? 'AVOIR_EMIS' : 'AVOIR_PARTIEL', note: `${invoice.note ? invoice.note + '\n' : ''}Avoir généré: ${creditRef}` }
                });

                return creditNote;
            } 
            
            else {
                await tx.invoice.update({ where: { id }, data: { status: 'AVOIR_EMIS', note: `Avoir total généré: ${creditRef}` } });

                const creditNote = await tx.invoice.create({
                    data: {
                        reference: creditRef, type: 'AVOIR', status: 'PAYEE', clientId: invoice.clientId, 
                        clientNameSnapshot: invoice.clientNameSnapshot, totalHT: invoice.totalHT, totalTTC: invoice.totalTTC, 
                        amountPaid: invoice.totalTTC, 
                        note: `Annulation totale Facture ${invoice.reference}`,
                        items: {
                            create: invoice.items.map(item => ({
                                productId: item.productId, productName: item.productName, quantity: item.quantity, 
                                unitPriceHT: item.unitPriceHT, vatRateSnapshot: item.vatRateSnapshot, 
                                measureUnit: item.measureUnit, unitPurchaseCostSnapshot: item.unitPurchaseCostSnapshot
                            }))
                        }
                    }
                });

                await tx.payment.create({
                    data: {
                        invoiceId: creditNote.id,
                        amount: invoice.totalTTC,
                        method: 'ESPECES',
                        note: `Remboursement Auto pour Avoir ${creditRef}`
                    }
                });

                for (const item of invoice.items) {
                    if (item.productId) await tx.productA.update({ where: { id: item.productId }, data: { quantity: { increment: item.quantity } } });
                }
                return creditNote;
            }
        });
        res.json(result);
      } catch (error: any) { res.status(400).json({ error: error.message }); }
  },

  processLegacyExchange: async (req: Request, res: Response) => {
    try {
        const { clientId, returnedItems, newItems, legacyRef } = req.body;
        if (!clientId || !returnedItems?.length) return res.status(400).json({ error: "Données d'échange incomplètes." });

        const year = new Date().getFullYear();

        const result = await prismaLegal.$transaction(async (tx) => {
            const clientData = await tx.clientA.findUnique({ where: { id: clientId } });
            if (!clientData) throw new Error("Client introuvable.");
            
            let creditTotalHT = new Prisma.Decimal(0);
            let creditTotalTTC = new Prisma.Decimal(0);
            const creditLines = [];
            
            for (const item of returnedItems) {
                const price = toDec(item.priceHT);
                const qty = toDec(item.quantity);
                const rate = toDec(item.vatRate || 0.20);
                const cost = toDec(item.purchaseCost || 0);

                if (qty.lte(0)) throw new Error(`Quantité retour invalide: ${item.name}`);

                let productId = '';
                const existingProduct = await tx.productA.findFirst({
                    where: { name: { equals: item.name, mode: 'insensitive' } }
                });

                if (existingProduct) {
                    await tx.productA.update({
                        where: { id: existingProduct.id },
                        data: { quantity: { increment: qty } }
                    });
                    productId = existingProduct.id;
                } else {
                    const autoSerial = `LEGACY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                    const newProduct = await tx.productA.create({
                        data: {
                            name: item.name, priceHT: price, purchaseCost: cost, quantity: qty,
                            vatRate: rate, serialNumber: autoSerial, measureUnit: 'UNIT',
                            technicalSpecs: `Retour Ancien Système (Ref Facture: ${legacyRef || 'N/A'})`
                        }
                    });
                    productId = newProduct.id;
                }

                const lineHT = price.mul(qty);
                const lineTTC = lineHT.mul(rate.add(1));
                creditTotalHT = creditTotalHT.add(lineHT);
                creditTotalTTC = creditTotalTTC.add(lineTTC);

                creditLines.push({
                    productId: productId, productName: item.name, quantity: qty, unitPriceHT: price,
                    vatRateSnapshot: rate, measureUnit: 'UNIT', unitPurchaseCostSnapshot: cost
                });
            }

            const seqAvoir = await tx.invoiceSequence.upsert({ where: { year: 9999 }, update: { lastCount: { increment: 1 } }, create: { year: 9999, lastCount: 1 } });
            const creditRef = `AVR-${year}-${seqAvoir.lastCount.toString().padStart(4, '0')}`;

            // 🛡️ REFERENCE COLLISION SHIELD FOR AVOIR
            const existingAvoir = await tx.invoice.findUnique({ where: { reference: creditRef } });
            if (existingAvoir) throw new Error(`Collision détectée : La référence d'avoir '${creditRef}' vient d'être utilisée. Veuillez réessayer.`);

            const creditNote = await tx.invoice.create({
                data: {
                    reference: creditRef, legacyReference: legacyRef, type: 'AVOIR', status: 'PAYEE',
                    clientId, clientNameSnapshot: clientData.name, totalHT: creditTotalHT, totalTTC: creditTotalTTC,
                    amountPaid: creditTotalTTC, 
                    note: `Retour Marchandise Legacy (Ref: ${legacyRef || 'Inconnue'})`,
                    items: { create: creditLines }
                }
            });

            if (!newItems || newItems.length === 0) return { creditNote, invoice: null, balance: creditTotalTTC.neg() };

            let saleTotalHT = new Prisma.Decimal(0);
            let saleTotalTTC = new Prisma.Decimal(0);
            const saleLines = [];

            for (const item of newItems) {
                const product = await tx.productA.findUnique({ where: { id: item.productId } });
                const qty = toDec(item.quantity);
                if (!product || product.quantity.lt(qty)) throw new Error(`Stock insuffisant pour échange: ${item.productName}`);

                await tx.productA.update({ where: { id: item.productId }, data: { quantity: { decrement: qty } } });

                const price = toDec(item.unitPrice);
                const rate = toDec(item.vatRate);
                const lineHT = price.mul(qty);
                const lineTTC = lineHT.mul(rate.add(1));
                saleTotalHT = saleTotalHT.add(lineHT);
                saleTotalTTC = saleTotalTTC.add(lineTTC);

                saleLines.push({
                    productId: item.productId, productName: item.productName, quantity: qty, unitPriceHT: price,
                    vatRateSnapshot: rate, measureUnit: item.measureUnit, unitPurchaseCostSnapshot: product.purchaseCost
                });
            }

            const seqFac = await tx.invoiceSequence.upsert({ where: { year }, update: { lastCount: { increment: 1 } }, create: { year, lastCount: 1 } });
            const invoiceRef = `FAC-${year}-${seqFac.lastCount.toString().padStart(4, '0')}`;

            // 🛡️ REFERENCE COLLISION SHIELD FOR INVOICE
            const existingInv = await tx.invoice.findUnique({ where: { reference: invoiceRef } });
            if (existingInv) throw new Error(`Collision détectée : La référence de facture '${invoiceRef}' vient d'être utilisée. Veuillez réessayer.`);

            const balanceToPay = saleTotalTTC.sub(creditTotalTTC);
            const isFullyCovered = balanceToPay.lte(0);
            const amountCoveredByCredit = isFullyCovered ? saleTotalTTC : creditTotalTTC;

            // 🛑 FIX: STRICT STATE MACHINE FOR EXCHANGES
            const totalCents = toCents(saleTotalTTC);
            const coveredCents = toCents(amountCoveredByCredit);
            
            let exchangeStatus = 'EN_ATTENTE';
            if (coveredCents >= totalCents - 1) exchangeStatus = 'PAYEE';
            else if (coveredCents > 0) exchangeStatus = 'PARTIEL';

            const invoice = await tx.invoice.create({
                data: {
                    reference: invoiceRef, type: 'FACTURE', status: exchangeStatus,
                    clientId, clientNameSnapshot: clientData.name, totalHT: saleTotalHT, totalTTC: saleTotalTTC,
                    amountPaid: amountCoveredByCredit, 
                    note: `Echange contre Avoir ${creditRef}`,
                    items: { create: saleLines }
                }
            });

            if (amountCoveredByCredit.gt(0)) {
                await tx.payment.create({
                    data: {
                        invoiceId: invoice.id, amount: amountCoveredByCredit, method: 'COMPENSATION',
                        reference: creditRef, note: `Compensation: ${creditRef} -> ${invoiceRef}`
                    }
                });
            }

            await tx.invoice.update({
                where: { id: creditNote.id }, data: { note: `${creditNote.note} (Utilisé pour ${invoiceRef})` }
            });

            return { creditNote, invoice, balance: balanceToPay, isFullyPaid: isFullyCovered };

        }, { timeout: 20000 });

        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message || "Erreur système lors de l'échange" });
    }
  },

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
                    invoiceId: id, amount: toDec(amount), method: method || 'ESPECES', note
                }
            });

            // 🛑 FIX: STRICT STATE MACHINE CALCULATION TO FIX FLOATING BUG
            const totalCents = toCents(totalTTC);
            const paidCents = toCents(newTotalPaid);
            
            let newStatus = invoice.status;
            if (paidCents >= totalCents - 1) newStatus = 'PAYEE';
            else if (paidCents > 0) newStatus = 'PARTIEL';
            else newStatus = 'EN_ATTENTE';

            await tx.invoice.update({ where: { id }, data: { amountPaid: newTotalPaid, status: newStatus } });
            return { success: true, newStatus };
        });
        res.json(result);
      } catch (error: any) { res.status(400).json({ error: error.message }); }
  },

  createCreditNote: async (req: Request, res: Response) => {
      return InvoicesController.cancelInvoice(req, res);
  }
};