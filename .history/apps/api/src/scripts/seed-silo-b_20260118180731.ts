// apps/api/src/scripts/seed-silo-b.ts
import { prismaInternal, UserRole } from '@marine/db-internal';
import bcrypt from 'bcryptjs';

async function main() {
  console.log("🌱 Restoring 3-Session Architecture Users...");

  // Hash the simple password "123"
  const password123 = await bcrypt.hash("123", 10);

  // 1. SUPER ADMIN (Access: Portal -> Admin / Legal / POS)
  await prismaInternal.user.upsert({
    where: { username: 'admin' },
    update: { password: password123, role: UserRole.SUPER_ADMIN },
    create: {
      username: 'admin',
      password: password123,
      role: UserRole.SUPER_ADMIN
    }
  });
  console.log("👤 Created 'admin' (SUPER_ADMIN)");

  // 2. LEGAL AGENT (Access: Portal -> Legal Only)
  await prismaInternal.user.upsert({
    where: { username: 'legal' },
    update: { password: password123, role: UserRole.LEGAL_USER },
    create: {
      username: 'legal',
      password: password123,
      role: UserRole.LEGAL_USER
    }
  });
  console.log("👤 Created 'legal' (LEGAL_USER)");

  // 3. POS AGENT (Access: Portal -> POS Only)
  await prismaInternal.user.upsert({
    where: { username: 'pos' },
    update: { password: password123, role: UserRole.POS_USER },
    create: {
      username: 'pos',
      password: password123,
      role: UserRole.POS_USER
    }
  });
  console.log("👤 Created 'pos' (POS_USER)");

  console.log("✅ 3-Session System Ready!");
  console.log("👉 Login with: admin/123, legal/123, or pos/123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaInternal.$disconnect();
  });