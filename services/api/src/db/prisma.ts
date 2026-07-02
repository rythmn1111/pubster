import { PrismaClient } from '@prisma/client';
// Importing this module also triggers boot-time env validation.
import { isProduction } from '../config/env.js';

/**
 * PrismaClient singleton.
 *
 * Reuses one instance across the process (and avoids exhausting connections
 * during dev hot-reload by stashing it on `globalThis`).
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['warn', 'error'] : ['query', 'warn', 'error'],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
