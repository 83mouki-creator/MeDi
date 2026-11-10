/**
 * Préparation de l'emblème 3D Perokado.
 *
 *   npm run brand:emblem      →  public/brand/perokado-emblem-3d.png
 *
 * L'image de travail (`public/brand/source/perokado-3d-emblem.png`) est un rendu
 * carré : plaque bleu nuit bombée, liseré doré, sac doré en relief avec un « P »
 * gravé. Elle est livrée sur fond opaque et sa plaque contient des reflets et un
 * socle sombre qui, une fois posés sur du blanc, ressemblent à des salissures.
 *
 * Ce script sépare donc les deux parties du dessin :
 *
 *  1. **le sac** — détouré sur son fond sombre (diffusion depuis les bords,
 *     luminance + « bleuité »), puis érodé de deux pixels pour retirer le halo
 *     doré de la plaque et adouci ;
 *  2. **la plaque** — reconstruite en vectoriel : carré à coins arrondis, dégradé
 *     bleu nuit `#1B3F6B → #0E2340 → #081729`, ombre portée douce, liseré doré.
 *     Un dessin net remplace les reflets du rendu, inégaux d'un support à l'autre ;
 *  3. **composition** — sac centré sur la plaque, puis sortie 1024 × 1024.
 *
 * Le fichier produit est consommé par `make-brand-assets.ts` : icônes, logo
 * horizontal, logo empilé, filigrane de l'administration, image de partage.
 */
import { access, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const BRAND_DIR = path.join(process.cwd(), 'public', 'brand');
const SOURCE = path.join(BRAND_DIR, 'source', 'perokado-3d-emblem.png');
const OUTPUT = path.join(BRAND_DIR, 'perokado-emblem-3d.png');

/**
 * Détoure la plaque du rendu d'origine, coins arrondis compris.
 *
 * Le rendu est livré carré, sur fond opaque, et sa plaque laisse voir un dégradé
 * sombre dans les coins. On ne redessine rien : on garde la lumière et les
 * reflets du rendu 3D, et on se contente de rendre transparent tout ce qui est
 * **hors de la plaque**.
 *
 * La plaque est repérée par sa luminance (scan du bord le plus lumineux), puis
 * masquée par un rectangle à coins arrondis de même rayon : le résultat se pose
 * aussi bien sur du blanc que sur du bleu nuit, sans liseré ni carré parasite.
 */
async function cutPlate(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const channels = info.channels;

  const luminance = (x: number, y: number) => {
    const i = (y * width + x) * channels;
    return data[i]! + data[i + 1]! + data[i + 2]!;
  };

  /** Premier pixel nettement plus lumineux que le fond, en partant du bord. */
  const BRIGHT = 150;
  const firstBright = (from: number, to: number, step: number, at: (t: number) => [number, number]) => {
    for (let t = from; step > 0 ? t < to : t > to; t += step) {
      const [x, y] = at(t);
      if (luminance(x, y) > BRIGHT) return t;
    }
    return step > 0 ? to : from;
  };

  const midY = Math.floor(height / 2);
  const midX = Math.floor(width / 2);
  const left = firstBright(0, width, 1, (x) => [x, midY]);
  const right = firstBright(width - 1, 0, -1, (x) => [x, midY]);
  const top = firstBright(0, height, 1, (y) => [midX, y]);
  const bottom = firstBright(height - 1, 0, -1, (y) => [midX, y]);

  const plateWidth = right - left + 1;
  const plateHeight = bottom - top + 1;
  // Rayon mesuré sur le rendu : environ 19,5 % du côté (squircle iOS).
  const radius = Math.round(Math.min(plateWidth, plateHeight) * 0.195);

  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${plateWidth}" height="${plateHeight}" viewBox="0 0 ${plateWidth} ${plateHeight}">` +
      `<rect x="0" y="0" width="${plateWidth}" height="${plateHeight}" rx="${radius}" ry="${radius}" fill="#ffffff"/></svg>`,
  );
  const maskPng = await sharp(mask, { density: 288 }).resize(plateWidth, plateHeight).png().toBuffer();

  const cropped = await sharp(await sharp(input).png().toBuffer())
    .resize(plateWidth, plateHeight, { fit: 'fill' })
    .png()
    .toBuffer();

  // `dest-in` : ne garde que la partie de la plaque couverte par le masque.
  return sharp(cropped)
    .ensureAlpha()
    .composite([{ input: maskPng, blend: 'dest-in' }])
    .trim({ threshold: 1 })
    .png()
    .toBuffer();
}

/** Plaque bleu nuit vectorielle : dégradé, liseré doré, ombre portée. */
function plate(width: number, radius: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="0 0 ${width} ${width}">
  <defs>
    <linearGradient id="fond" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1b3f6b"/>
      <stop offset="0.55" stop-color="#0e2340"/>
      <stop offset="1" stop-color="#081729"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.26" cy="0.12" r="0.9">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="liseré" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe89a"/>
      <stop offset="0.45" stop-color="#f2b705"/>
      <stop offset="1" stop-color="#a8761a"/>
    </linearGradient>
    <filter id="ombre" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${Math.round(width * 0.012)}" stdDeviation="${Math.round(width * 0.02)}" flood-color="#050d19" flood-opacity="0.35"/>
    </filter>
  </defs>
  <g filter="url(#ombre)">
    <rect x="${Math.round(width * 0.03)}" y="${Math.round(width * 0.03)}" width="${width - Math.round(width * 0.06)}" height="${width - Math.round(width * 0.06)}" rx="${radius}" fill="url(#fond)"/>
    <rect x="${Math.round(width * 0.03)}" y="${Math.round(width * 0.03)}" width="${width - Math.round(width * 0.06)}" height="${width - Math.round(width * 0.06)}" rx="${radius}" fill="url(#halo)"/>
    <rect x="${Math.round(width * 0.045)}" y="${Math.round(width * 0.045)}" width="${width - Math.round(width * 0.09)}" height="${width - Math.round(width * 0.09)}" rx="${radius - Math.round(width * 0.015)}" fill="none" stroke="url(#liseré)" stroke-width="${Math.max(2, Math.round(width * 0.007))}" stroke-opacity="0.9"/>
  </g>
</svg>`;
}

async function main() {
  await mkdir(path.dirname(OUTPUT), { recursive: true });

  try {
    await access(SOURCE);
  } catch {
    throw new Error(
      `Image source absente : ${path.relative(process.cwd(), SOURCE)}. ` +
        'Placez le rendu 3D carré (1536 × 1536 conseillé) à cet emplacement.',
    );
  }

  const platePng = await cutPlate(await readFile(SOURCE));

  // Une petite marge transparente évite que la plaque ne « touche » le bord de
  // son conteneur (en-tête, icône, filigrane).
  const SIZE = 1024;
  const inset = Math.round(SIZE * 0.02);
  const plateOnCanvas = await sharp(platePng)
    .resize(SIZE - inset * 2, SIZE - inset * 2, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: plateOnCanvas, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(OUTPUT);

  const final = await sharp(OUTPUT).metadata();
  console.log(`✔ perokado-emblem-3d.png  emblème 3D détouré  ${final.width}×${final.height}`);
}

main().catch((error) => {
  console.error('❌ Préparation de l’emblème impossible :', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
