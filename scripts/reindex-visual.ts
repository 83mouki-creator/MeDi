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
import { and, isNull, sql } from 'drizzle-orm';
import { db, pool } from '../src/db';
import { productImages } from '../src/db/schema';
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

  const rows = await db
    .select({ id: productImages.id, url: productImages.url, alt: productImages.alt })
    .from(productImages)
    .where(all ? undefined : and(isNull(productImages.embedding)))
    .limit(limit);

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

  const remaining = await db.execute(sql`SELECT count(*)::int AS n FROM product_images WHERE embedding IS NULL`);
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
