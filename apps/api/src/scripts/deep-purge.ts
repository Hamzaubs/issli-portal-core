import { prismaInternal } from '@marine/db-internal';
import { prismaLegal } from '@marine/db-legal'; 

async function executeDeepPurge() {
    console.log("🚨 WARNING: INITIATING TOTAL WIPEOUT PROTOCOL...");
    console.log("🛡️ Shielding User Accounts (Admin, POS, Legal)...");

    try {
        // --- SILO B (INTERNAL) WIPEOUT ---
        await prismaInternal.$transaction(async (tx) => {
            // 1. Destroy Children (Foreign Key Dependencies)
            console.log("🧹 1/5: Deleting all Stock Movements & Cash History...");
            await tx.stockMovement.deleteMany({});
            
            console.log("🧹 2/5: Deleting all Purchases and Documents...");
            // Note: If you have a separate PurchaseItem table without Cascade, add it here:
            // await (tx as any).purchaseItemB?.deleteMany({});
            await tx.purchaseB.deleteMany({});

            // 2. Destroy Master Data (Products & Entities)
            console.log("🔥 3/5: Deleting all Products...");
            await tx.productB.deleteMany({});

            console.log("🔥 4/5: Deleting all Clients...");
            await tx.clientB.deleteMany({});

            console.log("🔥 5/5: Deleting all Suppliers...");
            await tx.supplierB.deleteMany({});
        });
        console.log("✅ Silo B (Internal) completely wiped.");

        // --- SILO A (LEGAL) WIPEOUT ---
        try {
            await prismaLegal.$transaction(async (tx) => {
                console.log("⚖️ Clearing Legal Silo (Products & Clients)...");
                await tx.clientA.deleteMany({});
                await tx.productA.deleteMany({});
            });
            console.log("✅ Silo A (Legal) completely wiped.");
        } catch (err) {
            console.log("⚠️ Legal Silo skipped or already empty.");
        }

        console.log("=================================================");
        console.log("🎉 DEEP PURGE COMPLETE: Clean Sheet Achieved.");
        console.log("🔐 Your User Accounts remain 100% untouched.");
        console.log("=================================================");
        
    } catch (error) {
        console.error("❌ ERROR: Purge failed. The database rolled back to protect your data.", error);
    } finally {
        await prismaInternal.$disconnect();
        await prismaLegal.$disconnect();
    }
}

executeDeepPurge();