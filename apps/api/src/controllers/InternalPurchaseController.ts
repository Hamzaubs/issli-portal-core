// apps/api/src/controllers/InternalPurchaseController.ts
import { Request, Response } from 'express';
import { prismaInternal, MovementType, Prisma } from '@marine/db-internal'; 
import { v4 as uuidv4 } from 'uuid';

const toNumber = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'object' && 'toNumber' in val) return val.toNumber();
    return Number(val);
};

const calculateCentMath = (ht: number, vatRate: number, qty: number = 1) => {
    const totalHTCents = Math.round(ht * qty * 100);
    const totalTTCCents = Math.round(totalHTCents * (1 + vatRate));
    const totalTVACents = totalTTCCents - totalHTCents;
    
    return {
        totalHT: new Prisma.Decimal((totalHTCents / 100).toFixed(2)),
        totalTTC: new Prisma.Decimal((totalTTCCents / 100).toFixed(2)),
        totalTVA: new Prisma.Decimal((totalTVACents / 100).toFixed(2))
    };
};

// 🛡️ HELPER: Guarantees a system product exists for financial movements without altering DB schema
const getSysFinanceProduct = async (tx: any) => {
    let sys = await tx.productB.findUnique({ where: { internalSku: 'SYS-FINANCE' } });
    if (!sys) {
        sys = await tx.productB.create({
            data: { id: uuidv4(), name: 'Mouvement Financier Global', internalSku: 'SYS-FINANCE', purchaseCost: 0, priceHT: 0, vatRate: 0, priceTTC: 0, quantity: 0, measureUnit: 'UNIT' }
        });
    }
    return sys;
};

