/**
 * Génération des images de marque Perokado.
 *
 *   python3 scripts/make-brand-vectors.py   # 1. les tracés vectoriels
 *   npm run brand:assets                    # 2. toutes les images dérivées
 *
 * Entrées (dans public/brand/) :
 *   perokado-emblem.svg          emblème carré « P » doré sur bleu nuit
 *   perokado-wordmark-navy.svg   mot « Perokado » (fond clair)
 *   perokado-wordmark-white.svg  mot « Perokado » (fond bleu nuit)
 *   perokado-slogan-white.svg    slogan (fond bleu nuit)
 *   perokado-slogan-gold.svg     slogan (fond bleu nuit, variante dorée)
 *
 * Sorties :
 *   perokado-logo-horizontal-blanc.png   en-tête et pied de page (bleu nuit)
 *   perokado-logo-horizontal.png         documents et fonds clairs
 *   perokado-logo-blanc.png / perokado-logo.png        versions empilées (e-mails)
 *   perokado-icon.png                    icône 512 px (favicon HD, PWA, Play Store)
 *   perokado-icon-192.png                icône 192 px du manifeste
 *   perokado-icon-maskable-512.png       icône « maskable » (zone sûre 72 %)
 *   apple-touch-icon.png                 icône iOS 180 px
 *   favicon-32.png                       favicon
 *   perokado-og.png                      image de partage 1200 × 630 (logo + slogan)
 *   play-feature-graphic.png             bannière Play Store 1024 × 500
 *
 * Aucune police n'est nécessaire : les SVG contiennent des contours. Le rendu est
 * donc identique sur un poste de développement et sur une machine d'intégration.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';

const BRAND_DIR = path.join(process.cwd(), 'public', 'brand');

const NAVY = '#0e2340';
const NAVY_DEEP = '#081729';
const NAVY_LIGHT = '#1b3f6b';
const GOLD = '#f2b705';
const WHITE = '#ffffff';
const SLATE = '#f1f5fb';

/**
 * Rend un SVG à une largeur donnée.
 *
 * La densité est calculée à partir de la largeur réelle du viewBox : un SVG de
 * 4 783 unités ne doit pas être rendu à 2400 dpi (cela produirait une image de
 * plusieurs dizaines de milliers de pixels). On vise la largeur demandée, avec
 * une petite marge pour le lissage.
 */
async function renderSvg(file: string, width: number, background?: string): Promise<Buffer> {
  const svg = await readFile(path.join(BRAND_DIR, file), 'utf8');
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1]?.split(/[\s,]+/).map(Number);
  const svgWidth = viewBox && Number.isFinite(viewBox[2]) ? viewBox[2]! : 512;
  const density = Math.max(48, Math.min(1200, ((width * 1.15) / svgWidth) * 72));
  let pipeline = sharp(Buffer.from(svg), { density }).resize({ width, fit: 'inside' });
  if (background) pipeline = pipeline.flatten({ background });
  return pipeline.png().toBuffer();
}

async function meta(buffer: Buffer) {
  const info = await sharp(buffer).metadata();
  return { width: info.width ?? 0, height: info.height ?? 0 };
}

