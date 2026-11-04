/**
 * Génération des fichiers de marque MeDi Shop à partir du logo officiel.
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
 *
 * Le logo fourni n'écrit que « MeDi ». Le mot « Shop » est ajouté à droite du
 * mot d'origine à partir de son tracé vectoriel (scripts/brand/shop-wordmark.svg,
 * produit par scripts/make-shop-wordmark.py) : même hauteur de capitale, même
 * ligne de base, même couleur. Le nom écrit sur toutes les images de marque est
 * donc « MeDi Shop ».
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const BRAND_DIR = path.join(process.cwd(), 'public', 'brand');
const SOURCE = path.join(BRAND_DIR, 'medi-logo-source.png');
/** Tracé du mot « Shop » qui complète « MeDi » (voir scripts/make-shop-wordmark.py). */
const SHOP_SVG = path.join(process.cwd(), 'scripts', 'brand', 'shop-wordmark.svg');
/** Repères du tracé : marge de 40 unités, haut de capitale à y = 0, ligne de base à y = 705. */
const SHOP_MARGIN_UNITS = 40;
const SHOP_CAP_UNITS = 705;
const SHOP_BOX_UNITS = 1095;
/** Espace entre « MeDi » et « Shop », exprimé en hauteurs de capitale. */
const SHOP_SPACE_RATIO = 222 / 705;

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
 * Hauteur de capitale et ligne de base d'un mot écrit en capitales pleines.
 *
 * Les lettres montantes (M, D) donnent le haut de capitale ; le point du « i »,
 * plus court en largeur d'encre, est écarté par un seuil sur le nombre de pixels
 * encrés par ligne. La ligne de base est la dernière ligne encrée.
 */
function capMetrics(data: Buffer, width: number, height: number) {
  const ink = new Array<number>(height).fill(0);
  for (let y = 0; y < height; y += 1) {
    let count = 0;
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 24) count += 1;
    }
    ink[y] = count;
  }
  const max = Math.max(...ink);
  const threshold = max * 0.35;
  let capTop = 0;
  while (capTop < height && ink[capTop] < threshold) capTop += 1;
  let baseline = height - 1;
  while (baseline > 0 && ink[baseline] === 0) baseline -= 1;
  return { capTop, baseline, cap: baseline - capTop + 1 };
}

/**
 * Complète le mot du logo (« MeDi ») par le mot « Shop » : collé à droite, à la
 * même ligne de base et à la même hauteur de capitale, dans la couleur du logo.
 */
async function appendShop(wordmark: Buffer) {
  const base = await rgbaOf(wordmark);
  const { capTop, baseline, cap } = capMetrics(base.data, base.info.width, base.info.height);

  const space = Math.round(cap * SHOP_SPACE_RATIO);
  const shopHeight = Math.round((cap * SHOP_BOX_UNITS) / SHOP_CAP_UNITS);
  const shopPng = await sharp(await readFile(SHOP_SVG), { density: 600 })
    .resize({ height: shopHeight })
    .png()
    .toBuffer();
  const shopMeta = await sharp(shopPng).metadata();
  const shopScale = shopHeight / SHOP_BOX_UNITS;

  const shopTop = capTop - Math.round(SHOP_MARGIN_UNITS * shopScale);
  const width = base.info.width + space + (shopMeta.width ?? 0);
  // Le mot ajouté descend sous la ligne de base (jambage du « p »).
  const height = Math.max(base.info.height, shopTop + shopHeight);
  const composed = await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: wordmark, top: 0, left: 0 },
      { input: shopPng, top: shopTop, left: base.info.width + space },
    ])
    .png()
    .toBuffer();
  return { image: composed, width, height, base, capTop, baseline, cap };
}

