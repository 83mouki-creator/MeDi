import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

/**
 * Applique les migrations SQL versionnées du dossier `drizzle/`.
 * En production (Neon), utiliser DIRECT_URL : la connexion poolée ne permet pas
 * toujours les verrous DDL nécessaires aux migrations.
 */
export async function runMigrations(connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DIRECT_URL / DATABASE_URL manquant pour exécuter les migrations');
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
