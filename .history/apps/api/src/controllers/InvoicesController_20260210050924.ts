// apps/api/src/controllers/InvoicesController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { Prisma } from '@marine/db-legal';

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
  // 2. CREATE DOCUMENT (ATOMIC TRANSACTION)
  // Handles: FACTURE (Sale), DEVIS (Quote), AVOIR (Manual Return)
  // =========================================================================
  createDocument: async (req: Request, res: Response) => {
    try {
      const { type, clientId, items, note, isCredit, initialPayment, paymentMethod, paymentRef } = req.body;
      
      if (!clientId) return res.status(400).json({ error: "Client obligatoire" });
      if (!items?.length) return res.status(400).json({ error: "Panier vide" });

      const year = new Date().getFullYear();

      // 🛡️ START TRANSACTION
      const result = await prismaLegal.$transaction(async (tx) => {
          const clientData = await tx.clientA.findUnique({ where: { id: clientId } });
          if (!clientData) throw new Error("Client introuvable");

          let totalHT = new Prisma.Decimal(0);
          let totalTTC = new Prisma.Decimal(0);
          const lineItems = [];
          
          for (const item of items) {
              const qty = Math.floor(Number(item.quantity)); // FORCE INT
              if (qty <= 0) throw new Error(`Quantité invalide pour ${item.productName}`);

              let purchaseCostSnapshot = new Prisma.Decimal(0);

              // --- A. STOCK MANAGEMENT LOGIC ---
              if (item.productId) { 
                  const product = await tx.productA.findUnique({ where: { id: item.productId } });
                  if (!product) throw new Error(`Produit introuvable: ID ${item.productId}`);
                  
                  purchaseCostSnapshot = product.purchaseCost;

                  if (type === 'FACTURE') {
                      // SALE: Check & Decrement
                      if (product.quantity < qty) {
                          throw new Error(`Stock insuffisant pour: ${product.name} (Dispo: ${product.quantity})`);
                      }
                      await tx.productA.update({
                          where: { id: item.productId },
                          data: { quantity: { decrement: qty } }
                      });
                  } else if (type === 'AVOIR') {
                      // RETURN: Increment Stock
                      await tx.productA.update({
                          where: { id: item.productId },
                          data: { quantity: { increment: qty } }
                      });
                  }
                  // DEVIS: No stock movement
              }

              // --- B. FINANCIAL CALCULATIONS (Big Data Safe) ---
              const unitPrice = new Prisma.Decimal(item.unitPrice);
              const rate = new Prisma.Decimal(item.vatRate || 0.20); 
              
              // Precise Math: LineHT = Price * Qty
              const lineHT = unitPrice.mul(qty);
              // Precise Math: LineTTC = LineHT * (1 + VAT)
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

          // --- C. REFERENCE GENERATION ---
          let ref = '';
          if (type === 'FACTURE') {
              const seq = await tx.invoiceSequence.upsert({
                  where: { year },
                  update: { lastCount: { increment: 1 } },
                  create: { year, lastCount: 1 }
              });
              ref = `FAC-${year}-${seq.lastCount.toString().padStart(4, '0')}`;
          } else if (type === 'DEVIS') {
              const seq = await tx.quoteSequence.upsert({
                  where: { year },
                  update: { lastCount: { increment: 1 } },
                  create: { year, lastCount: 1 }
              });
              ref = `DEV-${year}-${seq.lastCount.toString().padStart(4, '0')}`;
          } else if (type === 'AVOIR') {
             // Shared sequence for all Credit Notes
             const seq = await tx.invoiceSequence.upsert({ 
                where: { year: 9999 }, 
                update: { lastCount: { increment: 1 } },
                create: { year: 9999, lastCount: 1 }
            });
            ref = `AVR-${year}-${seq.lastCount.toString().padStart(4, '0')}`;
          } else {
             ref = `DOC-${Date.now()}`;
          }

          // --- D. CREATE INVOICE RECORD ---
          let status = 'EN_ATTENTE';
          if (type === 'AVOIR') status = 'PAYEE'; 
          if (type === 'FACTURE' && Number(initialPayment) >= totalTTC.toNumber()) status = 'PAYEE';

          const invoice = await tx.invoice.create({
              data: {
                  reference: ref,
                  type: type,
                  status: status,
                  clientId,
                  clientNameSnapshot: clientData.name,
                  clientIceSnapshot: clientData.ice,
                  clientAddressSnapshot: clientData.address,
                  totalHT,
                  totalTTC,
                  amountPaid: isCredit ? new Prisma.Decimal(initialPayment || 0) : (type === 'FACTURE' ? totalTTC : 0),
                  note,
                  issuedAt: new Date(),
                  items: { create: lineItems }
              },
              include: { items: true, client: true }
          });

          // --- E. CREATE PAYMENT RECORD (If Applicable) ---
          if (type === 'FACTURE') {
              const payAmount = isCredit ? new Prisma.Decimal(initialPayment || 0) : totalTTC;
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
  // 3. CANCEL INVOICE (GENERATE CREDIT NOTE)
  // Reverses a Sale: Creates AVOIR + Increments Stock
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
            const seq = await tx.invoiceSequence.upsert({
                where: { year: 9999 },
                update: { lastCount: { increment: 1 } },
                create: { year: 9999, lastCount: 1 }
            });
            const creditRef = `AVR-${year}-${seq.lastCount.toString().padStart(4, '0')}`;

            // Mark original as Cancelled/Credited
            await tx.invoice.update({
                where: { id },
                data: { status: 'AVOIR_EMIS', note: `Avoir généré: ${creditRef}` }
            });

            // Create the Credit Note
            const creditNote = await tx.invoice.create({
                data: {
                    reference: creditRef,
                    type: 'AVOIR',
                    status: 'PAYEE',
                    clientId: invoice.clientId,
                    clientNameSnapshot: invoice.clientNameSnapshot,
                    totalHT: invoice.totalHT,
                    totalTTC: invoice.totalTTC,
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

            // RESTOCK ITEMS (Robust)
            for (const item of invoice.items) {
                if (item.productId) {
                    // Check if product still exists before updating
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
  // 4. LEGACY EXCHANGE ENGINE (Smart Returns)
  // Handles: Return (Create Stock + Avoir) -> New Sale (Decrement Stock + Facture)
  // =========================================================================
  processLegacyExchange: async (req: Request, res: Response) => {
    try {
        const { clientId, returnedItems, newItems, legacyRef } = req.body;

        if (!clientId || !returnedItems?.length) {
            return res.status(400).json({ error: "Client et articles retournés requis" });
        }

        const year = new Date().getFullYear();

        const result = await prismaLegal.$transaction(async (tx) => {
            const clientData = await tx.clientA.findUnique({ where: { id: clientId } });
            
            // --- STEP A: RETURNS (Create Stock & Credit Note) ---
            let creditTotalHT = new Prisma.Decimal(0);
            let creditTotalTTC = new Prisma.Decimal(0);
            const creditLines = [];
            
            for (const item of returnedItems) {
                const price = new Prisma.Decimal(item.priceHT);
                const cost = new Prisma.Decimal(item.purchaseCost || 0); 
                const qty = Math.floor(Number(item.quantity)); // FORCE INT
                const rate = new Prisma.Decimal(item.vatRate || 0.20);
                
                if (price.isNegative() || cost.isNegative() || qty <= 0) {
                    throw new Error(`Valeurs invalides pour l'article: ${item.name}`);
                }

                // 1. SMART PRODUCT LOOKUP (Prevent Duplicates)
                // Try to find product by Name to avoid spamming the DB
                let productId = '';
                const existingProduct = await tx.productA.findFirst({
                    where: { name: { equals: item.name, mode: 'insensitive' } }
                });

                if (existingProduct) {
                    // Update existing
                    await tx.productA.update({
                        where: { id: existingProduct.id },
                        data: { quantity: { increment: qty } }
                    });
                    productId = existingProduct.id;
                } else {
                    // Create New
                    const autoSerial = `RET-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                    const newProduct = await tx.productA.create({
                        data: {
                            name: item.name,
                            priceHT: price,
                            purchaseCost: cost,
                            quantity: qty,
                            vatRate: rate,
                            serialNumber: autoSerial,
                            measureUnit: 'UNIT',
                            technicalSpecs: `Retour Legacy (Ref: ${legacyRef || 'N/A'})`
                        }
                    });
                    productId = newProduct.id;
                }

                // 2. Financials
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

            const seqAvoir = await tx.invoiceSequence.upsert({
                where: { year: 9999 },
                update: { lastCount: { increment: 1 } },
                create: { year: 9999, lastCount: 1 }
            });
            const creditRef = `AVR-${year}-${seqAvoir.lastCount.toString().padStart(4, '0')}`;

            const creditNote = await tx.invoice.create({
                data: {
                    reference: creditRef,
                    legacyReference: legacyRef,
                    type: 'AVOIR',
                    status: 'PAYEE',
                    clientId,
                    clientNameSnapshot: clientData?.name,
                    totalHT: creditTotalHT,
                    totalTTC: creditTotalTTC,
                    note: `Retour Ancien Système (Stock Réintégré)`,
                    items: { create: creditLines }
                }
            });

            if (!newItems || newItems.length === 0) {
                return { creditNote, invoice: null, message: "Stock créé et Avoir généré avec succès." };
            }

            // --- STEP B: SALES (Exchange) ---
            let saleTotalHT = new Prisma.Decimal(0);
            let saleTotalTTC = new Prisma.Decimal(0);
            const saleLines = [];

            for (const item of newItems) {
                const product = await tx.productA.findUnique({ where: { id: item.productId } });
                const qty = Math.floor(Number(item.quantity)); // FORCE INT
                
                if (!product || product.quantity < qty) {
                    throw new Error(`Stock insuffisant: ${item.productName}`);
                }

                await tx.productA.update({
                    where: { id: item.productId },
                    data: { quantity: { decrement: qty } }
                });

                const price = new Prisma.Decimal(item.unitPrice);
                const rate = new Prisma.Decimal(item.vatRate);
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

            const seqFac = await tx.invoiceSequence.upsert({
                where: { year },
                update: { lastCount: { increment: 1 } },
                create: { year, lastCount: 1 }
            });
            const invoiceRef = `FAC-${year}-${seqFac.lastCount.toString().padStart(4, '0')}`;

            const balanceToPay = saleTotalTTC.sub(creditTotalTTC);
            const isFullyCovered = balanceToPay.lte(0);

            const invoice = await tx.invoice.create({
                data: {
                    reference: invoiceRef,
                    type: 'FACTURE',
                    status: isFullyCovered ? 'PAYEE' : 'EN_ATTENTE',
                    clientId,
                    clientNameSnapshot: clientData?.name,
                    totalHT: saleTotalHT,
                    totalTTC: saleTotalTTC,
                    amountPaid: isFullyCovered ? saleTotalTTC : creditTotalTTC,
                    note: `Echange contre Avoir ${creditRef}`,
                    items: { create: saleLines }
                }
            });

            await tx.payment.create({
                data: {
                    invoiceId: invoice.id,
                    amount: isFullyCovered ? saleTotalTTC : creditTotalTTC,
                    method: 'AVOIR',
                    reference: creditRef,
                    note: 'Réglement par Echange'
                }
            });

            return { creditNote, invoice, balanceDue: isFullyCovered ? 0 : balanceToPay };
        }, { timeout: 15000 }); 

        res.json(result);
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message || "Erreur échange" });
    }
  },

  // =========================================================================
  // 5. HELPER: CONVERT QUOTE TO INVOICE
  // =========================================================================
  convertQuote: async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const quote = await prismaLegal.invoice.findUnique({ where: { id }, include: { items: true } });
        if(!quote || quote.type !== 'DEVIS') return res.status(400).json({ error: "Devis invalide" });
        res.json(quote); 
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  },

  // =========================================================================
  // 6. HELPER: ADD PAYMENT MANUALLY
  // =========================================================================
  addPayment: async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { amount, method, note } = req.body;
        const result = await prismaLegal.$transaction(async (tx) => {
            const invoice = await tx.invoice.findUnique({ where: { id } });
            if (!invoice) throw new Error("Facture introuvable");
            
            const newTotalPaid = new Prisma.Decimal(invoice.amountPaid).add(new Prisma.Decimal(amount));
            const totalTTC = new Prisma.Decimal(invoice.totalTTC);
            
            await tx.payment.create({
                data: {
                    invoiceId: id,
                    amount: new Prisma.Decimal(amount),
                    method: method || 'ESPECES',
                    note
                }
            });
            
            // Allow 0.5 dhs difference for rounding tolerance
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

  // Legacy alias
  createCreditNote: async (req: Request, res: Response) => {
      return InvoicesController.cancelInvoice(req, res);
  }
};