/**
 * Image de fond de la page d'accueil.
 *
 *   npm run brand:hero      →  public/brand/fond-accueil.jpg
 *
 * La photo de travail (`public/brand/source/accueil-hero.jpg`) montre l'intérieur
 * d'une quincaillerie à Daloa : rayonnages garnis, deux personnes qui essaient
 * une perceuse. Elle est livrée telle quelle par la génération d'image ; ce script
 * en fait un fichier web :
 *
 *  • ré-encodage JPEG progressif (le fichier d'origine pèse 335 Ko pour 1672 px) ;
 *  • léger renforcement de la netteté, utile une fois la photo assombrie par le
 *    dégradé bleu nuit posé par-dessus dans la page ;
 *  • compression `mozjpeg` : le poids baisse sans toucher au cadrage.
 *
 * Aucun recadrage : le format 16:9 du fichier source est déjà celui du bandeau.
 * `next/image` produit ensuite les tailles réellement servies aux visiteurs.
 */
import { access, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const BRAND_DIR = path.join(process.cwd(), 'public', 'brand');
const SOURCE = path.join(BRAND_DIR, 'source', 'accueil-hero.jpg');
const OUTPUT = path.join(BRAND_DIR, 'fond-accueil.jpg');

async function main() {
  await mkdir(BRAND_DIR, { recursive: true });

  try {
    await access(SOURCE);
  } catch {
    throw new Error(
      `Photo source absente : ${path.relative(process.cwd(), SOURCE)}. ` +
        'Placez-y la photo du bandeau d’accueil (format paysage, 1600 px de large minimum).',
    );
  }

  const source = await readFile(SOURCE);
  const { width = 0, height = 0 } = await sharp(source).metadata();

  await sharp(source)
    // Un peu de netteté : le dégradé bleu nuit posé par-dessus adoucit les détails.
    .sharpen({ sigma: 0.6 })
    // 2000 px de large au maximum : au-delà, `next/image` ne sert jamais cette
    // définition et le fichier ne ferait que grossir le dépôt.
    .resize({ width: Math.min(width || 2000, 2000), withoutEnlargement: true })
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toFile(OUTPUT);

  const produced = await sharp(OUTPUT).metadata();
  const { size } = await stat(OUTPUT);
  console.log(
    `✔ fond-accueil.jpg  bandeau d’accueil  ${produced.width}×${produced.height}  ${Math.round(size / 1024)} Ko`,
  );
}

main().catch((error) => {
  console.error('❌ Préparation de la photo d’accueil impossible :', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
