/**
 * Import du catalogue depuis un fichier CSV.
 *
 *   npm run import:catalog -- --file=./data/catalogue.csv --dry-run
 *   npm run import:catalog -- --file=./data/catalogue.csv
 *
 * Colonnes attendues (en-tête obligatoire, ordre libre, séparateur ; ou ,) :
 *   sku ; nom ; prix ; stock ; categorie ; marque ; description_courte ;
 *   description ; prix_promo ; mots_cles ; seuil_stock_faible ; precommande
 *
 * Règles appliquées :
 *  - prix (entier FCFA) et stock obligatoires — rien n'est inventé ;
 *  - un SKU existant est mis à jour, jamais dupliqué ;
 *  - les lignes invalides sont signalées une par une et n'empêchent pas l'import
 *    des autres lignes.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { importCatalogCsv } from '../src/lib/import';
import { pool } from '../src/db';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const file = arg('file');
  if (!file) {
    console.error('Usage : npm run import:catalog -- --file=./data/catalogue.csv [--dry-run]');
    process.exitCode = 1;
    return;
  }

  const absolute = path.resolve(process.cwd(), file);
  const csv = await readFile(absolute, 'utf8');
  const dryRun = flag('dry-run');

  console.log(`→ ${dryRun ? 'Simulation' : 'Import'} de ${path.basename(absolute)}`);

  const report = await importCatalogCsv(csv, { dryRun });

  console.log(`\nLignes traitées : ${report.total}`);
  console.log(`  créées   : ${report.created}`);
  console.log(`  mises à jour : ${report.updated}`);
  console.log(`  rejetées : ${report.rejected}`);

  const rejected = report.rows.filter((row) => row.status === 'rejected');
  if (rejected.length > 0) {
    console.log('\nLignes rejetées (aucune donnée créée pour celles-ci) :');
    for (const row of rejected) {
      console.log(`  ligne ${row.line} — ${row.sku || '(sans référence)'} : ${row.reason}`);
    }
  }

  if (dryRun) {
    console.log('\nℹ️  Simulation : la base n’a pas été modifiée. Relancez sans --dry-run pour appliquer.');
  } else {
    console.log('\n✅ Import terminé. Vérifiez le catalogue dans /admin/produits.');
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
