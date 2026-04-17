import pkg from 'bcryptjs'; // Use bcryptjs for better compatibility
const bcrypt = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// 1. Load .env from root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 2. 🛡️ DIRECT GENERATED PATH IMPORT
// Based on your logs, the client was generated to packages/db-internal/src/generated/client
const { PrismaClient } = require('../../packages/db-internal/src/generated/client/index.js');

console.log('🔌 Connecting to Internal Database...');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_INTERNAL
    },
  },
});

async function main() {
  console.log('🌱 Generating users for Marine Ops...');
  
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // 🚨 AUDIT: These roles MUST match your frontend Dashboard.tsx logic
  const users = [
    { 
      username: 'admin', 
      password: hashedPassword, 
      role: 'SUPER_ADMIN' 
    },
    { 
      username: 'magasinier', 
      password: hashedPassword, 
      role: 'POS_USER'  // Changed from CASHIER
    },
    { 
      username: 'comptable', 
      password: hashedPassword, 
      role: 'LEGAL_USER' // Changed from LEGAL_ADMIN
    },
  ];

  for (const u of users) {
    const exists = await prisma.user.findUnique({ where: { username: u.username } });
    if (!exists) {
      await prisma.user.create({ data: u });
      console.log(`✅ Created: ${u.username} (${u.role})`);
    } else {
      console.log(`⚠️ Skipped: ${u.username} (Already exists)`);
    }
  }

  console.log('----------------------------------------');
  console.log('🚀 SEEDING SUCCESSFUL');
  console.log('----------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ SEED ERROR:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });