import { PrismaClient } from '@prisma/client';

// Append connection params for Neon serverless — higher timeouts for cold starts
const url = process.env.DATABASE_URL ?? '';
const sep = url.includes('?') ? '&' : '?';
const dbUrl = `${url}${sep}connect_timeout=30&pool_timeout=30`;

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  datasources: {
    db: { url: dbUrl },
  },
});
