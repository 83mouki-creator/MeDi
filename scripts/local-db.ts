/**
 * PostgreSQL local de développement / tests.
 *
 * Lance un vrai serveur PostgreSQL (binaire embarqué) sur le port 55432 avec des
 * données persistées dans `.localdb/`, crée la base `medi` si besoin puis applique
 * les migrations. Utile quand aucune instance Neon n'est encore disponible :
 * le schéma, les migrations et les requêtes sont strictement les mêmes.
 *
 *   npm run db:local          # démarre et garde le serveur actif
 *   DATABASE_URL=... npm run db:seed
 */
import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';
import { runMigrations } from '../src/db/migrate';

const PORT = Number(process.env.LOCAL_PG_PORT ?? 55432);
const USER = process.env.LOCAL_PG_USER ?? 'medi';
const PASSWORD = process.env.LOCAL_PG_PASSWORD ?? 'medi';
const DATABASE = process.env.LOCAL_PG_DB ?? 'medi';
const DATA_DIR = process.env.LOCAL_PG_DIR ?? '.localdb/data';

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    // Encodage UTF-8 indispensable pour le français (accents, caractères ivoiriens).
    initdbFlags: ['--encoding=UTF8', '--locale=C.UTF-8'],
    onLog: () => {},
    onError: (m) => console.error('[pg]', m),
  });

  const fs = await import('node:fs');
  const fresh = !fs.existsSync(`${DATA_DIR}/PG_VERSION`);

  if (fresh) {
    console.log(`[db] initialisation du cluster dans ${DATA_DIR}…`);
    await pg.initialise();
  }
  await pg.start();
  console.log(`[db] PostgreSQL démarré sur 127.0.0.1:${PORT} (utilisateur ${USER})`);

  if (fresh) {
    await pg.createDatabase(DATABASE);
    console.log(`[db] base « ${DATABASE} » créée`);
    const boot = new Client({ host: '127.0.0.1', port: PORT, user: USER, password: PASSWORD, database: DATABASE });
    await boot.connect();
    await boot.query(`ALTER DATABASE "${DATABASE}" SET timezone TO 'Africa/Abidjan'`);
    await boot.end();
  }

  const url = `postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DATABASE}`;

  // Vérifie que la connexion fonctionne avant de migrer.
  const client = new Client({ connectionString: url });
  await client.connect();
  const { rows } = await client.query('select current_database() as db');
  await client.end();
  console.log(`[db] connecté à ${rows[0].db}`);

  await runMigrations(url);
  console.log('[db] migrations appliquées');
  console.log(`[db] DATABASE_URL=${url}`);

  const shutdown = async () => {
    console.log('\n[db] arrêt…');
    try {
      await pg.stop();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[db] échec :', error);
  process.exit(1);
});
