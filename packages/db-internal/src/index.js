import { PrismaClient, Prisma } from '../../node_modules/@prisma/client-stock-b';
// ✅ Export the instance
export const prismaInternal = new PrismaClient();
// ✅ Export the namespace and ALL generated types (including UserRole)
export { Prisma };
export * from '../../node_modules/@prisma/client-stock-b';
