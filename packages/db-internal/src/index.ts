import { PrismaClient } from './generated/client';
export const prismaInternal = new PrismaClient();
export * from './generated/client';