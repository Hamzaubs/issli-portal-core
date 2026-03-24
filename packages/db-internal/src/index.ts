import { PrismaClient } from '@prisma/client-stock-b';

export const prismaInternal = new PrismaClient();

// ✅ CRITICAL: This line exports the types (like PaymentMethod, ClientB, etc.)
export * from '@prisma/client-stock-b';