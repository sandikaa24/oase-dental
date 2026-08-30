import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton — mencegah hot-reload membuat instance baru.
 * Lihat: https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-help
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
