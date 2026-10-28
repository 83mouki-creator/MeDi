/**
 * Applique les migrations versionnées sur la base cible.
 *
 *   npm run db:migrate           # utilise DIRECT_URL (Neon, connexion directe)
 *   TEST_DATABASE_URL=… npm run db:migrate
 *
 * En production (Neon), les migrations doivent passer par la connexion directe :
 * la connexion poolée (PgBouncer) ne garantit pas les verrous DDL.
 */
import { runMigrations } from '../src/db/migrate';
import { pool } from '../src/db';

async function main() {
  const target = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!target) {
    throw new Error('DIRECT_URL ou DATABASE_URL est requis pour appliquer les migrations.');
  }
  const host = new URL(target).host;
  console.log(`→ Application des migrations sur ${host}…`);
  await runMigrations(target);
  console.log('✅ Base à jour.');
}

main()
  .catch((error) => {
    console.error('❌ Migration impossible :', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
