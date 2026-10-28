import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * Connexion applicative : utiliser l'URL *poolée* de Neon en production
 * (DATABASE_URL), et DIRECT_URL pour les migrations.
 * Un singleton est conservé sur globalThis pour éviter d'ouvrir un pool
 * à chaque rechargement à chaud en développement.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL est manquant. Copiez .env.example vers .env.local et renseignez la chaîne de connexion Neon.',
  );
}

const globalForDb = globalThis as unknown as {
  __mediPool?: Pool;
};

const pool =
  globalForDb.__mediPool ??
  new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: /neon\.tech|sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__mediPool = pool;
}

export const db = drizzle(pool, { schema, casing: 'snake_case' });
export { pool, schema };
export type Database = typeof db;
