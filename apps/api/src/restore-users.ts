// apps/api/src/restore-users.ts
import { PrismaClient } from '../../../packages/db-internal'; 
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Restoring Users in DB-INTERNAL (All 3 Roles)...');

  // Hash password "123456"
  const salt = await bcrypt.genSalt(10);
  const password = await bcrypt.hash('123456', salt);

  // 1. Create SUPER ADMIN (Global Access)
  try {
      await prisma.user.upsert({
        where: { username: 'admin' },
        update: { password, role: 'SUPER_ADMIN' },
        create: {
          username: 'admin',
          password: password,
          role: 'SUPER_ADMIN',
        },
      });
      console.log('✅ ADMIN Created:  user="admin" / pass="123456"');
  } catch (e: any) {
      console.error("⚠️ Admin Error:", e.message);
  }

  // 2. Create LEGAL USER (Silo A - Factures/Devis)
  try {
      await prisma.user.upsert({
        where: { username: 'legal' },
        update: { password, role: 'LEGAL_USER' },
        create: {
          username: 'legal',
          password: password,
          role: 'LEGAL_USER', 
        },
      });
      console.log('✅ LEGAL Created:  user="legal" / pass="123456"');
  } catch (e: any) {
      console.error("⚠️ Legal User Error:", e.message);
  }

  // 3. Create POS USER (Silo B - Stock/Operations)
  try {
      await prisma.user.upsert({
        where: { username: 'pos' },
        update: { password, role: 'POS_USER' },
        create: {
          username: 'pos',
          password: password,
          role: 'POS_USER', 
        },
      });
      console.log('✅ POS Created:    user="pos"   / pass="123456"');
  } catch (e: any) {
      console.error("⚠️ POS User Error:", e.message);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());