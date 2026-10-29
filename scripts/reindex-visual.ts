/**
 * Indexation visuelle du catalogue.
 *
 * Calcule l'empreinte visuelle de chaque photo produit et l'enregistre dans
 * `product_images.embedding` (+ `embedding_model`, `embedding_dim`). Sans cette
 * étape, la recherche par photo n'a rien à comparer : le site l'affiche clairement
 * au visiteur au lieu de prétendre que la fonctionnalité est active.
 *
 *   npm run reindex:visual              # uniquement les images non indexées
 *   npm run reindex:visual -- --all     # tout recalculer (après changement de modèle)
 *   npm run reindex:visual -- --limit=50
 */
import { sql } from 'drizzle-orm';
import { db, pool } from '../src/db';
import { indexImage, providerInfo } from '../src/lib/visual';

function flag(name: string) {
  return process.argv.includes(`--${name}`);
}
function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const info = providerInfo();
  console.log(`Empreinte visuelle : ${info.label} — disponible : ${info.available ? 'oui' : 'non'}`);
  if (!info.available) {
    console.error(`❌ ${info.note}`);
    process.exitCode = 1;
    return;
  }

  const all = flag('all');
  const limit = Number(option('limit') ?? 5000);

  // Seules les photos de fiches publiées sont indexées : inutile d'empreindre
  // le catalogue archivé (démo), qui n'apparaît jamais dans les résultats.
  const rows = (
    await db.execute(sql`
      SELECT pi.id, pi.url, pi.alt FROM product_images pi
      JOIN products p ON p.id = pi.product_id
      WHERE p.is_active = true AND p.is_archived = false
        ${all ? sql`` : sql`AND pi.embedding IS NULL`}
      ORDER BY pi.created_at DESC
      LIMIT ${limit}
    `)
  ).rows as { id: string; url: string; alt: string | null }[];

  console.log(`${rows.length} image(s) à traiter${all ? ' (recalcul complet)' : ' (nouvelles uniquement)'}.`);

  let done = 0;
  let failed = 0;
  const startedAt = Date.now();

  for (const row of rows) {
    try {
      const result = await indexImage({ imageId: row.id, url: row.url, table: 'product_images' });
      if (!result.ok) {
        failed += 1;
        console.warn(`  ⚠️  ${row.url} : ${result.reason}`);
        continue;
      }
      done += 1;
      if (done % 25 === 0) console.log(`  … ${done}/${rows.length}`);
    } catch (error) {
      failed += 1;
      console.warn(`  ⚠️  ${row.url} : ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const remaining = await db.execute(sql`
    SELECT count(*)::int AS n FROM product_images pi
    JOIN products p ON p.id = pi.product_id
    WHERE pi.embedding IS NULL AND p.is_active = true AND p.is_archived = false
  `);
  const left = (remaining.rows as { n: number }[])[0]?.n ?? 0;

  console.log(`✅ ${done} indexée(s), ${failed} échec(s), ${left} restante(s) — ${Math.round((Date.now() - startedAt) / 1000)}s`);
  if (left > 0) console.log('   Relancez la commande : seules les images non indexées sont reprises.');
}

main()
  .catch((error) => {
    console.error('❌ Indexation interrompue :', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
