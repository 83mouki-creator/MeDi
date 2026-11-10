/**
 * Génération des visuels exigés par Google Play.
 *
 *   npm run play:assets
 *
 * Sorties (dans public/brand/) :
 *   play-feature-graphic.png → 1024 × 500, l'image « bannière » de la fiche Play
 *
 * Règles Google respectées ici :
 *   - exactement 1024 × 500 pixels ;
 *   - PNG sans transparence (la fiche refuse les images à fond transparent) ;
 *   - pas de texte : le nom est déjà dessiné dans le logo, et Google recommande
 *     une bannière sobre (le texte est ajouté par la fiche elle-même).
 *
 * L'image est composée à partir de `perokado-logo-horizontal-blanc.png`, produit par
 * `scripts/make-brand-assets.ts` : mêmes couleurs que le logo (bleu nuit
 * #0b2545, jaune #f2b705), même tracé, aucune retouche du dessin d'origine.
 */
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const BRAND_DIR = path.join(process.cwd(), 'public', 'brand');
const LOGO = path.join(BRAND_DIR, 'perokado-logo-horizontal-blanc.png');
const OUTPUT = path.join(BRAND_DIR, 'play-feature-graphic.png');

const WIDTH = 1024;
const HEIGHT = 500;

/** Bleu nuit et jaune du logo. */
const NAVY = '#0e2340';
const NAVY_DARK = '#081729';
const GOLD = '#f2b705';

/**
 * Décor : dégradé diagonal, deux anneaux dorés qui débordent à droite (motif
 * « chantier »), et une règle dorée sous le logo.
 */
function backdrop(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="fond" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${NAVY}"/>
      <stop offset="0.62" stop-color="#0a1f3a"/>
      <stop offset="1" stop-color="${NAVY_DARK}"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.42" cy="0.5" r="0.55">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.09"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#fond)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#halo)"/>
  <g fill="none" stroke="${GOLD}">
    <circle cx="905" cy="250" r="268" stroke-width="14" stroke-opacity="0.22"/>
    <circle cx="905" cy="250" r="186" stroke-width="6" stroke-opacity="0.16"/>
    <circle cx="905" cy="250" r="104" stroke-width="3" stroke-opacity="0.12"/>
  </g>
  <g fill="${GOLD}" fill-opacity="0.08">
    <rect x="0" y="0" width="${WIDTH}" height="3"/>
    <rect x="0" y="${HEIGHT - 3}" width="${WIDTH}" height="3"/>
  </g>
</svg>`;
}

/** Règle dorée placée sous le logo : petit repère visuel, comme une cote de plan. */
function goldRule(centerX: number, top: number): string {
  const width = 128;
  const height = 6;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <rect x="${Math.round(centerX - width / 2)}" y="${top}" width="${width}" height="${height}" rx="3" fill="${GOLD}"/>
</svg>`;
}

async function main() {
  await mkdir(BRAND_DIR, { recursive: true });

  const logo = await readFile(LOGO);
  const logoWidth = 496;
  const resized = await sharp(logo).resize({ width: logoWidth, withoutEnlargement: true }).png().toBuffer();
  const meta = await sharp(resized).metadata();
  const logoHeight = meta.height ?? 0;

  // Bloc logo + règle, centré optiquement (décalé à gauche pour laisser respirer
  // les anneaux à droite).
  const centerX = 470;
  const gap = 26;
  const blockHeight = logoHeight + gap + 6;
  const logoTop = Math.round((HEIGHT - blockHeight) / 2);
  const ruleTop = logoTop + logoHeight + gap;

  await sharp(Buffer.from(backdrop()))
    .composite([
      { input: resized, top: logoTop, left: Math.round(centerX - logoWidth / 2) },
      { input: Buffer.from(goldRule(centerX, ruleTop)), top: 0, left: 0 },
    ])
    .flatten({ background: NAVY })
    // Google Play refuse les images à fond transparent : on supprime le canal alpha.
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(OUTPUT);

  const info = await sharp(OUTPUT).metadata();
  console.log('✔ Bannière Play générée : public/brand/play-feature-graphic.png');
  console.log(`   ${info.width}×${info.height}, canaux ${info.channels}, alpha ${info.hasAlpha ? 'oui' : 'non'}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
