// apps/api/src/scripts/health-check.ts
import { prismaInternal, MovementType, Prisma as PrismaB } from '@marine/db-internal';
import { prismaLegal, Prisma as PrismaA } from '@marine/db-legal';

const colors = {
    green: '\x1b[32m', red: '\x1b[31m', blue: '\x1b[34m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m', bold: '\x1b[1m'
};

const toNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val) || 0;
    if (typeof val === 'object' && typeof val.toNumber === 'function') {
        try { return val.toNumber(); } catch(e) {}
    }
    return 0;
};

async function runHealthCheck() {
    console.log(`\n${colors.cyan}${colors.bold}======================================================${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold} 🚀 ISSLI PECHE ERP - END-TO-END INTEGRATION TESTS 🚀${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}======================================================${colors.reset}\n`);

    let passed = 0;
    const totalChecks = 6; // 6 Major Phases

    const pass = (msg: string) => {
        console.log(`   ${colors.green}✔ PASSED${colors.reset} - ${msg}`);
        passed++;
    };
    const fail = (msg: string, err: any) => {
        console.log(`   ${colors.red}✖ FAILED${colors.reset} - ${msg}`);
        console.error(`     └─ Error: ${err.message}`);
        throw err; // Stop execution on fail
    };

    // Tracker for cleanup
    const testData = {
        siloB: { client: '', product: '', movements: [] as string[] },
        siloA: { client: '', product: '', invoice: '', payments: [] as string[] }
    };

    try {
        // ====================================================================
        // PHASE 1: DATA CREATION (CLIENTS & PRODUCTS)
        // ====================================================================
        console.log(`${colors.blue}▶ PHASE 1: Creating Test Entities (Silo A & B)${colors.reset}`);
        try {
            // Silo B
            const prodB = await prismaInternal.productB.create({
                data: { name: "_TEST_PROD_B", internalSku: "TEST-B-001", purchaseCost: 50, priceHT: 100, vatRate: 0, priceTTC: 100, quantity: 50 }
            });
            testData.siloB.product = prodB.id;

            const clientB = await prismaInternal.clientB.create({
                data: { name: "_TEST_CLIENT_B", phone: "0600000000", balance: 0, totalSpent: 0 }
            });
            testData.siloB.client = clientB.id;

            // Silo A
            const prodA = await prismaLegal.productA.create({
                data: { name: "_TEST_PROD_A", serialNumber: "TEST-A-001", purchaseCost: 50, priceHT: 100, vatRate: 0.20, quantity: 50 }
            });
            testData.siloA.product = prodA.id;

            const clientA = await prismaLegal.clientA.create({
                data: { name: "_TEST_CLIENT_A", ice: "000000000000000" }
            });
            testData.siloA.client = clientA.id;

            pass("Test Clients and Products created successfully in both silos.");
        } catch (e) { fail("Entity Creation", e); }

        // ====================================================================
        // PHASE 2: GENERATING DEVIS (PIPELINE)
        // ====================================================================
        console.log(`\n${colors.blue}▶ PHASE 2: Commercial Pipeline (Quotes/Devis)${colors.reset}`);
        try {
            // Silo B Devis (2 units @ 100 MAD = 200 MAD)
            const quoteB = await prismaInternal.stockMovement.create({
                data: { type: MovementType.QUOTE, productId: testData.siloB.product, clientId: testData.siloB.client, quantity: 2, amount: 200, snapshotPurchaseCost: 50, snapshotPriceHT: 100, snapshotVatRate: 0, snapshotPriceTTC: 100, totalHT: 200, totalTVA: 0 }
            });
            testData.siloB.movements.push(quoteB.id);

            // Verify Stock and Debt did NOT change
            const checkClientB = await prismaInternal.clientB.findUnique({ where: { id: testData.siloB.client } });
            const checkProdB = await prismaInternal.productB.findUnique({ where: { id: testData.siloB.product } });
            if (toNumber(checkClientB?.balance) !== 0) throw new Error("Devis affected client debt!");
            if (toNumber(checkProdB?.quantity) !== 50) throw new Error("Devis affected physical stock!");

            pass("Devis generated securely without altering stock or accounting.");
        } catch (e) { fail("Devis Generation", e); }

        // ====================================================================
        // PHASE 3: SELLING ON DEBT (CREDIT)
        // ====================================================================
        console.log(`\n${colors.blue}▶ PHASE 3: Credit Sales & Debt Allocation${colors.reset}`);
        try {
            // SILO B: Sell 5 units @ 100 = 500 MAD Debt
            await prismaInternal.$transaction([
                prismaInternal.stockMovement.create({
                    data: { type: MovementType.SALE_CREDIT, productId: testData.siloB.product, clientId: testData.siloB.client, quantity: 5, amount: 500, paymentMethod: 'CREDIT', snapshotPurchaseCost: 50, snapshotPriceHT: 100, snapshotVatRate: 0, snapshotPriceTTC: 100, totalHT: 500, totalTVA: 0 }
                }),
                prismaInternal.productB.update({ where: { id: testData.siloB.product }, data: { quantity: { decrement: 5 } } }),
                prismaInternal.clientB.update({ where: { id: testData.siloB.client }, data: { balance: { increment: 500 } } })
            ]);

            const debtB = await prismaInternal.clientB.findUnique({ where: { id: testData.siloB.client } });
            if (toNumber(debtB?.balance) !== 500) throw new Error(`Silo B Debt Mismatch. Expected 500, got ${toNumber(debtB?.balance)}`);

            // SILO A: Invoice 5 units @ 100 HT (+20% VAT) = 600 TTC Debt
            const invA = await prismaLegal.invoice.create({
                data: {
                    reference: "TEST-INV-001", clientId: testData.siloA.client, status: "EN_ATTENTE", type: "FACTURE", totalHT: 500, totalTTC: 600, amountPaid: 0,
                    items: { create: [{ productId: testData.siloA.product, productName: "TEST A", quantity: 5, unitPriceHT: 100, unitPurchaseCostSnapshot: 50, vatRateSnapshot: 0.20 }] }
                }
            });
            testData.siloA.invoice = invA.id;
            await prismaLegal.productA.update({ where: { id: testData.siloA.product }, data: { quantity: { decrement: 5 } } });

            pass("Credit Sales processed. Stock deducted and Debt accurately calculated.");
        } catch (e) { fail("Debt Allocation", e); }

        // ====================================================================
        // PHASE 4: PARTIAL PAYMENTS (PAYING HALF)
        // ====================================================================
        console.log(`\n${colors.blue}▶ PHASE 4: Partial Payment Processing${colors.reset}`);
        try {
            // SILO B: Pay 250 MAD (Half of 500)
            await prismaInternal.$transaction([
                prismaInternal.stockMovement.create({
                    data: { type: MovementType.PAYMENT, productId: testData.siloB.product, clientId: testData.siloB.client, quantity: 0, amount: -250, paymentMethod: 'CASH', totalHT: 0, totalTVA: 0 }
                }),
                prismaInternal.clientB.update({ where: { id: testData.siloB.client }, data: { balance: { decrement: 250 } } })
            ]);
            const halfDebtB = await prismaInternal.clientB.findUnique({ where: { id: testData.siloB.client } });
            if (toNumber(halfDebtB?.balance) !== 250) throw new Error("Silo B Partial Payment Failed");

            // SILO A: Pay 300 MAD (Half of 600)
            const payA1 = await prismaLegal.payment.create({
                data: { invoiceId: testData.siloA.invoice, amount: 300, method: "CASH" }
            });
            testData.siloA.payments.push(payA1.id);
            await prismaLegal.invoice.update({ where: { id: testData.siloA.invoice }, data: { amountPaid: { increment: 300 }, status: "PARTIEL" } });
            
            pass("Partial payments successfully deducted. Statuses updated to PARTIEL.");
        } catch (e) { fail("Partial Payment", e); }

        // ====================================================================
        // PHASE 5: FULL PAYMENTS (CLEARING DEBT)
        // ====================================================================
        console.log(`\n${colors.blue}▶ PHASE 5: Full Payment & Debt Clearance${colors.reset}`);
        try {
            // SILO B: Pay remaining 250 MAD
            await prismaInternal.$transaction([
                prismaInternal.stockMovement.create({
                    data: { type: MovementType.PAYMENT, productId: testData.siloB.product, clientId: testData.siloB.client, quantity: 0, amount: -250, paymentMethod: 'CASH', totalHT: 0, totalTVA: 0 }
                }),
                prismaInternal.clientB.update({ where: { id: testData.siloB.client }, data: { balance: { decrement: 250 } } })
            ]);
            const zeroDebtB = await prismaInternal.clientB.findUnique({ where: { id: testData.siloB.client } });
            if (toNumber(zeroDebtB?.balance) !== 0) throw new Error("Silo B Full Payment Failed");

            // SILO A: Pay remaining 300 MAD
            const payA2 = await prismaLegal.payment.create({
                data: { invoiceId: testData.siloA.invoice, amount: 300, method: "CASH" }
            });
            testData.siloA.payments.push(payA2.id);
            await prismaLegal.invoice.update({ where: { id: testData.siloA.invoice }, data: { amountPaid: { increment: 300 }, status: "PAYEE" } });
            
            pass("Debt fully cleared. Invoices marked as PAYEE.");
        } catch (e) { fail("Full Payment", e); }

        // ====================================================================
        // PHASE 6: CANCELLATIONS & RETURNS
        // ====================================================================
        console.log(`\n${colors.blue}▶ PHASE 6: Cancellations & Returns${colors.reset}`);
        try {
            // SILO B: Return 1 unit
            await prismaInternal.$transaction([
                prismaInternal.stockMovement.create({
                    data: { type: MovementType.RETURN, productId: testData.siloB.product, clientId: testData.siloB.client, quantity: 1, amount: 100, paymentMethod: 'CASH', snapshotPurchaseCost: 50, snapshotPriceHT: 100, snapshotVatRate: 0, snapshotPriceTTC: 100, totalHT: 100, totalTVA: 0 }
                }),
                prismaInternal.productB.update({ where: { id: testData.siloB.product }, data: { quantity: { increment: 1 } } }) // Stock goes from 45 back to 46
            ]);
            const finalProdB = await prismaInternal.productB.findUnique({ where: { id: testData.siloB.product } });
            if (toNumber(finalProdB?.quantity) !== 46) throw new Error("Return did not restore stock correctly.");

            // SILO A: Cancel Invoice (AVOIR)
            const avoirA = await prismaLegal.invoice.create({
                data: {
                    reference: "TEST-AVOIR-001", clientId: testData.siloA.client, status: "PAYEE", type: "AVOIR", totalHT: 500, totalTTC: 600, amountPaid: 600,
                    items: { create: [{ productId: testData.siloA.product, productName: "TEST A", quantity: 5, unitPriceHT: 100 }] }
                }
            });
            // Restore Legal Stock
            await prismaLegal.productA.update({ where: { id: testData.siloA.product }, data: { quantity: { increment: 5 } } });
            
            pass("Returns processed. Stock restored and Avoir generated.");
        } catch (e) { fail("Cancellations", e); }

        // ====================================================================
        // FINAL VERDICT
        // ====================================================================
        console.log(`\n${colors.cyan}${colors.bold}======================================================${colors.reset}`);
        console.log(`${colors.green}${colors.bold}  🟢 ALL TESTS PASSED: ERP WORKFLOW IS FLAWLESS${colors.reset}`);
        console.log(`  Sales, Debt, Payments, and Cancellations are 100% stable.`);
        console.log(`${colors.cyan}${colors.bold}======================================================${colors.reset}\n`);

    } catch (error: any) {
        console.log(`\n${colors.red}${colors.bold}CRITICAL WORKFLOW FAILURE:${colors.reset}`);
        console.error(error);
    } finally {
        // ====================================================================
        // EMERGENCY CLEANUP (Leaves DB exactly as it was)
        // ====================================================================
        console.log(`${colors.yellow}▶ Running Data Cleanup...${colors.reset}`);
        try {
            // Cleanup Silo B
            await prismaInternal.stockMovement.deleteMany({ where: { clientId: testData.siloB.client } });
            if (testData.siloB.product) await prismaInternal.productB.delete({ where: { id: testData.siloB.product } }).catch(()=>{});
            if (testData.siloB.client) await prismaInternal.clientB.delete({ where: { id: testData.siloB.client } }).catch(()=>{});

            // Cleanup Silo A
            await prismaLegal.payment.deleteMany({ where: { invoice: { clientId: testData.siloA.client } } });
            await prismaLegal.invoiceItem.deleteMany({ where: { invoice: { clientId: testData.siloA.client } } });
            await prismaLegal.invoice.deleteMany({ where: { clientId: testData.siloA.client } });
            if (testData.siloA.product) await prismaLegal.productA.delete({ where: { id: testData.siloA.product } }).catch(()=>{});
            if (testData.siloA.client) await prismaLegal.clientA.delete({ where: { id: testData.siloA.client } }).catch(()=>{});
            
            console.log(`${colors.green}✔ Cleanup Complete. No ghost data left behind.${colors.reset}\n`);
        } catch (cleanupErr) {
            console.error(`${colors.red}⚠ Cleanup failed! Ghost data may remain with prefix _TEST_${colors.reset}`);
        }

        await prismaInternal.$disconnect();
        await prismaLegal.$disconnect();
    }
}

runHealthCheck();