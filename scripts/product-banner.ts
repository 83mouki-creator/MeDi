/**
 * Bandeau bas des vignettes produit.
 *
 * Le bandeau identifie la boutique sur chaque photo du catalogue : emblème
 * MeDi Shop (logotype officiel « MeDi Shop » blanc sur bleu nuit, repris de
 * public/brand/medi-logo-horizontal-blanc.png, version fond sombre du logo
 * propriétaire), référence lisible pour retrouver l'article en boutique, puis
 * la désignation.
 *
 * Il est isolé ici parce qu'il sert à deux moments : la fabrication initiale des
 * vignettes (scripts/build-product-images.ts, à partir des photos fournisseur)
 * et la recomposition des vignettes déjà publiées quand la marque évolue
 * (`npm run images:products -- --relabel`), les photos sources n'étant pas
 * toutes conservées dans le dépôt.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

export const CANVAS = 1000;
export const BANNER_H = 180;
export const NAVY = '#0e2340';
export const NAVY_DEEP = '#16305a';
export const ORANGE = '#f26a1b';

/**
 * Logotype officiel MeDi Shop (blanc, fond sombre) : emblème maison + « MeDi Shop ».
 * Incorporé tel quel — jamais redessiné — pour rester fidèle au logo propriétaire.
 */
const WORDMARK_FILE = path.join('public', 'brand', 'medi-logo-horizontal-blanc.png');
const WORDMARK = readFileSync(WORDMARK_FILE);
const WORDMARK_B64 = WORDMARK.toString('base64');
const WORDMARK_RATIO = 1069 / 200;

export const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function escapeXml(input: string) {
  return input.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

/** Coupe une chaîne à une largeur approximative (DejaVu Sans, facteur 0,52). */
export function fitText(text: string, size: number, maxWidth: number, factor = 0.52) {
  const maxChars = Math.max(4, Math.floor(maxWidth / (size * factor)));
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

/**
 * Emblème MeDi Shop : logotype officiel blanc (emblème maison + « MeDi Shop »),
 * incrusté dans le bandeau. `size` est la hauteur du logotype ; (x, y) son
 * coin supérieur gauche.
 */
export function emblem(size: number, x: number, y: number) {
  const width = Math.round(size * WORDMARK_RATIO);
  return `  <image href="data:image/png;base64,${WORDMARK_B64}" x="${x}" y="${y}" width="${width}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`;
}

export function bannerSvg(params: { sku: string; label: string }) {
  const label = escapeXml(fitText(params.label, 25, 880, 0.5));
  // La référence est réduite jusqu'à tenir entière : une référence tronquée
  // serait inutilisable pour retrouver l'article en boutique.
  const skuMax = 470;
  const skuSize = Math.max(16, Math.min(30, Math.floor(skuMax / (params.sku.length * 0.64))));
  const sku = escapeXml(params.sku);
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${BANNER_H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${NAVY}"/>
      <stop offset="100%" stop-color="${NAVY_DEEP}"/>
    </linearGradient>
  </defs>
  <rect width="${CANVAS}" height="${BANNER_H}" fill="url(#g)"/>
  <rect width="${CANVAS}" height="6" fill="${ORANGE}"/>
  ${emblem(58, 44, 22)}
  <text x="${CANVAS - 52}" y="72" text-anchor="end" font-family="DejaVu Sans, Liberation Sans, Helvetica, Arial, sans-serif"
        font-size="${skuSize}" font-weight="bold" fill="${ORANGE}" letter-spacing="1">${sku}</text>
  <line x1="52" y1="102" x2="${CANVAS - 52}" y2="102" stroke="#2a4472" stroke-width="2"/>
  <text x="52" y="146" font-family="DejaVu Sans, Liberation Sans, Helvetica, Arial, sans-serif"
        font-size="25" fill="#c9d5e6">${label}</text>
</svg>`);
}

/**
 * Hauteur où commence le bandeau d'une vignette existante, mesurée en remontant
 * depuis le bas : le bandeau est bleu nuit, tout ce qui n'est pas bleu nuit
 * au-dessus marque la fin de la zone produit.
 */
export function bannerTop(
  px: (x: number, y: number) => readonly number[],
  width: number,
  height: number,
) {
  const isNavy = (r: number, g: number, b: number) => r < 70 && b > r && b < 140 && luma(r, g, b) < 110;
  for (let y = height - 1; y >= Math.floor(height * 0.4); y--) {
    const [r, g, b] = px(4, y);
    if (!isNavy(r, g, b)) return y + 1;
  }
  return height - BANNER_H;
}
