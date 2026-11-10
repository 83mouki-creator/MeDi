/**
 * Fabrication des photos catalogue Perokado à partir des clichés du fournisseur.
 *
 * Chaque photo source (SODIS-MAD CI / EMTROP / Midea) comporte :
 *   – une bande d'en-tête (logo du distributeur) en haut ;
 *   – un bloc de texte imprimé (référence, désignation, marque) en bas.
 * On retire les deux, puis on compose une vignette carrée 1000 × 1000 avec un
 * bandeau bas aux couleurs Perokado portant le nom de la boutique et la référence.
 *
 *   npx tsx scripts/build-product-images.ts            # toutes les fiches
 *   npx tsx scripts/build-product-images.ts --only=EGWP10022
 *   npx tsx scripts/build-product-images.ts --sheet    # planche de contrôle
 *   npx tsx scripts/build-product-images.ts --relabel  # redessiner les bandeaux
 *                                                      # des vignettes existantes
 *
 * Le dessin du bandeau vit dans scripts/product-banner.ts.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { loadCatalogue, type ManifestProduct } from './catalogue-data';

import { BANNER_H, CANVAS, bannerSvg, bannerTop, luma } from './product-banner';

const SOURCE_DIR = path.join('data', 'photos-source');
const OUT_DIR = path.join('public', 'catalogue');
const IMAGES_INDEX = path.join('data', 'catalogue', 'images.json');
const AREA_H = CANVAS - BANNER_H;

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

/** Hauteur de la bande d'en-tête : on suit la colonne de gauche du panneau bleu. */
function findHeaderEnd(px: (x: number, y: number) => readonly number[], W: number, H: number) {
  let last = 0;
  let misses = 0;
  for (let y = 0; y < Math.floor(H * 0.3); y++) {
    let blue = 0;
    for (let x = 0; x < 10; x++) {
      const [r, g, b] = px(x, y);
      if (b > 110 && r < 100 && b > r + 40) blue++;
    }
    if (blue >= 6) {
      last = y;
      misses = 0;
    } else if (++misses > 4) {
      break;
    }
  }
  return last > 0 ? Math.min(H * 0.3, last + 4) : 0;
}

/**
 * Début du bloc de texte imprimé en bas de la photo.
 *
 * Le texte du fournisseur est du noir franc et épais : on ne retient que les
 * lignes réellement chargées en pixels sombres (≥ 12 % de la largeur), ce qui
 * évite de « remonter » dans l'article photographié (poignées, colonnes de
 * douche…) lorsque celui-ci descend bas dans l'image. La tolérance de 40 lignes
 * relie le titre et son sous-titre, séparés par un blanc plus large sur
 * certaines photos.
 */
const TEXT_ROW_DARK = 0.12;
const TEXT_ROW_GAP = 40;

function findTextTop(darkFrac: number[], H: number) {
  const floor = Math.floor(H * 0.5);
  let bottom = -1;
  for (let y = H - 1; y >= floor; y--) {
    if ((darkFrac[y] ?? 0) > TEXT_ROW_DARK) {
      bottom = y;
      break;
    }
  }
  if (bottom < 0) return H;

  let gap = 0;
  let y = bottom;
  for (; y >= floor; y--) {
    if ((darkFrac[y] ?? 0) > TEXT_ROW_DARK) gap = 0;
    else if (++gap > TEXT_ROW_GAP) break;
  }
  return Math.min(H, y + gap + 1);
}


