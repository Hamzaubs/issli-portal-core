// apps/api/src/scripts/reset-all.ts
import { PrismaClient as PrismaClientB } from '@prisma/client-stock-b';
import { PrismaClient as PrismaClientA } from '@prisma/client-legal';

const prismaB = new PrismaClientB();
const prismaA = new PrismaClientA();

async function main() {
  console.log('🗑️  STARTING FULL SYSTEM RESET...');

  // 1. CLEAN SILO B (Internal)
  console.log('🔹 Cleaning Silo B (Internal)...');
  await prismaB.stockMovement.deleteMany({}); // Delete History
  await prismaB.productB.deleteMany({});      // Delete Products
  await prismaB.clientB.deleteMany({});       // Delete Clients
  
  // 2. CLEAN SILO A (Legal)
  console.log('🔹 Cleaning Silo A (Legal)...');
  await prismaA.payment.deleteMany({});       // Delete Payments
  await prismaA.invoiceItem.deleteMany({});   // Delete Items
  await prismaA.invoice.deleteMany({});       // Delete Invoices
  await prismaA.productA.deleteMany({});      // Delete Products
  await prismaA.clientA.deleteMany({});       // Delete Clients
  
  // Reset Sequences if they exist
  try {
    await prismaA.invoiceSequence.deleteMany({});
    await prismaA.quoteSequence.deleteMany({});
  } catch (e) {}

  console.log('✅ SYSTEM WIPED CLEAN. ALL DATA IS 0.');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prismaB.$disconnect();
    await prismaA.$disconnect();
  });