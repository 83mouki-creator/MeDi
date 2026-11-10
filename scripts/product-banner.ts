/**
 * Bandeau bas des vignettes produit.
 *
 * Le bandeau identifie la boutique sur chaque photo du catalogue : emblème
 * Perokado (sac doré, « P » bleu nuit en réserve), nom de la boutique, référence
 * lisible pour retrouver l'article en boutique, puis la désignation.
 *
 * Il est isolé ici parce qu'il sert à deux moments : la fabrication initiale des
 * vignettes (scripts/build-product-images.ts, à partir des photos fournisseur)
 * et la recomposition des vignettes déjà publiées quand la marque évolue
 * (`npm run images:catalogue -- --relabel`), les photos sources n'étant pas
 * toutes conservées dans le dépôt.
 */

export const CANVAS = 1000;
export const BANNER_H = 180;
export const NAVY = '#0a1f44';
export const ORANGE = '#f26a1b';
export const GOLD = '#f2b705';

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
 * Emblème : anse dorée, sac doré, « P » réservé en bleu nuit.
 * `size` est le côté du carré occupé ; (x, y) son coin supérieur gauche.
 */
export function emblem(size: number, x: number, y: number) {
  const bagW = size * 0.72;
  const bagH = size * 0.62;
  const bagX = x + (size - bagW) / 2;
  const bagY = y + size - bagH;
  const r = size * 0.09;
  return `
  <g>
    <path d="M ${x + size * 0.34} ${bagY + 2}
             C ${x + size * 0.34} ${y + size * 0.06} ${x + size * 0.66} ${y + size * 0.06} ${x + size * 0.66} ${bagY + 2}"
          fill="none" stroke="${GOLD}" stroke-width="${(size * 0.075).toFixed(1)}" stroke-linecap="round"/>
    <rect x="${bagX}" y="${bagY}" width="${bagW}" height="${bagH}" rx="${r}" fill="${GOLD}"/>
    <text x="${x + size / 2}" y="${bagY + bagH * 0.855}" text-anchor="middle"
          font-family="DejaVu Sans, Liberation Sans, Helvetica, Arial, sans-serif"
          font-size="${(bagH * 0.92).toFixed(1)}" font-weight="bold" fill="${NAVY}">P</text>
  </g>`;
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
      <stop offset="0%" stop-color="#0a1f44"/>
      <stop offset="100%" stop-color="#143562"/>
    </linearGradient>
  </defs>
  <rect width="${CANVAS}" height="${BANNER_H}" fill="url(#g)"/>
  <rect width="${CANVAS}" height="6" fill="${ORANGE}"/>
  ${emblem(62, 46, 22)}
  <text x="124" y="74" font-family="DejaVu Sans, Liberation Sans, Helvetica, Arial, sans-serif"
        font-size="50" font-weight="bold" fill="#ffffff" letter-spacing="1">Perokado</text>
  <text x="${CANVAS - 52}" y="70" text-anchor="end" font-family="DejaVu Sans, Liberation Sans, Helvetica, Arial, sans-serif"
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