async function build(product: ManifestProduct) {
  const file = path.join(SOURCE_DIR, product.sourceFile);
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const ch = info.channels;
  const px = (x: number, y: number) => {
    const i = (y * W + x) * ch;
    return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0] as const;
  };

  const darkFrac: number[] = [];
  for (let y = 0; y < H; y++) {
    let dark = 0;
    for (let x = 0; x < W; x += 2) {
      const [r, g, b] = px(x, y);
      if (luma(r, g, b) < 120) dark++;
    }
    darkFrac[y] = dark / (W / 2);
  }

  const headerEnd = Math.round(findHeaderEnd(px, W, H));
  const textTop = Math.round(findTextTop(darkFrac, H));
  const regionTop = headerEnd;
  const regionBottom = Math.max(regionTop + 200, Math.min(H, textTop - 10));
  const regionH = regionBottom - regionTop;

  // Boîte englobante du produit (pixels éloignés des deux coins hauts = fond).
  const leftBg = px(3, regionTop + 4);
  const rightBg = px(W - 4, regionTop + 4);
  const hasContent = (r: number, g: number, b: number) => {
    const d1 = Math.abs(r - leftBg[0]) + Math.abs(g - leftBg[1]) + Math.abs(b - leftBg[2]);
    const d2 = Math.abs(r - rightBg[0]) + Math.abs(g - rightBg[1]) + Math.abs(b - rightBg[2]);
    return d1 > 150 && d2 > 150;
  };
  let minX = W;
  let maxX = 0;
  for (let y = regionTop + 4; y < regionBottom; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const [r, g, b] = px(x, y);
      if (hasContent(r, g, b)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  if (minX > maxX) {
    minX = 0;
    maxX = W - 1;
  }
  const contentCenter = Math.round((minX + maxX) / 2);

  // Fenêtre horizontale : on vise le format du bandeau produit (1000 × 820),
  // élargie si nécessaire pour ne pas rogner l'article.
  let windowW = Math.round((regionH * CANVAS) / AREA_H);
  // Marge généreuse : certains articles pâles sur fond blanc (filasse, tôle
  // perlée…) ont des extrémités détectées tardivement ; une marge de 80 px les
  // rognait. On élargit donc la fenêtre au-delà de la boîte détectée.
  windowW = Math.max(windowW, Math.min(W, maxX - minX + 200));
  windowW = Math.min(W, windowW);
  let left = Math.round(contentCenter - windowW / 2);
  left = Math.max(0, Math.min(W - windowW, left));

  const productBuffer = await sharp(file)
    .extract({ left, top: regionTop, width: windowW, height: regionH })
    .resize(CANVAS, AREA_H, { fit: 'cover', position: 'center' })
    .toBuffer();

  const productArea = await sharp(productBuffer).toBuffer();
  const banner = await sharp(bannerSvg({ sku: product.sku, label: product.name })).png().toBuffer();

  const composed = await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 3, background: '#ffffff' },
  })
    .composite([
      { input: productArea, top: 0, left: 0 },
      { input: banner, top: AREA_H, left: 0 },
    ])
    .webp({ quality: 86, effort: 5 })
    .toBuffer();

  // Nom de fichier sûr pour l'URL (la référence peut contenir un point).
  const fileBase = product.sku
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const outFile = path.join(OUT_DIR, `${fileBase}.webp`);
  await writeFile(outFile, composed);

  return {
    sku: product.sku,
    file: `/catalogue/${path.basename(outFile)}`,
    bytes: composed.length,
    checksum: createHash('sha256').update(composed).digest('hex'),
    width: CANVAS,
    height: CANVAS,
    debug: { headerEnd, textTop, regionH, windowW, left, content: [minX, maxX] },
  };
}

/**
 * Une vignette réécrite au même chemin garderait la même URL, donc la même clé
 * dans le cache d'images de Next (indexé sur l'URL) : les visiteurs continueraient
 * de voir l'ancienne version. On suffixe l'URL d'une empreinte du contenu.
 */
function versionedUrl(url: string, checksum: string) {
  return `${url.split('?')[0]}?v=${checksum.slice(0, 8)}`;
}

/** Empreinte grossière d'une image, pour comparer deux bandeaux sans les lire en entier. */
async function fingerprint(image: Buffer) {
  return sharp(image).resize(160, 30, { fit: 'fill' }).greyscale().raw().toBuffer();
}

function meanDifference(a: Buffer, b: Buffer) {
  const size = Math.min(a.length, b.length);
  if (size === 0) return 255;
  let total = 0;
  for (let i = 0; i < size; i++) total += Math.abs(a[i]! - b[i]!);
  return total / size;
}

/**
 * Recompose les vignettes déjà publiées : la zone produit est conservée telle
 * quelle, seul le bandeau est redessiné avec la marque et le libellé actuels.
 * Utile quand le catalogue photo a été fabriqué avant un changement de marque et
 * que les photos sources ne sont plus toutes disponibles.
 */
