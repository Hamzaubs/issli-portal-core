// packages/db-legal/index.ts
import { PrismaClient } from '../../node_modules/@marine/db-legal';
export const prismaLegal = new PrismaClient();
export * from '../../node_modules/@marine/db-legal';
