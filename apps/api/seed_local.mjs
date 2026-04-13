// apps/api/seed.mjs
import { PrismaClient } from '@marine/db-internal';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Generating test users for the Cloud...');
  
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const users = [
    { username: 'admin_test', password: hashedPassword, role: 'SUPER_ADMIN' },
    { username: 'pos_test', password: hashedPassword, role: 'POS_USER' },
    { username: 'legal_test', password: hashedPassword, role: 'LEGAL_USER' },
  ];

  for (const u of users) {
    const exists = await prisma.user.findUnique({ where: { username: u.username } });
    if (!exists) {
      await prisma.user.create({ data: u });
    }
  }

  console.log('✅ SUCCESS! Your staging database now has:');
  console.log('----------------------------------------');
  console.log('👑 Admin Portal -> User: admin_test | Pass: admin123');
  console.log('🛒 POS Terminal -> User: pos_test   | Pass: admin123');
  console.log('⚖️ Legal Portal -> User: legal_test | Pass: admin123');
  console.log('----------------------------------------');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });