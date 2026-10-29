/**
 * Génération des fichiers de marque MeDi à partir du logo officiel.
 *
 *   npx tsx scripts/make-brand-assets.ts
 *
 * Entrée  : public/brand/medi-logo-source.png (logo fourni par le propriétaire)
 * Sorties : public/brand/medi-logo.png                (version empilée, fond clair)
 *           public/brand/medi-logo-blanc.png          (version empilée, fond sombre)
 *           public/brand/medi-logo-horizontal.png     (en-tête sur fond clair)
 *           public/brand/medi-logo-horizontal-blanc.png (en-tête et pied de page bleu nuit)
 *           public/brand/medi-icon.png                (icône carrée 512, favicon, réseaux sociaux)
 *           public/brand/apple-touch-icon.png         (icône iOS 180 px)
 *           public/brand/favicon-32.png               (favicon PNG 32 px)
 *           public/brand/medi-og.png                  (image de partage 1200×630)
 *
 * Le script part du principe que le logo est fourni sur fond blanc : il rend le
 * fond transparent, puis décline une version « fond sombre » où le bleu nuit
 * devient blanc (l'orange est conservé). Aucun autre traitement n'est appliqué
 * au dessin d'origine.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const BRAND_DIR = path.join(process.cwd(), 'public', 'brand');
const SOURCE = path.join(BRAND_DIR, 'medi-logo-source.png');

/** Rend transparent tout ce qui est proche du blanc, sans toucher aux aplats. */
function alphaFromWhite(data: Buffer): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Distance moyenne à la couleur blanche.
    const distance = Math.sqrt(((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2) / 3);
    // Rampe douce : 8 → 48 sur l'échelle de distance.
    const alpha = Math.max(0, Math.min(1, (distance - 8) / 40));
    data[i + 3] = Math.round(alpha * 255);
  }
}

function isOrangeHue(r: number, g: number, b: number): boolean {
  return r > 180 && r > g + 40 && g >= b;
}

/** Version fond sombre : le bleu nuit devient blanc, l'orange est conservé. */
function recolorForDarkBackground(data: Buffer): void {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isOrangeHue(r, g, b)) continue;
    // Tons froids / sombres = éléments de dessin (bleu nuit, traits).
    if (b >= r - 20 && r + g + b < 620) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
  }
}

async function rgbaOf(input: Buffer) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}

/**
 * Trouve la ligne où couper le logo pour isoler l'emblème des mots « MeDi » :
 * plus grande bande horizontale sans encre entre 45 % et 92 % de la hauteur.
 */
async function findEmblemCut(data: Buffer, width: number, height: number): Promise<number> {
  const ink = new Array<number>(height).fill(0);
  for (let y = 0; y < height; y += 1) {
    let count = 0;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a > 24) count += 1;
    }
    ink[y] = count;
  }
  const from = Math.round(height * 0.45);
  const to = Math.round(height * 0.92);
  let bestStart = -1;
  let bestLength = 0;
  let runStart = -1;
  for (let y = from; y < to; y += 1) {
    if (ink[y] === 0) {
      if (runStart === -1) runStart = y;
      const length = y - runStart + 1;
      if (length > bestLength) {
        bestLength = length;
        bestStart = runStart;
      }
    } else {
      runStart = -1;
    }
  }
  if (bestStart === -1 || bestLength < 4) {
    // Aucune bande franche : repli sur une coupe à 70 % de la hauteur.
    return Math.round(height * 0.7);
  }
  return Math.round(bestStart + bestLength / 2);
}

