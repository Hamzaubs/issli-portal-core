import { PrismaClient } from '@prisma/client-legal';

// ✅ Explicitly tell TypeScript the type
export const prismaLegal: PrismaClient = new PrismaClient();

export * from '@prisma/client-legal';