export const InternalPurchaseController = {
  createSupplier: async (req: Request, res: Response) => {
    try {
      const { name, phone, ice, address, contactName } = req.body;
      if (!name) return res.status(400).json({ error: "Nom obligatoire" });
      const supplier = await prismaInternal.supplierB.create({
        data: { id: uuidv4(), name, phone, ice, address, contactName, balance: 0, totalPurchased: 0 }
      });
      res.json(supplier);
    } catch (e) { res.status(500).json({ error: "Erreur création fournisseur interne" }); }
  },

  getSuppliers: async (req: Request, res: Response) => {
    try {
      const suppliers = await prismaInternal.supplierB.findMany({ orderBy: { name: 'asc' } });
      res.json(suppliers.map(s => ({ ...s, balance: toNumber(s.balance), totalPurchased: toNumber(s.totalPurchased) })));
    } catch (e) { res.status(500).json({ error: "Erreur chargement fournisseurs" }); }
  },

  deleteSupplier: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          
          const supplier = await prismaInternal.supplierB.findUnique({ where: { id } });
          if (!supplier) return res.status(404).json({ error: "Fournisseur introuvable." });

          // 1. Count the financial footprint
          const purchaseCount = await prismaInternal.purchaseB.count({ where: { supplierId: id } });
          const movementCount = await prismaInternal.stockMovement.count({ where: { supplierId: id } });
          const balance = toNumber(supplier.balance);

          // 2. The Shield: Block if there is ANY history
          if (purchaseCount > 0 || movementCount > 0 || balance !== 0) {
              return res.status(403).json({ 
                  error: `🛡️ Protection : Impossible de supprimer "${supplier.name}" car ce fournisseur est lié à ${purchaseCount} document(s) et ${movementCount} mouvement(s). Le supprimer corromprait votre historique comptable.` 
              });
          }

          // 3. Safe to delete
          await prismaInternal.supplierB.delete({ where: { id } });
          res.json({ success: true, message: "Fournisseur supprimé avec succès." });
      } catch (error: any) {
          console.error("🔥 ERREUR deleteSupplier:", error);
          res.status(500).json({ error: "Erreur serveur lors de la tentative de suppression." });
      }
  },

  createPurchase: async (req: Request, res: Response) => {
    try {
      const { supplierId, reference, type, items, note, initialPayment, paymentMethod, paymentRef } = req.body;
      const rawUserId = (req as any).user?.id;
      let amountPaid = Number(initialPayment) || 0;

      // 🛡️ UI FAILSFE: If method is CREDIT, enforce 0 payment
      if (paymentMethod === 'CREDIT') amountPaid = 0;

      const isFacture = type === 'FACTURE_ACHAT';
      const isReception = type === 'BON_RECEPTION';

      const result = await prismaInternal.$transaction(async (tx) => {
          // 🛡️ REFERENCE COLLISION SHIELD
          const finalReference = reference ? String(reference).trim() : `${isFacture ? 'ACH' : isReception ? 'BR' : 'BC'}-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 10000)}`;
          
          const existingRef = await tx.purchaseB.findUnique({ where: { reference: finalReference } });
          if (existingRef) {
              throw new Error(`La référence de document '${finalReference}' existe déjà. Veuillez utiliser un numéro unique.`);
          }

          const supplier = await tx.supplierB.findUnique({ where: { id: supplierId } });
          if (!supplier) throw new Error("Fournisseur introuvable");
          const safeUserId = rawUserId ? (await tx.user.findUnique({ where: { id: rawUserId } }) ? rawUserId : null) : null;

          // 🧮 SECURITY FIX: Aggregate strictly in CENTS to prevent drift
          let totalHTCents = 0; let totalTTCCents = 0; const formattedItems = [];

          for (const item of items) {
              const qty = Number(item.quantity) || 0;
              if (qty <= 0) continue; 
              const priceHT = Number(item.unitPriceHT) || 0;
              const vat = Number(item.vatRate) || 0.20;
              const math = calculateCentMath(priceHT, vat, qty);
              
              totalHTCents += Math.round(math.totalHT.toNumber() * 100);
              totalTTCCents += Math.round(math.totalTTC.toNumber() * 100);

              formattedItems.push({
                  id: uuidv4(), productId: item.productId || null, productName: item.productName || 'Article sans nom',
                  quantity: qty, unitPriceHT: priceHT, vatRateSnapshot: vat, mathData: math
              });
          }
          
          if (formattedItems.length === 0) throw new Error("Le document ne contient aucun article avec une quantité valide.");
          
          const totalHT = totalHTCents / 100;
          const totalTTC = totalTTCCents / 100;
          
          if (amountPaid > totalTTC) throw new Error(`Le montant payé (${amountPaid} DH) ne peut pas dépasser le total TTC du document (${totalTTC} DH).`);

          const purchase = await tx.purchaseB.create({
              data: {
                  id: uuidv4(), 
                  reference: finalReference,
                  supplierId, type: type || 'FACTURE_ACHAT',
                  status: amountPaid >= totalTTC ? 'PAYEE' : (amountPaid > 0 ? 'PARTIEL' : 'EN_ATTENTE'),
                  totalHT, totalTTC, amountPaid, note,
                  supplierNameSnapshot: supplier.name, supplierIceSnapshot: supplier.ice,
                  items: { create: formattedItems.map(i => ({ id: i.id, productId: i.productId, productName: i.productName, quantity: i.quantity, unitPriceHT: i.unitPriceHT, vatRateSnapshot: i.vatRateSnapshot })) }
              },
              include: { items: true }
          });

          // 🧮 DEBT & PAYMENT MATH IN CENTS
          const amountPaidCents = Math.round(amountPaid * 100);

          if (isFacture) {
              const debtCents = totalTTCCents - amountPaidCents;
              await tx.supplierB.update({
                  where: { id: supplierId },
                  data: { totalPurchased: { increment: totalTTC }, balance: { increment: debtCents / 100 } }
              });
          } else if (amountPaidCents > 0) {
              await tx.supplierB.update({
                  where: { id: supplierId },
                  data: { balance: { decrement: amountPaidCents / 100 } }
              });
          }

          if (amountPaidCents > 0) {
              // 🛡️ Link acompte to the first valid product or system dummy
              const linkProductId = formattedItems[0]?.productId || (await getSysFinanceProduct(tx)).id;
              
              await tx.stockMovement.create({
                  data: {
                      userId: safeUserId, supplierId, quantity: 0, type: MovementType.PAYMENT,
                      amount: new Prisma.Decimal(amountPaidCents / 100).negated(), // Drains the till
                      totalHT: new Prisma.Decimal(0), totalTVA: new Prisma.Decimal(0),
                      paymentMethod: paymentMethod, paymentRef: paymentRef || `Acompte: ${purchase.reference}`,
                      snapshotProductName: `Paiement / Acompte (${type})`, productId: linkProductId
                  }
              });
          }

          if (isFacture || isReception) {
              for (const item of formattedItems) {
                  if (item.productId) { 
                      const product = await tx.productB.findUnique({ where: { id: item.productId } });
                      if (product) {
                          await tx.productB.update({
                              where: { id: item.productId },
                              data: { quantity: { increment: item.quantity }, purchaseCost: item.unitPriceHT }
                          });
                          await tx.stockMovement.create({
                              data: {
                                  productId: item.productId, userId: safeUserId, supplierId, quantity: item.quantity, type: MovementType.RESTOCK,
                                  amount: new Prisma.Decimal(0), 
                                  totalHT: item.mathData.totalHT, totalTVA: item.mathData.totalTVA,
                                  paymentMethod: null, paymentRef: `Mouvement: ${purchase.reference}`,
                                  snapshotPurchaseCost: item.unitPriceHT, snapshotPriceHT: product.priceHT, snapshotVatRate: product.vatRate, snapshotPriceTTC: product.priceTTC,
                                  snapshotProductName: `[RECEPTION: ${supplier.name}] ${product.name}`
                              }
                          });
                      }
                  }
              }
          }

          return purchase;
      });
      res.status(201).json(result);
    } catch (e: any) { res.status(400).json({ error: e.message || "Erreur achat" }); }
  },

  // 🚨 Enterprise Void / Reversal Engine
  voidPurchase: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const rawUserId = (req as any).user?.id;

          const result = await prismaInternal.$transaction(async (tx) => {
              const purchase = await tx.purchaseB.findUnique({ 
                  where: { id }, 
                  include: { items: true } 
              });

              if (!purchase) throw new Error("Document introuvable.");
              if (purchase.status === 'ANNULEE') throw new Error("Ce document est déjà annulé.");
              if (purchase.type === 'PAIEMENT') throw new Error("Les règlements isolés ne peuvent pas être annulés ici.");

              const isFacture = purchase.type === 'FACTURE_ACHAT';
              const isReception = purchase.type === 'BON_RECEPTION';
              
              // 🧮 SECURITY FIX: Cent-Math Debt Reversal
              const amountPaidCents = Math.round(toNumber(purchase.amountPaid) * 100);
              const totalTTCCents = Math.round(toNumber(purchase.totalTTC) * 100);

              // 1. Mark the document as permanently voided
              await tx.purchaseB.update({
                  where: { id },
                  data: { status: 'ANNULEE' }
              });

              // 2. REVERSE ACCOUNTS PAYABLE
              if (isFacture) {
                  const debtCents = totalTTCCents - amountPaidCents;
                  await tx.supplierB.update({
                      where: { id: purchase.supplierId },
                      data: { 
                          totalPurchased: { decrement: totalTTCCents / 100 }, 
                          balance: { decrement: debtCents / 100 } 
                      }
                  });
              } else if (amountPaidCents > 0) {
                  // Reversing an advance payment on a Bon de Commande
                  await tx.supplierB.update({
                      where: { id: purchase.supplierId },
                      data: { balance: { increment: amountPaidCents / 100 } }
                  });
              }

              // 3. 💰 REVERSE TREASURY (Refund the cash)
              if (amountPaidCents > 0) {
                  const sysFinanceProduct = await getSysFinanceProduct(tx);
                  await tx.stockMovement.create({
                      data: {
                          userId: rawUserId, supplierId: purchase.supplierId, quantity: 0, type: MovementType.ADJUSTMENT,
                          amount: new Prisma.Decimal(amountPaidCents / 100), // POSITIVE: Cash returning to your drawer
                          totalHT: new Prisma.Decimal(0), totalTVA: new Prisma.Decimal(0),
                          paymentMethod: 'CASH', paymentRef: `Annulation: ${purchase.reference}`,
                          snapshotProductName: `Remboursement Suite Annulation (${purchase.type})`, productId: sysFinanceProduct.id
                      }
                  });
              }

              // 4. 📦 REVERSE PHYSICAL STOCK
              if (isFacture || isReception) {
                  for (const item of purchase.items) {
                      if (item.productId) { 
                          await tx.productB.update({
                              where: { id: item.productId },
                              data: { quantity: { decrement: toNumber(item.quantity) } }
                          });
                          await tx.stockMovement.create({
                              data: {
                                  productId: item.productId, userId: rawUserId, supplierId: purchase.supplierId, 
                                  quantity: -toNumber(item.quantity), type: MovementType.ADJUSTMENT,
                                  amount: new Prisma.Decimal(0), 
                                  totalHT: new Prisma.Decimal(0), totalTVA: new Prisma.Decimal(0),
                                  paymentRef: `Annulation: ${purchase.reference}`,
                                  snapshotPurchaseCost: item.unitPriceHT, 
                                  snapshotProductName: `[RETOUR / ANNULATION] ${item.productName}`
                              }
                          });
                      }
                  }
              }
              return purchase;
          });
          res.json({ success: true, message: "Document annulé avec succès" });
      } catch (e: any) { res.status(400).json({ error: e.message || "Erreur lors de l'annulation" }); }
  },

  registerPayment: async (req: Request, res: Response) => {
      try {
          const { id } = req.params; 
          const { amount, method, reference, note } = req.body;
          
          // 🧮 SECURITY FIX: Validate cleanly via Cents to prevent raw float injection
          const payAmtCents = Math.round(Number(amount) * 100);
          if (payAmtCents <= 0) return res.status(400).json({ error: "Montant invalide" });

          await prismaInternal.$transaction(async (tx) => {
              // 🛡️ REFERENCE COLLISION SHIELD FOR PAYMENTS
              const finalReference = reference ? String(reference).trim() : `PAY-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 10000)}`;
              const existingRef = await tx.purchaseB.findUnique({ where: { reference: finalReference } });
              if (existingRef) {
                  throw new Error(`La référence de paiement '${finalReference}' existe déjà. Veuillez utiliser une référence unique.`);
              }

              const supplier = await tx.supplierB.findUnique({ where: { id } });
              if (!supplier) throw new Error("Fournisseur introuvable");
              
              const balanceCents = Math.round(toNumber(supplier.balance) * 100);
              
              if (balanceCents <= 0) throw new Error("Ce fournisseur n'a aucune dette en cours.");
              if (payAmtCents > balanceCents) throw new Error(`Impossible de payer plus que la dette actuelle (${balanceCents / 100} DH).`);

              const safePayAmount = new Prisma.Decimal((payAmtCents / 100).toFixed(2));

              await tx.supplierB.update({ where: { id }, data: { balance: { decrement: safePayAmount } } });

              await tx.purchaseB.create({
                  data: {
                      id: uuidv4(), supplierId: id, reference: finalReference,
                      type: 'PAIEMENT', totalHT: 0, totalTTC: 0, amountPaid: safePayAmount,
                      note: note || `Règlement Fournisseur (${method})`,
                      supplierNameSnapshot: supplier.name, supplierIceSnapshot: supplier.ice, status: 'PAYEE'
                  }
              });
              
              const sysFinanceProduct = await getSysFinanceProduct(tx);
              
              await tx.stockMovement.create({
                  data: {
                      supplierId: id, quantity: 0, type: MovementType.PAYMENT,
                      amount: safePayAmount.negated(), totalHT: new Prisma.Decimal(0), totalTVA: new Prisma.Decimal(0),
                      paymentMethod: method, paymentRef: finalReference, snapshotProductName: note || `Règlement Fournisseur`,
                      productId: sysFinanceProduct.id
                  }
              });
          });
          res.json({ success: true });
      } catch (e: any) { res.status(400).json({ error: e.message || "Erreur paiement" }); }
  },

  getPurchaseHistory: async (req: Request, res: Response) => {
    try {
      const purchases = await prismaInternal.purchaseB.findMany({ include: { supplier: { select: { name: true } }, items: true }, orderBy: { issuedAt: 'desc' } });
      res.json(purchases);
    } catch (e) { res.status(500).json({ error: "Erreur historique achats" }); }
  },

  getSupplierStatement: async (req: Request, res: Response) => {
      try {
          const { id } = req.params;
          const supplier = await prismaInternal.supplierB.findUnique({ where: { id } });
          if (!supplier) return res.status(404).json({ error: "Fournisseur introuvable dans la base de données." });

          const purchases = await prismaInternal.purchaseB.findMany({ where: { supplierId: id }, orderBy: { issuedAt: 'asc' } });
          const history: any[] = [];
          
          purchases.forEach(p => {
              if (p.type !== 'PAIEMENT') {
                  const creditAmount = p.type === 'FACTURE_ACHAT' ? toNumber(p.totalTTC) : 0;
                  history.push({ id: p.id + '-doc', date: p.issuedAt || new Date(), type: p.type || 'DOCUMENT', ref: p.reference || 'N/A', debit: 0, credit: creditAmount, note: p.note || '' });
                  if (toNumber(p.amountPaid) > 0) {
                      history.push({ id: p.id + '-pay', date: p.issuedAt || new Date(), type: 'PAIEMENT (Acompte)', ref: `Acompte: ${p.reference || 'N/A'}`, debit: toNumber(p.amountPaid), credit: 0, note: 'Acompte versé' });
                  }
              } else {
                  history.push({ id: p.id, date: p.issuedAt || new Date(), type: 'PAIEMENT', ref: p.reference || 'N/A', debit: toNumber(p.amountPaid), credit: 0, note: p.note || '' });
              }
          });

          history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          let runningBalance = 0;
          const statement = history.map(item => {
              runningBalance = (Math.round(runningBalance * 100) + Math.round(item.credit * 100) - Math.round(item.debit * 100)) / 100;
              return { ...item, balance: runningBalance };
          });

          res.json({ supplier, statement, finalBalance: runningBalance });
      } catch (error) {
          console.error("🔥 FATAL ERROR IN getSupplierStatement:", error);
          res.status(500).json({ error: "Erreur serveur lors de la génération du relevé. Vérifiez la console." }); 
      }
  }
};