async function main() {
  await mkdir(BRAND_DIR, { recursive: true });
  const source = await readFile(SOURCE);

  // 1. Recadrage des marges blanches + fond transparent.
  const trimmed = await sharp(source).trim({ background: '#ffffff', threshold: 12 }).png().toBuffer();
  const { data: trimmedData, info } = await rgbaOf(trimmed);
  const size = { width: info.width, height: info.height };
  const alphaData = Buffer.from(trimmedData);
  alphaFromWhite(alphaData);

  // 2. Logo fond clair (fond déjà transparent).
  const light = sharp(alphaData, { raw: { ...size, channels: 4 } });
  await light
    .clone()
    .resize({ width: 900, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(path.join(BRAND_DIR, 'medi-logo.png'));

  // 3. Logo fond sombre.
  const darkData = Buffer.from(alphaData);
  recolorForDarkBackground(darkData);
  await sharp(darkData, { raw: { ...size, channels: 4 } })
    .resize({ width: 900, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(path.join(BRAND_DIR, 'medi-logo-blanc.png'));

  // 4. Icône carrée : emblème seul (sans les mots « MeDi »), sur fond bleu nuit.
  //    La coupure est détectée automatiquement sur la plus grande bande
  //    horizontalement vide de la moitié basse du logo.
  const cut = await findEmblemCut(alphaData, info.width, info.height);
  const emblem = await sharp(alphaData, { raw: { ...size, channels: 4 } })
    .extract({ left: 0, top: 0, width: info.width, height: cut })
    .png()
    .toBuffer();
  const emblemTrimmed = await sharp(emblem).trim({ threshold: 12 }).png().toBuffer();
  const emblemData = await rgbaOf(emblemTrimmed);
  const emblemAlpha = Buffer.from(emblemData.data);
  recolorForDarkBackground(emblemAlpha);
  const emblemWhite = await sharp(emblemAlpha, { raw: { ...emblemData.info, channels: 4 } }).png().toBuffer();

  const maxSide = Math.max(emblemData.info.width, emblemData.info.height);
  const canvas = Math.round(maxSide * 1.22);
  const square = await sharp({
    create: { width: canvas, height: canvas, channels: 4, background: { r: 8, g: 23, b: 41, alpha: 1 } },
  })
    .composite([{ input: emblemWhite, gravity: 'center' }])
    .png()
    .toBuffer();

  await sharp(square)
    .resize(512, 512, { fit: 'contain', background: { r: 8, g: 23, b: 41, alpha: 1 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(BRAND_DIR, 'medi-icon.png'));

  await sharp(square)
    .resize(180, 180, { fit: 'contain', background: { r: 8, g: 23, b: 41, alpha: 1 } })
    .png()
    .toFile(path.join(BRAND_DIR, 'apple-touch-icon.png'));

  await sharp(square)
    .resize(32, 32, { fit: 'contain', background: { r: 8, g: 23, b: 41, alpha: 1 } })
    .png()
    .toFile(path.join(BRAND_DIR, 'favicon-32.png'));

  // 5. Versions horizontales : emblème à gauche, « MeDi » à droite.
  //    (Le logo fourni est empilé ; l'en-tête du site a besoin d'un format large.)
  const wordmark = await sharp(alphaData, { raw: { ...size, channels: 4 } })
    .extract({ left: 0, top: cut, width: info.width, height: info.height - cut })
    .png()
    .toBuffer();
  const wordmarkTrimmed = await sharp(wordmark).trim({ threshold: 12 }).toBuffer();
  const wordmarkData = await rgbaOf(wordmarkTrimmed);
  const wordmarkAlpha = Buffer.from(wordmarkData.data);

  const LOCKUP_EMBLEM_H = 200;
  const LOCKUP_WORD_H = 104;
  const LOCKUP_GAP = 34;
  const emblemForLockup = await sharp(emblemAlpha, { raw: { ...emblemData.info, channels: 4 } })
    .resize({ height: LOCKUP_EMBLEM_H, fit: 'inside' })
    .png()
    .toBuffer();
  const emblemLockupMeta = await sharp(emblemForLockup).metadata();
  const wordLight = await sharp(wordmarkAlpha, { raw: { ...wordmarkData.info, channels: 4 } })
    .resize({ height: LOCKUP_WORD_H, fit: 'inside' })
    .png()
    .toBuffer();
  const wordLightMeta = await sharp(wordLight).metadata();

  const lockupWidth = (emblemLockupMeta.width ?? 0) + LOCKUP_GAP + (wordLightMeta.width ?? 0);
  const lockupHeight = LOCKUP_EMBLEM_H;
  const lockupLeft = await sharp({
    create: { width: lockupWidth, height: lockupHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: emblemForLockup, top: 0, left: 0 },
      {
        input: wordLight,
        top: Math.round((lockupHeight - (wordLightMeta.height ?? 0)) / 2),
        left: (emblemLockupMeta.width ?? 0) + LOCKUP_GAP,
      },
    ])
    .png()
    .toBuffer();
  await sharp(lockupLeft).png({ compressionLevel: 9 }).toFile(path.join(BRAND_DIR, 'medi-logo-horizontal.png'));

  const lockupDark = await rgbaOf(lockupLeft);
  const lockupDarkData = Buffer.from(lockupDark.data);
  recolorForDarkBackground(lockupDarkData);
  const lockupRight = await sharp(lockupDarkData, { raw: { ...lockupDark.info, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(BRAND_DIR, 'medi-logo-horizontal-blanc.png'), lockupRight);

  // 6. Image de partage (Open Graph / Twitter) : logo blanc sur bleu nuit.
  const ogLogo = await sharp(lockupRight)
    .resize({ width: 720, fit: 'inside' })
    .png()
    .toBuffer();
  await sharp({
    create: { width: 1200, height: 630, channels: 4, background: { r: 8, g: 23, b: 41, alpha: 1 } },
  })
    .composite([{ input: ogLogo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(BRAND_DIR, 'medi-og.png'));

  await writeFile(
    path.join(BRAND_DIR, 'SOURCE.txt'),
    [
      'Fichiers générés par scripts/make-brand-assets.ts à partir de medi-logo-source.png.',
      'Ne pas éditer à la main : relancer le script après remplacement du logo source.',
      '',
      'medi-logo.png                  → logo empilé, fond clair (documents, e-mails)',
      'medi-logo-blanc.png            → logo empilé, fond sombre',
      'medi-logo-horizontal.png       → en-tête et pied de page sur fond clair',
      'medi-logo-horizontal-blanc.png → en-tête et pied de page bleu nuit',
      'medi-icon.png                  → icône carrée 512 px (favicon, réseaux sociaux, PWA)',
      'apple-touch-icon.png           → icône iOS 180 px',
      'favicon-32.png                 → favicon PNG 32 px',
      'medi-og.png                    → image de partage 1200×630',
      '',
    ].join('\n'),
  );

  console.log('✔ Fichiers de marque générés dans public/brand');
  console.log(`   logo source trimé : ${size.width}×${size.height}`);
  console.log(`   emblème           : ${emblemData.info.width}×${emblemData.info.height} → icône 512×512`);
  console.log(`   format horizontal : ${lockupWidth}×${lockupHeight}`);
}

main().catch((error) => {
  console.error('Échec de la génération des fichiers de marque :', error);
  process.exit(1);
});
