import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// 1. Creamos el pool de conexiones hacia Supabase usando la URL de .env
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is missing.');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// 2. Definimos un tipo global en TypeScript para evitar errores de compilación
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 3. Reutilizamos la instancia si ya existe en desarrollo, o creamos una nueva
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// 4. Guardamos la instancia en globalThis solo si no estamos en producción
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}