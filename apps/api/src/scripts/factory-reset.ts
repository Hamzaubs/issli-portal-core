// apps/api/src/scripts/factory-reset.ts
import { prismaInternal } from '@marine/db-internal';
import { prismaLegal } from '@marine/db-legal';

const colors = { green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' };

async function runFactoryReset() {
    console.log(`\n${colors.red}======================================================${colors.reset}`);
    console.log(`${colors.red} ⚠️  INITIATING FACTORY RESET (WIPING ALL DATA) ⚠️${colors.reset}`);
    console.log(`${colors.red}======================================================${colors.reset}\n`);

    try {
        console.log(`${colors.yellow}▶ Wiping SILO A (Legal Accounting)...${colors.reset}`);
        // Must delete in this exact order to prevent Foreign Key constraint errors
        await prismaLegal.payment.deleteMany();
        console.log(`  - Deleted Legal Payments`);
        await prismaLegal.invoiceItem.deleteMany();
        console.log(`  - Deleted Legal Invoice Items`);
        await prismaLegal.invoice.deleteMany();
        console.log(`  - Deleted Legal Invoices & Avoirs`);
        await prismaLegal.productA.deleteMany();
        console.log(`  - Deleted Legal Products`);
        await prismaLegal.clientA.deleteMany();
        console.log(`  - Deleted Legal Clients`);
        await prismaLegal.invoiceSequence.deleteMany();
        await prismaLegal.quoteSequence.deleteMany();
        console.log(`  - Reset Document Sequences (Invoices will start from #1 again)`);

        console.log(`\n${colors.yellow}▶ Wiping SILO B (Internal Operations)...${colors.reset}`);
        await prismaInternal.stockMovement.deleteMany();
        console.log(`  - Deleted All POS Transactions, Returns & Quotes`);
        await prismaInternal.productB.deleteMany();
        console.log(`  - Deleted All Internal Products`);
        await prismaInternal.clientB.deleteMany();
        console.log(`  - Deleted All Internal Clients`);
        
        console.log(`\n${colors.cyan}ℹ️  NOTE: Admin Users and Company Settings were KEPT intact so you can still log in.${colors.reset}`);

        console.log(`\n${colors.green}======================================================${colors.reset}`);
        console.log(`${colors.green} 🟢 FACTORY RESET SUCCESSFUL: SYSTEM IS 100% CLEAN${colors.reset}`);
        console.log(`${colors.green}======================================================${colors.reset}\n`);

    } catch (error) {
        console.error(`${colors.red}Failed to reset database:${colors.reset}`, error);
    } finally {
        await prismaInternal.$disconnect();
        await prismaLegal.$disconnect();
    }
}

runFactoryReset();