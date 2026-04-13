import { PrismaClient, Prisma } from '../../node_modules/@marine/db-internal';
// ✅ Export the instance
export const prismaInternal = new PrismaClient();
// ✅ Export the namespace and ALL generated types (including UserRole)
export { Prisma };
export * from '../../node_modules/@marine/db-internal';
