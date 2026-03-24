import { prismaLegal } from '@marine/db-legal';

async function main() {
  console.log('🌱 Seeding Silo A (Legal)...');

  // 1. Clean up (Order matters due to foreign keys)
  // We delete "Child" items first, then "Parent" items
  try {
      await prismaLegal.payment.deleteMany({}); // Delete payments first
      await prismaLegal.invoiceItem.deleteMany({});
      await prismaLegal.invoice.deleteMany({});
      
      // ⚠️ FIX: Use 'clientA' instead of 'client'
      await prismaLegal.clientA.deleteMany({}); 
      
      await prismaLegal.productA.deleteMany({});
  } catch (error) {
      console.log("⚠️ Cleanup skipped (Tables might be empty)");
  }

  // 2. Create a Test Client
  console.log('👤 Creating Test Client...');
  // ⚠️ FIX: Use 'clientA' instead of 'client'
  const client = await prismaLegal.clientA.create({
    data: {
      name: 'CLIENT TEST SARL',
      ice: '001122334455',
      address: '123 Bd Mohamed V',
      city: 'Casablanca',
      phone: '0661000000'
    }
  });

  // 3. Create a Test Product
  console.log('📦 Creating Test Product...');
  await prismaLegal.productA.create({
    data: {
      name: 'Moteur Hors-Bord Yamaha 40CV',
      serialNumber: 'YAM-40-TEST-001',
      priceHT: 45000,
      purchaseCost: 38000,
      vatRate: 0.20,
      quantity: 5,
      measureUnit: 'UNIT'
    }
  });

  console.log('✅ Silo A Seeded Successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaLegal.$disconnect();
  });