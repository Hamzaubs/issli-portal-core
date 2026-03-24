import { prismaInternal, UserRole } from '@marine/db-internal';
import * as bcrypt from 'bcryptjs';

async function main() {
  console.log("🌱 Restoring 3-Session Architecture Users (Silo B)...");

  // Hash the simple password "123" (or "123456" if you prefer)
  const password = await bcrypt.hash("123", 10);

  // 1. SUPER ADMIN (Access: Portal -> Admin / Legal / POS)
  await prismaInternal.user.upsert({
    where: { username: 'admin' },
    update: { password, role: UserRole.SUPER_ADMIN },
    create: {
      username: 'admin',
      password,
      role: UserRole.SUPER_ADMIN
    }
  });
  console.log("👤 Created 'admin' (SUPER_ADMIN) - Pass: 123");

  // 2. LEGAL AGENT (Access: Portal -> Legal Only)
  await prismaInternal.user.upsert({
    where: { username: 'legal' },
    update: { password, role: UserRole.LEGAL_USER },
    create: {
      username: 'legal',
      password,
      role: UserRole.LEGAL_USER
    }
  });
  console.log("👤 Created 'legal' (LEGAL_USER) - Pass: 123");

  // 3. POS AGENT (Access: Portal -> POS Only)
  await prismaInternal.user.upsert({
    where: { username: 'pos' },
    update: { password, role: UserRole.POS_USER },
    create: {
      username: 'pos',
      password,
      role: UserRole.POS_USER
    }
  });
  console.log("👤 Created 'pos' (POS_USER) - Pass: 123");

  console.log("✅ 3-Session System Ready!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaInternal.$disconnect();
  });