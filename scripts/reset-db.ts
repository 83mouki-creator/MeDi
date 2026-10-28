/**
 * ⚠️  DÉVELOPPEMENT UNIQUEMENT — supprime et recrée la base locale.
 *
 *   npm run db:reset
 *
 * Refuse de s'exécuter si l'URL ne pointe pas vers localhost : aucune donnée de
 * production ne peut être effacée par erreur.
 */
import pg from 'pg';
import { runMigrations } from '../src/db/migrate';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL manquant.');
  const parsed = new URL(url);
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    throw new Error(`Refus : ${parsed.hostname} n’est pas une base locale.`);
  }
  const database = parsed.pathname.replace(/^\//, '');
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';

  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [database]);
  await admin.query(`DROP DATABASE IF EXISTS "${database.replace(/"/g, '')}"`);
  await admin.query(`CREATE DATABASE "${database.replace(/"/g, '')}" ENCODING 'UTF8'`);
  await admin.end();

  await runMigrations(url);
  console.log(`✅ Base ${database} recréée et migrée. Lancez maintenant : npm run db:seed`);
}

main().catch((error) => {
  console.error('❌ Réinitialisation impossible :', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
