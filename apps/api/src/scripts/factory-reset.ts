// apps/api/src/scripts/factory-reset.ts
import { prismaInternal } from '@marine/db-internal';
import { prismaLegal } from '@marine/db-legal';

async function runFactoryReset() {
    console.log("⚠️ INITIATING FACTORY RESET...");
    console.log("⚠️ WARNING: ALL TRANSACTIONAL DATA WILL BE DESTROYED.");
    console.log("✅ Users and Authentication data will be PRESERVED.\n");

    try {
        // ==========================================
        // 🧹 1. WIPE SILO B (INTERNAL)
        // ==========================================
        console.log("🧹 Wiping Silo B (Internal Database)...");
        
        // Delete child records first (Foreign Key constraint)
        const deletedMovements = await prismaInternal.stockMovement.deleteMany({});
        console.log(`   - Deleted ${deletedMovements.count} Stock Movements`);

        // Delete parent records
        const deletedProductsB = await prismaInternal.productB.deleteMany({});
        const deletedClientsB = await prismaInternal.clientB.deleteMany({});
        console.log(`   - Deleted ${deletedProductsB.count} Products (Silo B)`);
        console.log(`   - Deleted ${deletedClientsB.count} Clients (Silo B)`);


        // ==========================================
        // 🧹 2. WIPE SILO A (LEGAL)
        // ==========================================
        console.log("\n🧹 Wiping Silo A (Legal Database)...");

        // Delete child records first
        const deletedPayments = await prismaLegal.payment.deleteMany({});
        const deletedInvoiceItems = await prismaLegal.invoiceItem.deleteMany({});
        console.log(`   - Deleted ${deletedPayments.count} Payments`);
        console.log(`   - Deleted ${deletedInvoiceItems.count} Invoice Items`);

        // Delete Documents
        const deletedInvoices = await prismaLegal.invoice.deleteMany({});
        console.log(`   - Deleted ${deletedInvoices.count} Invoices/Devis/Avoirs`);

        // Delete Parent records
        const deletedProductsA = await prismaLegal.productA.deleteMany({});
        const deletedClientsA = await prismaLegal.clientA.deleteMany({});
        // Note: If you have a Supplier table in db-legal, uncomment the next line:
        // const deletedSuppliers = await prismaLegal.supplier.deleteMany({}); 

        console.log(`   - Deleted ${deletedProductsA.count} Products (Silo A)`);
        console.log(`   - Deleted ${deletedClientsA.count} Clients (Silo A)`);
        // console.log(`   - Deleted ${deletedSuppliers?.count || 0} Suppliers`);

        // ==========================================
        // 🔄 3. RESET COUNTERS (FAC-2026-0001)
        // ==========================================
        console.log("\n🔄 Resetting Document Sequences...");
        await prismaLegal.invoiceSequence.deleteMany({});
        await prismaLegal.quoteSequence.deleteMany({});
        console.log("   - Document counters reset to 1");

        console.log("\n✅ FACTORY RESET COMPLETE! Your ERP is clean and ready for production.");

    } catch (error) {
        console.error("\n❌ ERROR DURING FACTORY RESET:");
        console.error(error);
    } finally {
        await prismaInternal.$disconnect();
        await prismaLegal.$disconnect();
    }
}

runFactoryReset();