/**
 * Prépare la base de données utilisée par la suite de tests.
 *
 *   npm run test:setup
 *
 * - crée la base `medi_test` si elle n'existe pas (sur le cluster local
 *   démarré par `npm run db:local`, ou sur TEST_DATABASE_URL) ;
 * - applique toutes les migrations versionnées du dossier `drizzle/`.
 *
 * La base de test est indépendante de la base de développement : aucun test ne
 * touche les données de la boutique.
 */
import pg from 'pg';
import { runMigrations } from '../src/db/migrate';

const TEST_URL = process.env.TEST_DATABASE_URL ?? 'postgres://medi:medi@127.0.0.1:55432/medi_test';

function adminUrl(url: string): { admin: string; database: string } {
  const parsed = new URL(url);
  const database = parsed.pathname.replace(/^\//, '') || 'medi_test';
  parsed.pathname = '/postgres';
  return { admin: parsed.toString(), database };
}

async function main() {
  const { admin, database } = adminUrl(TEST_URL);
  const client = new pg.Client({ connectionString: admin });

  try {
    await client.connect();
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (existing.rowCount === 0) {
      // Identifiant contrôlé (pas d'entrée utilisateur) — guillemets obligatoires pour le nom.
      await client.query(`CREATE DATABASE "${database.replace(/"/g, '')}" ENCODING 'UTF8'`);
      console.log(`✅ Base de test créée : ${database}`);
    } else {
      console.log(`ℹ️  Base de test déjà présente : ${database}`);
    }
  } finally {
    await client.end().catch(() => undefined);
  }

  await runMigrations(TEST_URL);
  console.log('✅ Migrations appliquées sur la base de test.');
  console.log(`   TEST_DATABASE_URL=${TEST_URL}`);
}

main().catch((error) => {
  console.error('❌ Préparation de la base de test impossible :', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
