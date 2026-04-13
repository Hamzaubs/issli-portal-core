// apps/api/seed.mjs
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Load .env from root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 3. 🛡️ DIRECT PATH IMPORT (Bypasses ESM resolution issues)
// This points directly to where Prisma generated your Stock B client
import pkg from '../../node_modules/@marine/db-internal/index.js';
const { PrismaClient } = pkg;

console.log('🔌 Connecting to Local DB...');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_INTERNAL
    },
  },
});

async function main() {
  console.log('🌱 Generating test users for Localhost...');
  
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
      console.log(`✅ Created: ${u.username}`);
    } else {
      console.log(`⚠️ Skipped: ${u.username} (Already exists)`);
    }
  }

  console.log('----------------------------------------');
  console.log('✅ SUCCESS!');
  console.log('----------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ SEED ERROR: Ensure you ran "npx prisma generate" for Silo B first.');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });