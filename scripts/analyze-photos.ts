/**
 * Analyse des photos source (SODIS-MAD CI) : détecte la bande d'en-tête bleue
 * et le bloc de texte imprimé en bas, pour ne garder que le produit.
 *
 *   npx tsx scripts/analyze-photos.ts
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

type Manifest = {
  produits: { sku: string; sourceFile: string; name: string }[];
};

const manifest = JSON.parse(readFileSync(path.join('data', 'catalogue', 'medi-2026-10.json'), 'utf8')) as Manifest;

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

async function analyze(file: string) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const ch = info.channels;
  const px = (x: number, y: number) => {
    const i = (y * W + x) * ch;
    return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0] as const;
  };

  // Bande d'en-tête : pixels bleus dominants sur toute la largeur.
  let headerEnd = 0;
  let misses = 0;
  for (let y = 0; y < Math.floor(H * 0.3); y++) {
    let blue = 0;
    for (let x = 0; x < W; x += 2) {
      const [r, g, b] = px(x, y);
      if (b > r + 30 && b > 90 && b > g + 10) blue++;
    }
    const frac = blue / (W / 2);
    if (frac > 0.5) {
      headerEnd = y;
      misses = 0;
    } else if (++misses > 4) {
      break;
    }
  }
  headerEnd = Math.min(headerEnd + 1, Math.floor(H * 0.3));

  // Bloc de texte en bas : lignes sombres peu couvertes, collées au bas de l'image.
  const darkFrac: number[] = [];
  for (let y = 0; y < H; y++) {
    let dark = 0;
    for (let x = 0; x < W; x += 2) {
      const [r, g, b] = px(x, y);
      if (luma(r, g, b) < 120) dark++;
    }
    darkFrac[y] = dark / (W / 2);
  }

  let bottom = -1;
  for (let y = H - 1; y >= Math.floor(H * 0.5); y--) {
    if ((darkFrac[y] ?? 0) > 0.004) {
      bottom = y;
      break;
    }
  }

  let textTop = H;
  if (bottom >= 0) {
    let gap = 0;
    let y = bottom;
    for (; y >= Math.floor(H * 0.45); y--) {
      const f = darkFrac[y] ?? 0;
      if (f > 0.004) {
        gap = 0;
      } else if (++gap > 10) {
        break;
      }
    }
    textTop = Math.min(H, y + gap + 2);
  }

  const [r, g, b] = px(4, Math.min(H - 1, headerEnd + 6));
  return { W, H, headerEnd, textTop, bottom, bg: `rgb(${r},${g},${b})` };
}

async function main() {
  const rows: string[] = [];
  for (const product of manifest.produits) {
    const file = path.join('data', 'photos-source', product.sourceFile);
    const r = await analyze(file);
    rows.push(
      `${product.sku.padEnd(22)} ${String(r.W)}x${String(r.H)}  entete=${String(r.headerEnd).padStart(4)}  texteBas=${String(r.textTop).padStart(4)}  bas=${String(r.bottom).padStart(4)}  fond=${r.bg}`,
    );
  }
  console.log(rows.join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
