import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { resolveDirectUrl } from '../lib/db-url';

/**
 * Applique les migrations SQL versionnées du dossier `drizzle/`.
 * En production (Neon), utiliser DIRECT_URL : la connexion poolée ne permet pas
 * toujours les verrous DDL nécessaires aux migrations.
 */
export async function runMigrations(connectionString = resolveDirectUrl()) {
  if (!connectionString) {
    throw new Error(
      'Aucune connexion base de données : renseignez DATABASE_URL (poolée) — et DIRECT_URL ou DATABASE_URL_UNPOOLED pour les migrations.',
    );
  }
  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: /neon\.tech|sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
  });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: 'drizzle' });
  } finally {
    await pool.end();
  }
}
