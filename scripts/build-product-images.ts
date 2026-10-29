/**
 * Fabrication des photos catalogue MeDi à partir des clichés du fournisseur.
 *
 * Chaque photo source (SODIS-MAD CI / EMTROP / Midea) comporte :
 *   – une bande d'en-tête (logo du distributeur) en haut ;
 *   – un bloc de texte imprimé (référence, désignation, marque) en bas.
 * On retire les deux, puis on compose une vignette carrée 1000 × 1000 avec un
 * bandeau bas aux couleurs MeDi portant le nom de la boutique et la référence.
 *
 *   npx tsx scripts/build-product-images.ts            # toutes les fiches
 *   npx tsx scripts/build-product-images.ts --only=EGWP10022
 *   npx tsx scripts/build-product-images.ts --sheet    # planche de contrôle
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

type ManifestProduct = {
  sku: string;
  sourceFile: string;
  name: string;
  brand: string;
};

type Manifest = { produits: ManifestProduct[] };

const SOURCE_DIR = path.join('data', 'photos-source');
const OUT_DIR = path.join('public', 'catalogue');
const CANVAS = 1000;
const BANNER_H = 180;
const AREA_H = CANVAS - BANNER_H;
const NAVY = '#0a1f44';
const ORANGE = '#f26a1b';

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

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

/** Début du bloc de texte imprimé en bas de la photo (lignes sombres collées au bas). */
function findTextTop(darkFrac: number[], H: number) {
  let bottom = -1;
  for (let y = H - 1; y >= Math.floor(H * 0.5); y--) {
    if ((darkFrac[y] ?? 0) > 0.004) {
      bottom = y;
      break;
    }
  }
  if (bottom < 0) return H;

  let gap = 0;
  let y = bottom;
  for (; y >= Math.floor(H * 0.45); y--) {
    if ((darkFrac[y] ?? 0) > 0.004) gap = 0;
    else if (++gap > 22) break;
  }
  return Math.min(H, y + gap + 1);
}

function escapeXml(input: string) {
  return input.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

/** Coupe une chaîne à une largeur approximative (DejaVu Sans, facteur 0,52). */
function fitText(text: string, size: number, maxWidth: number, factor = 0.52) {
  const maxChars = Math.max(4, Math.floor(maxWidth / (size * factor)));
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

function bannerSvg(params: { sku: string; label: string }) {
  const label = escapeXml(fitText(params.label, 25, 880, 0.5));
  const sku = escapeXml(fitText(params.sku, 30, 360, 0.62));
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${BANNER_H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0a1f44"/>
      <stop offset="100%" stop-color="#143562"/>
    </linearGradient>
  </defs>
  <rect width="${CANVAS}" height="${BANNER_H}" fill="url(#g)"/>
  <rect width="${CANVAS}" height="6" fill="${ORANGE}"/>
  <text x="52" y="80" font-family="DejaVu Sans, Liberation Sans, Helvetica, Arial, sans-serif"
        font-size="56" font-weight="bold" fill="#ffffff" letter-spacing="1">MeDi</text>
  <circle cx="206" cy="60" r="7" fill="${ORANGE}"/>
  <text x="${CANVAS - 52}" y="78" text-anchor="end" font-family="DejaVu Sans, Liberation Sans, Helvetica, Arial, sans-serif"
        font-size="30" font-weight="bold" fill="${ORANGE}" letter-spacing="1">${sku}</text>
  <line x1="52" y1="102" x2="${CANVAS - 52}" y2="102" stroke="#2a4472" stroke-width="2"/>
  <text x="52" y="146" font-family="DejaVu Sans, Liberation Sans, Helvetica, Arial, sans-serif"
        font-size="25" fill="#c9d5e6">${label}</text>
</svg>`);
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
  const regionBottom = Math.max(regionTop + 200, Math.min(H, textTop - 6));
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
  windowW = Math.max(windowW, Math.min(W, maxX - minX + 80));
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

  const outFile = path.join(OUT_DIR, `${product.sku.toLowerCase()}.webp`);
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

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const manifest = JSON.parse(await readFile(path.join('data', 'catalogue', 'medi-2026-10.json'), 'utf8')) as Manifest;
  const only = option('only');
  const products = only ? manifest.produits.filter((p) => p.sku === only) : manifest.produits;

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

  await writeFile(
    path.join('data', 'catalogue', 'images.json'),
    `${JSON.stringify(
      Object.fromEntries(results.map((r) => [r.sku, { url: r.file, checksum: r.checksum, width: r.width, height: r.height }])),
      null,
      2,
    )}\n`,
  );
  console.log(`\n${results.length} photo(s) générée(s) dans ${OUT_DIR}`);
}

main().catch((error) => {
  console.error('❌ Génération interrompue :', error);
  process.exitCode = 1;
});
