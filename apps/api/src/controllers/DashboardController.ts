// apps/api/src/controllers/DashboardController.ts
import { Request, Response } from 'express';
import { prismaInternal, MovementType, Prisma } from '@marine/db-internal'; 
import { prismaLegal } from '@marine/db-legal';

// ============================================================================
// 🧮 CENT-BASED MATH ENGINE & SERIALIZATION
// ============================================================================
const toNumber = (val: any) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'bigint') return Number(val);
    if (typeof val === 'object' && typeof val.toNumber === 'function') return val.toNumber();
    const parsed = Number(val);
    return isNaN(parsed) ? 0 : parsed;
};

const safeDecimal = (val: any): Prisma.Decimal => {
    if (!val) return new Prisma.Decimal(0);
    return new Prisma.Decimal(Number(val).toFixed(2));
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

const normalize = (str: string | null | undefined) => {
    if (!str) return '';
    return str.toString().trim().replace(/[\s\-\.]+/g, '').toLowerCase();
};

interface LegalClientMatch {
    id: string;
    name: string;
    ice: string | null;
    phone: string | null;
}

export const DashboardController = {
    getInternalAnalytics: async (req: Request, res: Response) => {
        try {
            const year = Number(req.query.year) || new Date().getFullYear();
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31, 23, 59, 59);

            const [movements, products] = await Promise.all([
                prismaInternal.stockMovement.findMany({
                    where: { createdAt: { gte: startDate, lte: endDate } },
                    select: {
                        type: true,
                        amount: true,
                        totalHT: true,
                        quantity: true,
                        snapshotPurchaseCost: true,
                        snapshotProductName: true,
                        createdAt: true
                    }
                }),
                prismaInternal.productB.findMany({ select: { quantity: true, purchaseCost: true, priceTTC: true, name: true } })
            ]);

            const monthlyData = Array.from({ length: 12 }, (_, i) => ({ month: i, revenue: 0, collected: 0, refunds: 0, quotes: 0 }));
            
            let totalRevHTCents = 0;
            let totalCostOfSalesCents = 0; 
            let totalRefundsCents = 0;
            let totalCollectedCents = 0;

            const productSalesMap = new Map<string, number>();

            movements.forEach(m => {
                const month = new Date(m.createdAt).getMonth();
                const amtSignedCents = Math.round(toNumber(m.amount) * 100);
                const amtAbsTTC = Math.abs(amtSignedCents);
                const amtHT = Math.round(toNumber(m.totalHT) * 100);
                const qty = Math.abs(toNumber(m.quantity));
                const costOfOneUnitCents = Math.round(toNumber(m.snapshotPurchaseCost) * 100);

                if (m.type === 'SALE_CASH' || m.type === 'SALE_CREDIT') {
                    totalRevHTCents += amtHT;
                    totalCostOfSalesCents += (qty * costOfOneUnitCents); // 🛡️ Only add cost for actual sales
                    monthlyData[month].revenue += (amtAbsTTC / 100);
                    
                    if (m.type === 'SALE_CASH') {
                        totalCollectedCents += amtAbsTTC;
                        monthlyData[month].collected += (amtAbsTTC / 100);
                    }

                    const pName = m.snapshotProductName || "Inconnu";
                    productSalesMap.set(pName, (productSalesMap.get(pName) || 0) + qty);
                } 
                else if (m.type === 'RETURN') {
                    totalRevHTCents -= amtHT;
                    totalCostOfSalesCents -= (qty * costOfOneUnitCents);
                    totalRefundsCents += amtAbsTTC;
                    monthlyData[month].refunds += (amtAbsTTC / 100);
                }
                else if (m.type === 'QUOTE') {
                    monthlyData[month].quotes += (amtAbsTTC / 100);
                }
            });

            const topProducts = Array.from(productSalesMap.entries())
                .map(([name, total]) => ({ name, total }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 5);

            res.json({
                kpi: {
                    grossMargin: (totalRevHTCents - totalCostOfSalesCents) / 100,
                    marginRate: totalRevHTCents > 0 ? ((totalRevHTCents - totalCostOfSalesCents) / totalRevHTCents) * 100 : 0,
                    totalRefunds: totalRefundsCents / 100,
                    stockValue: products.reduce((acc, p) => acc + (toNumber(p.quantity) * toNumber(p.purchaseCost)), 0),
                    stockPotential: products.reduce((acc, p) => acc + (toNumber(p.quantity) * toNumber(p.priceTTC)), 0)
                },
                metrics: {
                    revenue: { totalTTC: (totalCollectedCents + totalRevHTCents) / 100 }, // Simplified fallback
                    treasury: { realCash: totalCollectedCents / 100, totalDue: 0 },
                    pipeline: monthlyData.reduce((acc, m) => acc + m.quotes, 0),
                    stockValueCost: products.reduce((acc, p) => acc + (toNumber(p.quantity) * toNumber(p.purchaseCost)), 0)
                },
                charts: {
                    monthly: monthlyData,
                    topProducts: topProducts,
                    topClients: []
                },
                alerts: products.filter(p => toNumber(p.quantity) <= 5).map(p => ({ name: p.name, quantity: p.quantity }))
            });

        } catch (error) {
            console.error("Internal Analytics Error:", error);
            res.status(500).json({ error: "Erreur serveur analytique" });
        }
    },

    // 📦 KEEPING ALL OTHER METHODS EXACTLY AS THEY WERE
    getDailyTill: async (req: Request, res: Response) => {
        try {
            const dateParam = String(req.query.date || new Date().toISOString().split('T')[0]);
            const startDate = new Date(`${dateParam}T00:00:00.000Z`);
            const endDate = new Date(`${dateParam}T23:59:59.999Z`);
            const movements = await prismaInternal.stockMovement.findMany({
                where: { createdAt: { gte: startDate, lte: endDate }, paymentMethod: { in: ['CASH', 'ESPECES'] } }
            });
            let salesCents = 0; let clientPaymentsCents = 0; let supplierPaymentsCents = 0; let returnsCents = 0; let refundsCents = 0;
            movements.forEach(m => {
                const amountCents = Math.round(toNumber(m.amount) * 100);
                const absCents = Math.abs(amountCents);
                if (m.type === 'SALE_CASH') salesCents += absCents;
                else if (m.type === 'RETURN') returnsCents += absCents;
                else if (m.type === 'PAYMENT') {
                    if (m.supplierId) supplierPaymentsCents += absCents;
                    else clientPaymentsCents += absCents;
                } 
                else if (m.type === 'ADJUSTMENT') {
                    if (amountCents > 0) refundsCents += absCents;
                    else supplierPaymentsCents += absCents;
                }
            });
            const expectedTotalCents = (salesCents + clientPaymentsCents + refundsCents) - (returnsCents + supplierPaymentsCents);
            res.json({ sales: salesCents / 100, clientPayments: clientPaymentsCents / 100, supplierPayments: supplierPaymentsCents / 100, returns: returnsCents / 100, refunds: refundsCents / 100, expectedTotal: expectedTotalCents / 100 });
        } catch (error) { res.status(500).json({ error: "Erreur caisse" }); }
    },

    getProducts: async (req: Request, res: Response) => {
        try {
            const products = await prismaInternal.productB.findMany({ orderBy: { name: 'asc' } });
            res.json(products.map(p => ({ ...p, purchaseCost: toNumber(p.purchaseCost), priceHT: toNumber(p.priceHT), vatRate: toNumber(p.vatRate), priceTTC: toNumber(p.priceTTC), quantity: toNumber(p.quantity) })));
        } catch (e) { res.status(500).json({ error: "Erreur produits" }); }
    },

    createProduct: async (req: Request, res: Response) => {
        try {
            const { name, internalSku, purchaseCost, priceHT, vatRate, quantity, measureUnit, technicalSpecs } = req.body;
            const qty = Number(quantity);
            if (!name || !internalSku) return res.status(400).json({ error: "Nom et SKU obligatoires" });
            const safeVat = Number(vatRate) || 0;
            const safeHT = Number(priceHT) || 0;
            const math = calculateCentMath(safeHT, safeVat, 1);
            const result = await prismaInternal.$transaction(async (tx) => {
                const product = await tx.productB.create({ data: { name, internalSku, purchaseCost: safeDecimal(purchaseCost), priceHT: math.totalHT, vatRate: safeDecimal(safeVat), priceTTC: math.totalTTC, quantity: qty, measureUnit: measureUnit || 'UNIT', technicalSpecs } });
                if (qty > 0) {
                    await tx.stockMovement.create({ data: { productId: product.id, userId: (req as any).user?.id || null, quantity: qty, type: MovementType.RESTOCK, amount: 0, totalHT: 0, totalTVA: 0, snapshotPriceHT: math.totalHT, snapshotVatRate: safeDecimal(safeVat), snapshotPriceTTC: math.totalTTC, snapshotProductName: product.name } });
                }
                return product;
            });
            res.json(result);
        } catch (e) { res.status(500).json({ error: "Erreur création" }); }
    },

    updateProduct: async (req: Request, res: Response) => {
        try {
            const { id } = req.params; 
            const { name, purchaseCost, priceHT, vatRate, measureUnit, technicalSpecs } = req.body;
            const safeVat = Number(vatRate) || 0;
            const safeHT = Number(priceHT) || 0;
            const math = calculateCentMath(safeHT, safeVat, 1);
            await prismaInternal.productB.update({ where: { id }, data: { name, purchaseCost: safeDecimal(purchaseCost), priceHT: math.totalHT, vatRate: safeDecimal(safeVat), priceTTC: math.totalTTC, measureUnit, technicalSpecs } });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: "Erreur mise à jour" }); }
    },

    deleteProduct: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const count = await prismaInternal.stockMovement.count({ where: { productId: id } });
            if (count > 0) return res.status(400).json({ error: "Produit lié à des transactions." });
            await prismaInternal.productB.delete({ where: { id } });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: "Erreur suppression" }); }
    },

    getClients: async (req: Request, res: Response) => {
        try {
            const clientsB = await prismaInternal.clientB.findMany({ orderBy: { updatedAt: 'desc' }, take: 100 });
            const clientsA = await prismaLegal.clientA.findMany({ select: { id: true, name: true, ice: true, phone: true } });
            const enhancedClients = clientsB.map(cb => {
                const b_ice = normalize(cb.ice); const b_phone = normalize(cb.phone); const b_name = normalize(cb.name);
                const match = clientsA.find((ca: LegalClientMatch) => (b_ice.length > 3 && b_ice === normalize(ca.ice)) || (b_phone.length > 6 && b_phone === normalize(ca.phone)) || (b_name.length > 3 && b_name === normalize(ca.name)));
                return { ...cb, balance: toNumber(cb.balance), totalSpent: toNumber(cb.totalSpent), linkedLegalId: match ? match.id : null, linkedLegalName: match ? match.name : null };
            });
            res.json(enhancedClients);
        } catch (e) { res.status(500).json({ error: "Erreur clients" }); }
    },

    createClient: async (req: Request, res: Response) => {
        try {
            const { name, ice, address, city, phone, syncToLegal } = req.body;
            if (!name) return res.status(400).json({ error: "Nom obligatoire" });
            const clientB = await prismaInternal.clientB.create({ data: { name, ice, address, city, phone, balance: 0, totalSpent: 0 } });
            if (syncToLegal) await prismaLegal.clientA.create({ data: { id: clientB.id, name, ice, address, city, phone } }).catch(() => {});
            res.json(clientB);
        } catch (e) { res.status(500).json({ error: "Erreur client" }); }
    },

    updateClient: async (req: Request, res: Response) => {
        try {
            const { id } = req.params; const { name, ice, address, city, phone } = req.body;
            await prismaInternal.clientB.update({ where: { id }, data: { name, ice, address, city, phone } });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: "Erreur mise à jour" }); }
    },

    deleteClient: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const client = await prismaInternal.clientB.findUnique({ where: { id } });
            if (client && Math.abs(toNumber(client.balance)) > 0.1) return res.status(400).json({ error: "Solde non nul." });
            await prismaInternal.clientB.delete({ where: { id } });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: "Erreur suppression" }); }
    },

    getGlobalClientDetails: async (req: Request, res: Response) => {
        try {
            const { id } = req.params; 
            const clientB = await prismaInternal.clientB.findUnique({ where: { id } });
            if (!clientB) return res.status(404).json({ error: "Client introuvable" });
            const movements = await prismaInternal.stockMovement.findMany({ where: { clientId: id }, take: 10 });
            res.json({ profile: { ...clientB, balance: toNumber(clientB.balance) }, history: movements.map(m => ({ ...m, amount: toNumber(m.amount), quantity: toNumber(m.quantity) })) });
        } catch (e) { res.status(500).json({ error: "Erreur détails" }); }
    },

    getClientStatement: async (req: Request, res: Response) => {
        try {
            const { clientId } = req.params;
            const client = await prismaInternal.clientB.findUnique({ where: { id: clientId } });
            if (!client) return res.status(404).json({ error: "Client introuvable" });
            const allMovements = await prismaInternal.stockMovement.findMany({ where: { clientId, type: { in: [MovementType.SALE_CASH, MovementType.RETURN, MovementType.PAYMENT] } }, orderBy: { createdAt: 'asc' } });
            const history = allMovements.map(m => {
                const isSale = m.type === MovementType.SALE_CASH;
                return { date: m.createdAt, type: isSale ? 'VENTE' : m.type === MovementType.RETURN ? 'RETOUR' : 'PAIEMENT', ref: m.type === MovementType.PAYMENT ? `Reglement` : (m.snapshotProductName || 'Article'), debit: isSale ? toNumber(m.amount) : 0, credit: !isSale ? Math.abs(toNumber(m.amount)) : 0 };
            });
            let bal = 0; const statement = history.map(item => { bal = (bal - item.credit) + item.debit; return { ...item, balance: bal }; });
            res.json({ client, statement, finalBalance: bal });
        } catch (error) { res.status(500).json({ error: "Erreur relevé" }); }
    },

    getHistory: async (req: Request, res: Response) => {
        try {
            const movements = await prismaInternal.stockMovement.findMany({ take: 100, orderBy: { createdAt: 'desc' }, include: { product: true, client: true } });
            const grouped = movements.reduce((acc: any[], m) => {
                const key = m.batchId || m.id;
                let doc = acc.find(d => d.id === key);
                if (!doc) {
                    acc.push({ id: key, displayId: m.id.substring(0,8).toUpperCase(), type: m.type, productName: m.snapshotProductName || m.product?.name || "Inconnu", clientName: m.client?.name || "-", quantity: toNumber(m.quantity), amount: toNumber(m.amount), date: m.createdAt, itemCount: 1 });
                } else {
                    doc.amount += toNumber(m.amount); doc.itemCount += 1;
                }
                return acc;
            }, []).slice(0, 50);
            res.json(grouped);
        } catch (error) { res.status(500).json({ error: "Erreur historique" }); }
    },

    createTransaction: async (req: Request, res: Response) => {
        try {
            const { productId, userId, quantity, type, clientId, paymentMethod } = req.body;
            const qty = Number(quantity);
            await prismaInternal.$transaction(async (tx) => {
                const product = await tx.productB.findUnique({ where: { id: productId } });
                if (!product) throw new Error("Produit introuvable");
                const math = calculateCentMath(toNumber(product.priceHT), toNumber(product.vatRate), qty);
                const amount = math.totalTTC.toNumber();
                let inc = (type === MovementType.SALE_CASH) ? -qty : (type === MovementType.RETURN ? qty : 0);
                if (inc < 0 && toNumber(product.quantity) < qty) throw new Error("Stock insuffisant");
                if (inc !== 0) await tx.productB.update({ where: { id: productId }, data: { quantity: { increment: inc } } });
                if (clientId) await tx.clientB.update({ where: { id: clientId }, data: { totalSpent: { increment: amount }, balance: { increment: paymentMethod === 'CREDIT' ? amount : 0 } } });
                await tx.stockMovement.create({ data: { productId, userId: userId || null, clientId: clientId || null, quantity: qty, type, paymentMethod: paymentMethod || 'CASH', amount: math.totalTTC, totalHT: math.totalHT, totalTVA: math.totalTVA, snapshotProductName: product.name, snapshotPriceHT: product.priceHT, snapshotVatRate: product.vatRate, snapshotPriceTTC: product.priceTTC, snapshotPurchaseCost: product.purchaseCost } });
            });
            res.json({ success: true });
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    createPayment: async (req: Request, res: Response) => {
        try {
            const { clientId, amount, method, reference, note, userId } = req.body;
            await prismaInternal.$transaction(async (tx) => {
                const p = await tx.productB.findFirst();
                if (!p) throw new Error("Aucun produit trouvé.");
                await tx.stockMovement.create({ data: { type: MovementType.PAYMENT, clientId, amount: new Prisma.Decimal(amount).neg(), quantity: 0, paymentMethod: method, paymentRef: reference, snapshotProductName: note || "Paiement", userId: userId || null, productId: p.id, totalHT: new Prisma.Decimal(0), totalTVA: new Prisma.Decimal(0) } });
                await tx.clientB.update({ where: { id: clientId }, data: { balance: { decrement: toNumber(amount) } } });
            });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: "Erreur paiement" }); }
    }
};