/**
 * Applique les migrations versionnées sur la base cible.
 *
 *   npm run db:migrate
 *
 * Connexion utilisée, par ordre de priorité :
 *   1. DIRECT_URL                 (création manuelle Neon — recommandé)
 *   2. DATABASE_URL_UNPOOLED      (intégration Neon sur Vercel)
 *   3. POSTGRES_URL_NON_POOLING   (ancien Vercel Postgres)
 *   4. DATABASE_URL avec l'hôte `-pooler` retiré (dérivation)
 *
 * En production, les migrations doivent passer par une connexion directe : le
 * pooler ne garantit pas les verrous DDL.
 */
import { runMigrations } from '../src/db/migrate';
import { pool } from '../src/db';
import { resolveDirectUrlWithSource, safeHost } from '../src/lib/db-url';

async function main() {
  const { url, source } = resolveDirectUrlWithSource();
  if (!url) {
    throw new Error(
      'Aucune connexion configurée. Ajoutez DATABASE_URL (poolée) et DIRECT_URL (directe) dans les variables d’environnement.',
    );
  }

  console.log(`→ Migrations sur ${safeHost(url)} (source : ${source})`);
  await runMigrations(url);
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