async function relabel() {
  const catalogue = await loadCatalogue();
  const index = JSON.parse(await readFile(IMAGES_INDEX, 'utf8')) as Record<
    string,
    { url: string; checksum: string; width: number; height: number }
  >;
  let done = 0;
  let already = 0;
  const skipped: string[] = [];
  for (const product of catalogue.produits) {
    const entry = index[product.sku];
    if (!entry) {
      skipped.push(product.sku);
      continue;
    }
    // L'URL peut porter un suffixe de version : le fichier est sur le disque sans.
    const file = path.join('public', entry.url.replace(/^\//, '').split('?')[0]);
    const tile = await readFile(file);
    const { data, info } = await sharp(tile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => {
      const i = (y * info.width + x) * info.channels;
      return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0] as const;
    };
    const top = bannerTop(px, info.width, info.height);
    const banner = await sharp(bannerSvg({ sku: product.sku, label: product.name })).png().toBuffer();

    // Vignette déjà au bon bandeau : on n'y touche pas. Sans ce contrôle, chaque
    // passage réencoderait le WebP (perte de qualité à chaque génération) et
    // changerait l'empreinte, donc l'URL, sans raison.
    // Le liseré orange compte quelques pixels au-dessus du bleu : on tolère
    // une petite marge avant de conclure que le bandeau est déjà le bon.
    if (Math.abs(top - (info.height - BANNER_H)) <= 12) {
      const bannerStart = Math.min(top, info.height - BANNER_H);
      const current = await sharp(tile)
        .extract({ left: 0, top: bannerStart, width: info.width, height: info.height - bannerStart })
        .toBuffer();
      const [a, b] = await Promise.all([fingerprint(current), fingerprint(banner)]);
      if (meanDifference(a, b) < 3) {
        already += 1;
        continue;
      }
    }

    const area = await sharp(tile).extract({ left: 0, top: 0, width: info.width, height: top }).toBuffer();
    const composed = await sharp({ create: { width: CANVAS, height: CANVAS, channels: 3, background: '#ffffff' } })
      .composite([
        { input: area, top: 0, left: 0 },
        { input: banner, top: CANVAS - BANNER_H, left: 0 },
      ])
      .webp({ quality: 86, effort: 5 })
      .toBuffer();
    await writeFile(file, composed);
    entry.checksum = createHash('sha256').update(composed).digest('hex');
    entry.width = CANVAS;
    entry.height = CANVAS;
    entry.url = versionedUrl(entry.url, entry.checksum);
    done += 1;
  }
  await writeFile(IMAGES_INDEX, `${JSON.stringify(index, null, 2)}\n`);
  console.log(
    `${done} vignette(s) recomposée(s) dans ${OUT_DIR}` + (already ? `, ${already} déjà à jour` : ''),
  );
  if (skipped.length) console.log(`Sans visuel (ignorées) : ${skipped.join(', ')}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  if (process.argv.includes('--relabel')) return relabel();
  const catalogue = await loadCatalogue();
  const only = option('only');
  const products = only ? catalogue.produits.filter((p) => p.sku === only) : catalogue.produits;

  const results: Awaited<ReturnType<typeof build>>[] = [];
  for (const product of products) {
    const result = await build(product);
    results.push(result);
    console.log(
      `${result.sku.padEnd(22)} ${(result.bytes / 1024).toFixed(0).padStart(4)} Ko  ` +
        `entete=${result.debug.headerEnd} texte=${result.debug.textTop} region=${result.debug.regionH} ` +
        `fenetre=${result.debug.windowW}@${result.debug.left} contenu=${result.debug.content.join('-')}`,
    );
  }

  if (process.argv.includes('--sheet')) {
    const cols = 5;
    const cell = 300;
    const rows = Math.ceil(results.length / cols);
    const tiles = await Promise.all(
      results.map(async (result, index) => ({
        input: await sharp(path.join('public', result.file.replace(/^\//, ''))).resize(cell, cell).toBuffer(),
        left: (index % cols) * cell,
        top: Math.floor(index / cols) * cell,
      })),
    );
    const sheet = await sharp({ create: { width: cols * cell, height: rows * cell, channels: 3, background: '#ffffff' } })
      .composite(tiles)
      .png()
      .toBuffer();
    await writeFile(path.join('public', 'catalogue', '_planche-controle.png'), sheet);
    console.log('Planche de contrôle : public/catalogue/_planche-controle.png');
  }

  // Le récapitulatif des vignettes est fusionné entre les lots : `--only` ne doit
  // pas effacer les entrées des photos déjà générées.
  let previous: Record<string, unknown> = {};
  try {
    previous = JSON.parse(await readFile(IMAGES_INDEX, 'utf8')) as Record<string, unknown>;
  } catch {
    previous = {};
  }
  const index = {
    ...previous,
    ...Object.fromEntries(results.map((r) => [r.sku, { url: r.file, checksum: r.checksum, width: r.width, height: r.height }])),
  };
  await writeFile(IMAGES_INDEX, `${JSON.stringify(index, null, 2)}\n`);
  console.log(`\n${results.length} photo(s) générée(s) dans ${OUT_DIR}`);
}

main().catch((error) => {
  console.error('❌ Génération interrompue :', error);
  process.exitCode = 1;
});
