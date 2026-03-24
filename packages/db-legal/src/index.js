// packages/db-legal/index.ts
import { PrismaClient } from '../../node_modules/@prisma/client-legal';
export const prismaLegal = new PrismaClient();
export * from '../../node_modules/@prisma/client-legal';