/**
 * Trouve la ligne où couper le logo pour isoler l'emblème des mots « MeDi Shop » :
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

  // 2. Icône carrée : emblème seul (sans les mots « MeDi Shop »), sur fond bleu nuit.
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
    .resize(192, 192, { fit: 'contain', background: { r: 8, g: 23, b: 41, alpha: 1 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(BRAND_DIR, 'medi-icon-192.png'));

  await sharp(square)
    .resize(32, 32, { fit: 'contain', background: { r: 8, g: 23, b: 41, alpha: 1 } })
    .png()
    .toFile(path.join(BRAND_DIR, 'favicon-32.png'));

  // Icône « maskable » (Android) : le dessin tient dans la zone sûre de 72 % du
  // carré, car le lanceur Android rogne les bords (cercle, goutte, arrondi).
  const maskableSize = 512;
  const maskableEmblem = await sharp(emblemWhite)
    .resize({ width: Math.round(maskableSize * 0.72), height: Math.round(maskableSize * 0.72), fit: 'inside' })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: maskableSize,
      height: maskableSize,
      channels: 4,
      background: { r: 8, g: 23, b: 41, alpha: 1 },
    },
  })
    .composite([{ input: maskableEmblem, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(BRAND_DIR, 'medi-icon-maskable-512.png'));

  // 3. Versions horizontales : emblème à gauche, « MeDi Shop » à droite.
  //    (Le logo fourni est empilé ; l'en-tête du site a besoin d'un format large.)
  const wordmark = await sharp(alphaData, { raw: { ...size, channels: 4 } })
    .extract({ left: 0, top: cut, width: info.width, height: info.height - cut })
    .png()
    .toBuffer();
  const wordmarkTrimmed = await sharp(wordmark).trim({ threshold: 12 }).toBuffer();
  // Le logo fourni n'écrit que « MeDi » : on ajoute « Shop » à sa droite.
  const wordmarkShop = await appendShop(wordmarkTrimmed);
  const WORDMARK_H = wordmarkShop.base.info.height;

  const LOCKUP_EMBLEM_H = 200;
  const LOCKUP_WORD_H = 104;
  const LOCKUP_GAP = 34;
  const emblemForLockup = await sharp(emblemAlpha, { raw: { ...emblemData.info, channels: 4 } })
    .resize({ height: LOCKUP_EMBLEM_H, fit: 'inside' })
    .png()
    .toBuffer();
  const emblemLockupMeta = await sharp(emblemForLockup).metadata();
  // Le mot d'origine garde sa hauteur d'avant ; « Shop » et son jambage suivent.
  const wordScale = LOCKUP_WORD_H / WORDMARK_H;
  const wordLight = await sharp(wordmarkShop.image)
    .resize({ height: Math.round(wordmarkShop.height * wordScale), fit: 'inside' })
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
        // Haut du mot aligné comme avant : c'est le jambage du « p » qui descend.
        top: Math.round((lockupHeight - LOCKUP_WORD_H) / 2),
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

  // 4. Image de partage (Open Graph / Twitter) : logo blanc sur bleu nuit.
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

  // 5. Versions empilées (documents, e-mails) : emblème au-dessus, « MeDi Shop » dessous.
  //    Le mot complet est réduit à la largeur de l'emblème pour rester équilibré.
  const emblemStackMeta = await sharp(emblemTrimmed).metadata();
  const stackEmblemW = emblemStackMeta.width ?? 0;
  const stackEmblemH = emblemStackMeta.height ?? 0;
  const stackWordW = Math.min(stackEmblemW, wordmarkShop.width);
  const stackWordH = Math.round((wordmarkShop.height * stackWordW) / wordmarkShop.width);
  const stackWord = await sharp(wordmarkShop.image)
    .resize({ width: stackWordW, height: stackWordH, fit: 'inside' })
    .png()
    .toBuffer();
  const stackWordMeta = await sharp(stackWord).metadata();

  // Espace vertical entre l'emblème et le mot, repris du logo fourni.
  const rowHasInk = (y: number) => {
    for (let x = 0; x < info.width; x += 1) {
      if (alphaData[(y * info.width + x) * 4 + 3] > 24) return true;
    }
    return false;
  };
  let gapFrom = cut - 1;
  while (gapFrom > 0 && !rowHasInk(gapFrom)) gapFrom -= 1;
  let gapTo = cut;
  while (gapTo < info.height - 1 && !rowHasInk(gapTo)) gapTo += 1;
  const stackGap = Math.max(0, gapTo - gapFrom - 1);

  const stackWidth = Math.max(stackEmblemW, stackWordW);
  const stackHeight = stackEmblemH + stackGap + (stackWordMeta.height ?? stackWordH);
  const stacked = await sharp({
    create: { width: stackWidth, height: stackHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: emblemTrimmed, top: 0, left: Math.round((stackWidth - stackEmblemW) / 2) },
      {
        input: stackWord,
        top: stackEmblemH + stackGap,
        left: Math.round((stackWidth - (stackWordMeta.width ?? stackWordW)) / 2),
      },
    ])
    .png()
    .toBuffer();

  await sharp(stacked)
    .resize({ width: 900, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(path.join(BRAND_DIR, 'medi-logo.png'));

  const stackedData = await rgbaOf(stacked);
  const stackedDark = Buffer.from(stackedData.data);
  recolorForDarkBackground(stackedDark);
  await sharp(stackedDark, { raw: { ...stackedData.info, channels: 4 } })
    .resize({ width: 900, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(path.join(BRAND_DIR, 'medi-logo-blanc.png'));

  await writeFile(
    path.join(BRAND_DIR, 'SOURCE.txt'),
    [
      'Fichiers générés par scripts/make-brand-assets.ts à partir de medi-logo-source.png.',
      'Ne pas éditer à la main : relancer le script après remplacement du logo source.',
      'Le mot « Shop » est ajouté au mot d\'origine depuis scripts/brand/shop-wordmark.svg',
      '(tracé produit par scripts/make-shop-wordmark.py) : toutes ces images écrivent « MeDi Shop ».',
      '',
      'medi-logo.png                  → logo empilé, fond clair (documents, e-mails)',
      'medi-logo-blanc.png            → logo empilé, fond sombre',
      'medi-logo-horizontal.png       → en-tête et pied de page sur fond clair',
      'medi-logo-horizontal-blanc.png → en-tête et pied de page bleu nuit',
      'medi-icon.png                  → icône carrée 512 px (favicon, réseaux sociaux, PWA)',
      'medi-icon-192.png              → icône 192 px exigée par le manifeste de l’application Android',
      'medi-icon-maskable-512.png     → icône « maskable » 512 px (zone sûre 72 %, fond bleu nuit)',
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
