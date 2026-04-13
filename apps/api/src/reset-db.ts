import { PrismaClient as PrismaClientLegal } from '@marine/db-legal';
import { PrismaClient as PrismaClientInternal } from '@marine/db-internal';

const prismaLegal = new PrismaClientLegal();
const prismaInternal = new PrismaClientInternal();

async function main() {
    console.log("🧹 DÉMARRAGE DU NETTOYAGE DES BASES DE DONNÉES...");

    try {
        // ==========================================
        // 1. WIPE SILO A (LEGAL)
        // ==========================================
        console.log("🗑️ Nettoyage du Silo A (Facturation)...");
        // Delete children first
        await prismaLegal.invoiceItem.deleteMany({});
        await prismaLegal.payment.deleteMany({});
        // Delete parents
        await prismaLegal.invoice.deleteMany({});
        await prismaLegal.productA.deleteMany({});
        await prismaLegal.clientA.deleteMany({});
        // Reset sequences
        await prismaLegal.invoiceSequence.deleteMany({});
        await prismaLegal.quoteSequence.deleteMany({});
        console.log("✅ Silo A nettoyé.");

        // ==========================================
        // 2. WIPE SILO B (INTERNAL)
        // ==========================================
        console.log("🗑️ Nettoyage du Silo B (Magasin)...");
        // Delete children first
        await prismaInternal.stockMovement.deleteMany({});
        // Delete parents
        await prismaInternal.productB.deleteMany({});
        await prismaInternal.clientB.deleteMany({});
        
        // 🛑 NOTE: We DO NOT delete prismaInternal.user.deleteMany()
        
        console.log("✅ Silo B nettoyé. (Utilisateurs conservés).");

        console.log("🎉 SYSTÈME PRÊT POUR LA PRODUCTION !");

    } catch (error) {
        console.error("❌ Erreur lors du nettoyage:", error);
    } finally {
        await prismaLegal.$disconnect();
        await prismaInternal.$disconnect();
    }
}

main();