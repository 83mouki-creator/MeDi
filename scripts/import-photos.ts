/**
 * Import en masse des photos produits (200+ fichiers).
 *
 *   npm run import:photos -- --dir=./photos --dry-run
 *   npm run import:photos -- --dir=./photos
 *   npm run import:photos -- --dir=./photos --assign   # rattache les photos dont
 *                                                      # le nom contient une référence existante
 *
 * Fonctionnement :
 *  1. chaque fichier est validé (type réel, dimensions, poids) ;
 *  2. une empreinte SHA-256 est calculée : un doublon n'est jamais importé deux fois ;
 *  3. la photo est stockée (stockage local ou Cloudinary) et entre dans la file de
 *     validation (`media_assets`, statut PENDING) ;
 *  4. un SKU peut être **suggéré** à partir du nom du fichier (ex.
 *     `MED-0001-1.jpg` → `MED-0001`) : c'est une aide, jamais une certitude ;
 *  5. le rattachement définitif se fait dans /admin/import (ou avec --assign).
 *
 * IMPORTANT : aucun prix ni stock n'est déduit d'une photo. Une photo sans fiche
 * produit reste dans la file jusqu'à la saisie manuelle des données.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { eq, sql } from 'drizzle-orm';
import { db, pool } from '../src/db';
import { mediaAssets, products } from '../src/db/schema';
import { storeImage } from '../src/lib/storage';
import { newId, slugify } from '../src/lib/utils';
import { assignMediaToProduct } from '../src/lib/import';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const MAX_BYTES = 15 * 1024 * 1024;

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}
const flag = (name: string) => process.argv.includes(`--${name}`);

/** Suggère une référence produit à partir du nom de fichier (jamais du contenu). */
function suggestSku(filename: string): string | null {
  const base = path.basename(filename, path.extname(filename)).toUpperCase();
  const match = base.match(/[A-Z]{2,5}[-_]?\d{3,6}/);
  if (!match) return null;
  return match[0].replace('_', '-');
}

async function main() {
  const dir = arg('dir');
  if (!dir) {
    console.error('Usage : npm run import:photos -- --dir=./photos [--dry-run] [--assign]');
    process.exitCode = 1;
    return;
  }

  const root = path.resolve(process.cwd(), dir);
  const entries = (await readdir(root, { withFileTypes: true })).filter(
    (entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
  );

  const dryRun = flag('dry-run');
  const assign = flag('assign');

  console.log(`→ ${entries.length} fichier(s) image trouvé(s) dans ${path.relative(process.cwd(), root)}`);
  console.log(`   mode : ${dryRun ? 'simulation (aucune écriture)' : 'import réel'}\n`);

  let imported = 0;
  let duplicates = 0;
  let rejected = 0;
  let assigned = 0;

  for (const entry of entries) {
    const filePath = path.join(root, entry.name);
    const label = entry.name;

    try {
      const info = await stat(filePath);
      if (info.size > MAX_BYTES) {
        console.log(`  ✗ ${label} — fichier trop lourd (${Math.round(info.size / 1024 / 1024)} Mo)`);
        rejected += 1;
        continue;
      }

      const buffer = await readFile(filePath);
      const metadata = await sharp(buffer).metadata().catch(() => null);
      if (!metadata?.format) {
        console.log(`  ✗ ${label} — contenu image illisible`);
        rejected += 1;
        continue;
      }

      const checksum = createHash('sha256').update(buffer).digest('hex');
      const existing = await db.select({ id: mediaAssets.id }).from(mediaAssets).where(eq(mediaAssets.checksum, checksum)).limit(1);
      if (existing[0]) {
        console.log(`  = ${label} — déjà importée (empreinte identique)`);
        duplicates += 1;
        continue;
      }

      const suggestedSku = suggestSku(entry.name);

      if (dryRun) {
        console.log(
          `  · ${label} — ${metadata.width}×${metadata.height} ${metadata.format}${suggestedSku ? ` · SKU suggéré : ${suggestedSku}` : ' · aucun SKU détecté'}`,
        );
        imported += 1;
        continue;
      }

      const stored = await storeImage({
        file: new File([new Uint8Array(buffer)], entry.name, { type: `image/${metadata.format === 'jpeg' ? 'jpeg' : metadata.format}` }),
        name: slugify(path.basename(entry.name, path.extname(entry.name))),
        folder: 'medi/import',
      });

      const mediaId = newId('med_');
      await db.insert(mediaAssets).values({
        id: mediaId,
        filename: entry.name,
        url: stored.url,
        checksum: stored.checksum,
        width: stored.width,
        height: stored.height,
        bytes: stored.bytes,
        status: 'PENDING',
        suggestedSku,
        note: suggestedSku ? 'SKU suggéré depuis le nom de fichier — à confirmer' : 'Aucun SKU détecté dans le nom',
      });

      let attached = false;
      if (assign && suggestedSku) {
        const product = await db.select({ id: products.id }).from(products).where(eq(products.sku, suggestedSku)).limit(1);
        if (product[0]) {
          await assignMediaToProduct({ mediaId, productId: product[0].id });
          attached = true;
          assigned += 1;
        }
      }

      console.log(`  ✓ ${label} → ${stored.url}${attached ? ' (rattachée)' : ''}`);
      imported += 1;
    } catch (error) {
      rejected += 1;
      console.log(`  ✗ ${label} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const waiting = await db.execute(sql`SELECT count(*)::int AS n FROM media_assets WHERE status = 'PENDING'`);
  const pending = (waiting.rows as { n: number }[])[0]?.n ?? 0;

  console.log(`\nBilan : ${imported} importée(s), ${duplicates} doublon(s) ignoré(s), ${rejected} rejetée(s).`);
  if (!dryRun) {
    console.log(`File de validation : ${pending} photo(s) en attente → /admin/import`);
    if (assigned > 0) console.log(`${assigned} photo(s) rattachée(s) automatiquement via un SKU du nom de fichier.`);
    console.log('Aucun prix ni stock n’a été déduit des images : complétez les fiches dans /admin/produits.');
  }
}

main()
  .catch((error) => {
    console.error('❌ Import impossible :', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
