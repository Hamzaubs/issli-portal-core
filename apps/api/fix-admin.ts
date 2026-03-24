import { PrismaClient } from '@marine/db-internal';
const prisma = new PrismaClient();

async function main() {
  // Remplacez 'admin' par votre nom d'utilisateur actuel
  const username = 'admin'; 

  await prisma.user.update({
    where: { username: username },
    data: { role: 'SUPER_ADMIN' }
  });
  console.log(`✅ L'utilisateur ${username} est maintenant SUPER_ADMIN !`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());