/** Décor bleu nuit commun aux visuels sombres. */
function navyBackdrop(width: number, height: number, radius = 0): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="fond" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${NAVY_LIGHT}"/>
      <stop offset="0.55" stop-color="${NAVY}"/>
      <stop offset="1" stop-color="${NAVY_DEEP}"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.2" cy="0.1" r="0.85">
      <stop offset="0" stop-color="${WHITE}" stop-opacity="0.13"/>
      <stop offset="1" stop-color="${WHITE}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="${radius}" fill="url(#fond)"/>
  <rect width="${width}" height="${height}" rx="${radius}" fill="url(#halo)"/>
</svg>`;
}

/**
 * Bandeau horizontal : emblème à gauche, mot (et éventuellement slogan) à droite.
 *
 * Chaque élément est rendu directement à sa taille finale (aucun redimensionnement
 * d'une image déjà rastérisée), et le slogan est ajusté à la largeur exacte du
 * mot : l'ensemble reste aligné quelle que soit la taille demandée.
 */
async function horizontalLockup(options: {
  dark: boolean;
  emblemHeight: number;
  wordHeight: number;
  /** Hauteur du slogan ; 0 = pas de slogan. */
  sloganHeight?: number;
}) {
  const { dark, emblemHeight, wordHeight, sloganHeight = 0 } = options;

  const emblem = await renderSvg('perokado-emblem.svg', emblemHeight);
  const emblemMeta = await meta(emblem);

  // Le mot est rendu à la hauteur voulue ; sa largeur en découle.
  const wordFull = await renderSvg(dark ? 'perokado-wordmark-white.svg' : 'perokado-wordmark-navy.svg', 2400);
  const wordFullMeta = await meta(wordFull);
  const wordWidth = Math.max(1, Math.round((wordFullMeta.width * wordHeight) / wordFullMeta.height));
  const word = await sharp(wordFull).resize({ width: wordWidth, height: wordHeight, fit: 'fill' }).png().toBuffer();

  const gap = Math.round(emblemHeight * 0.26);

  let textHeight = wordHeight;
  let slogan: Buffer | null = null;
  let sloganGap = 0;
  if (sloganHeight > 0) {
    // Le slogan est calé sur la largeur du mot, comme sur une charte imprimée.
    slogan = await renderSvg(dark ? 'perokado-slogan-gold.svg' : 'perokado-slogan-navy.svg', wordWidth);
    const sloganMeta = await meta(slogan);
    slogan = await sharp(slogan)
      .resize({ width: wordWidth, height: Math.round(sloganMeta.height), fit: 'fill' })
      .png()
      .toBuffer();
    sloganGap = Math.round(wordHeight * 0.34);
    textHeight = wordHeight + sloganGap + Math.round(sloganMeta.height);
  }

  const width = emblemMeta.width + gap + wordWidth;
  const height = Math.max(emblemHeight, textHeight);
  const layers: OverlayOptions[] = [
    { input: emblem, top: Math.round((height - emblemHeight) / 2), left: 0 },
    { input: word, top: Math.round((height - textHeight) / 2), left: emblemMeta.width + gap },
  ];
  if (slogan) {
    layers.push({
      input: slogan,
      top: Math.round((height - textHeight) / 2) + wordHeight + sloganGap,
      left: emblemMeta.width + gap,
    });
  }

  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers)
    .png()
    .toBuffer();
}

/** Logo empilé : emblème au-dessus, mot en dessous. */
async function stackedLockup(dark: boolean) {
  const emblem = await renderSvg('perokado-emblem.svg', 420);
  let word = await renderSvg(dark ? 'perokado-wordmark-white.svg' : 'perokado-wordmark-navy.svg', 760);
  const wordMeta = await meta(word);
  word = await sharp(word)
    .resize({ width: 620, height: Math.round((wordMeta.height * 620) / wordMeta.width) })
    .png()
    .toBuffer();
  const wordResized = await meta(word);
  const gap = 54;
  return sharp({
    create: { width: 620, height: 420 + gap + wordResized.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: emblem, top: 0, left: Math.round((620 - 420) / 2) },
      { input: word, top: 420 + gap, left: 0 },
    ])
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(BRAND_DIR, { recursive: true });

  // ── 1. Icônes ────────────────────────────────────────────────────────────
  const emblemSvg = await readFile(path.join(BRAND_DIR, 'perokado-emblem.svg'));
  const emblemBase = await sharp(emblemSvg, { density: 384 }).resize(1024, 1024).png().toBuffer();

  await sharp(emblemBase).resize(512, 512).png({ compressionLevel: 9 }).toFile(path.join(BRAND_DIR, 'perokado-icon.png'));
  await sharp(emblemBase).resize(192, 192).png({ compressionLevel: 9 }).toFile(path.join(BRAND_DIR, 'perokado-icon-192.png'));
  await sharp(emblemBase).resize(180, 180).png().toFile(path.join(BRAND_DIR, 'apple-touch-icon.png'));
  await sharp(emblemBase).resize(32, 32).png().toFile(path.join(BRAND_DIR, 'favicon-32.png'));

  // Icône « maskable » : le lanceur Android rogne les bords (cercle, goutte…),
  // le dessin doit donc tenir dans les 72 % centraux — ici, badge plus resserré.
  const maskableBadge = await sharp(emblemSvg, { density: 384 }).resize(1024, 1024).png().toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 14, g: 35, b: 64, alpha: 1 } },
  })
    .composite([{ input: await sharp(maskableBadge).resize(368, 368).png().toBuffer(), gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(BRAND_DIR, 'perokado-icon-maskable-512.png'));

  // ── 2. En-tête / pied de page ────────────────────────────────────────────
  const headerDark = await horizontalLockup({ dark: true, emblemHeight: 132, wordHeight: 56 });
  await sharp(headerDark).png({ compressionLevel: 9 }).toFile(path.join(BRAND_DIR, 'perokado-logo-horizontal-blanc.png'));

  const headerLight = await horizontalLockup({ dark: false, emblemHeight: 132, wordHeight: 56 });
  await sharp(headerLight).png({ compressionLevel: 9 }).toFile(path.join(BRAND_DIR, 'perokado-logo-horizontal.png'));

  // ── 3. Versions empilées (e-mails, documents) ────────────────────────────
  await sharp(await stackedLockup(false)).resize({ width: 900, withoutEnlargement: true }).png({ compressionLevel: 9 }).toFile(path.join(BRAND_DIR, 'perokado-logo.png'));
  await sharp(await stackedLockup(true)).resize({ width: 900, withoutEnlargement: true }).png({ compressionLevel: 9 }).toFile(path.join(BRAND_DIR, 'perokado-logo-blanc.png'));

  // ── 4. Image de partage 1200 × 630 : logo blanc + slogan ─────────────────
  const ogLockup = await horizontalLockup({ dark: true, emblemHeight: 200, wordHeight: 78, sloganHeight: 24 });
  const ogLockupMeta = await meta(ogLockup);
  const ogScale = Math.min(1, 860 / ogLockupMeta.width);
  const ogLogo = await sharp(ogLockup)
    .resize({ width: Math.round(ogLockupMeta.width * ogScale) })
    .png()
    .toBuffer();
  const ogLogoMeta = await meta(ogLogo);

  await sharp(Buffer.from(navyBackdrop(1200, 630)))
    .composite([{ input: ogLogo, top: Math.round((630 - ogLogoMeta.height) / 2), left: Math.round((1200 - ogLogoMeta.width) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(BRAND_DIR, 'perokado-og.png'));

  // ── 5. Bannière Play Store 1024 × 500, sans transparence, sans texte ─────
  const play = await horizontalLockup({ dark: true, emblemHeight: 210, wordHeight: 76 });
  const playMeta = await meta(play);
  const playScale = Math.min(1, 700 / playMeta.width);
  const playLogo = await sharp(play).resize({ width: Math.round(playMeta.width * playScale) }).png().toBuffer();
  const playLogoMeta = await meta(playLogo);

  await sharp(Buffer.from(navyBackdrop(1024, 500)))
    .composite([{ input: playLogo, top: Math.round((500 - playLogoMeta.height) / 2), left: Math.round((1024 - playLogoMeta.width) / 2) }])
    .flatten({ background: NAVY })
    // `flatten` aplatit sur le fond, mais sharp conserve un canal alpha si la
    // source en avait un : la Play Console refuse alors l'image. On le retire
    // explicitement et on force un PNG sans palette pour rester en RGB 8 bits.
    .removeAlpha()
    .toColorspace('srgb')
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(BRAND_DIR, 'play-feature-graphic.png'));

  // ── 6. Note de génération ────────────────────────────────────────────────
  await writeFile(
    path.join(BRAND_DIR, 'SOURCE.txt'),
    [
      'Fichiers générés — ne pas éditer à la main.',
      '',
      '  1. python3 scripts/make-brand-vectors.py   (tracés vectoriels)',
      '  2. npm run brand:assets                   (toutes les images dérivées)',
      '',
      'perokado-logo-horizontal-blanc.png  → en-tête et pied de page (fond bleu nuit)',
      'perokado-logo-horizontal.png        → documents et fonds clairs',
      'perokado-logo.png                   → logo empilé, fond clair',
      'perokado-logo-blanc.png             → logo empilé, fond sombre',
      'perokado-icon.png                   → icône carrée 512 px',
      'perokado-icon-192.png               → icône 192 px (manifeste Android)',
      'perokado-icon-maskable-512.png      → icône « maskable » 512 px',
      'apple-touch-icon.png                → icône iOS 180 px',
      'favicon-32.png                      → favicon 32 px',
      'perokado-og.png                     → image de partage 1200 × 630',
      'play-feature-graphic.png            → bannière Play Store 1024 × 500',
      '',
      'Slogan : « Tout ce que vous cherchez au même endroit. »',
      'Police des tracés : Poppins Bold, SIL OFL 1.1 (scripts/brand/Poppins-OFL.txt).',
      '',
    ].join('\n'),
  );

  const summary: Record<string, string> = {
    'perokado-logo-horizontal-blanc.png': 'en-tête / pied de page',
    'perokado-logo-horizontal.png': 'fonds clairs',
    'perokado-icon.png': 'icône 512',
    'perokado-og.png': 'partage 1200×630',
    'play-feature-graphic.png': 'bannière Play',
  };
  for (const [file, label] of Object.entries(summary)) {
    const info = await meta(await readFile(path.join(BRAND_DIR, file)));
    console.log(`✔ ${file.padEnd(36)} ${label.padEnd(22)} ${info.width}×${info.height}`);
  }
  console.log('✔ Images de marque Perokado générées dans public/brand');
}

main().catch((error) => {
  console.error('❌ Génération des images de marque impossible :', error);
  process.exitCode = 1;
});
