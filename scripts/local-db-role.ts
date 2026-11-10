/**
 * Vérifie et répare le rôle PostgreSQL du cluster local.
 *
 * `initdb` crée le superutilisateur du cluster ; si le cluster a été initialisé
 * par une version antérieure du projet (utilisateur `medi`), le nom du rôle ne
 * correspond plus à celui attendu (`perokado`) et toute connexion est refusée.
 * On se connecte alors avec l'ancien rôle, on crée le nouveau avec le bon mot de
 * passe et on lui donne les droits — puis on vérifie que la connexion passe.
 *
 *   npx tsx scripts/local-db-role.ts            # vérifie / répare le rôle
 */
import { Client } from 'pg';

const HOST = '127.0.0.1';
const PORT = Number(process.env.LOCAL_PG_PORT ?? 55432);
const USER = process.env.LOCAL_PG_USER ?? 'perokado';
const PASSWORD = process.env.LOCAL_PG_PASSWORD ?? 'perokado';
/** Rôles des clusters initialisés avant le renommage de la boutique. */
const LEGACY_USERS = ['medi'];

async function connect(user: string, password: string, database: string) {
  const client = new Client({ host: HOST, port: PORT, user, password, database });
  await client.connect();
  return client;
}

async function main() {
  const url = (user: string) => `${HOST}:${PORT} (rôle ${user})`;

  try {
    const client = await connect(USER, PASSWORD, 'postgres');
    await client.end();
    console.log(`[db] rôle ${url(USER)} opérationnel`);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[db] rôle « ${USER} » indisponible (${message.split('\n')[0]})`);
  }

  for (const legacy of LEGACY_USERS) {
    let client: Client;
    try {
      client = await connect(legacy, legacy, 'postgres');
    } catch {
      continue;
    }
    console.log(`[db] cluster initialisé avec le rôle « ${legacy} » : création de « ${USER} »`);
    const { rows } = await client.query('select 1 from pg_roles where rolname = $1', [USER]);
    if (rows.length === 0) {
      await client.query(`create role "${USER}" with login superuser password '${PASSWORD.replace(/'/g, "''")}'`);
    } else {
      await client.query(`alter role "${USER}" with login superuser password '${PASSWORD.replace(/'/g, "''")}'`);
    }
    await client.end();

    // Les bases existantes doivent appartenir au nouveau rôle.
    const admin = await connect(USER, PASSWORD, 'postgres');
    const { rows: databases } = await admin.query<{ datname: string }>(
      "select datname from pg_database where datname <> 'template0' and datname <> 'postgres'",
    );
    for (const { datname } of databases) {
      await admin.query(`alter database "${datname}" owner to "${USER}"`).catch(() => undefined);
    }
    await admin.end();

    const check = await connect(USER, PASSWORD, 'postgres');
    await check.end();
    console.log(`[db] rôle ${url(USER)} opérationnel (réparé)`);
    return;
  }

  throw new Error(
    `Aucun rôle utilisable sur le cluster local. Supprimez le dossier .localdb/ puis relancez « npm run db:local » pour le réinitialiser.`,
  );
}

main().catch((error) => {
  console.error('[db] échec :', error.message);
  process.exitCode = 1;
});
