import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import nextConfig from '../next.config';

/**
 * Garde-fous des vignettes catalogue.
 *
 * Deux pièges silencieux sont couverts ici :
 *   1. l'ancienne enseigne ne doit plus apparaître sur aucune photo produit
 *      (le bandeau est redessiné par `npm run images:products -- --relabel`) ;
 *   2. une vignette remplacée au même chemin garderait la même clé dans le cache
 *      d'images de Next (indexé sur l'URL) : les visiteurs verraient l'ancienne
 *      version pendant des jours. Les URL portent donc une empreinte `?v=…`, et
 *      `images.localPatterns` doit accepter ces requêtes, sinon Next refuse de
 *      servir l'image (erreur 500 sur la fiche produit).
 */

type ImageEntry = { url: string; checksum: string; width: number; height: number };

const IMAGES: Record<string, ImageEntry> = JSON.parse(
  readFileSync('data/catalogue/images.json', 'utf8'),
) as Record<string, ImageEntry>;

describe('vignettes du catalogue', () => {
  it('versionne chaque URL par l’empreinte du fichier', () => {
    for (const [sku, entry] of Object.entries(IMAGES)) {
      const [path, query] = entry.url.split('?');
      expect(path, sku).toMatch(/^\/catalogue\/[a-z0-9-]+\.webp$/);
      expect(query, sku).toBe(`v=${entry.checksum.slice(0, 8)}`);
    }
  });

  it('déclare les requêtes versionnées dans images.localPatterns', () => {
    const patterns = nextConfig.images?.localPatterns ?? [];
    expect(patterns.some((pattern) => pattern.pathname === '/catalogue/**')).toBe(true);
  });

  it('ne laisse aucune trace de l’ancienne enseigne dans les sources de photo', () => {
    const builders = ['scripts/product-banner.ts', 'scripts/build-product-images.ts'];
    for (const file of builders) {
      const source = readFileSync(file, 'utf8');
      // Les commentaires d'historique sont exclus : on cherche du texte affiché.
      const visible = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(visible.toLowerCase()).not.toContain('medi shop');
    }
  });

  it('dessine le bandeau avec l’emblème et le nom de la boutique', () => {
    const source = readFileSync('scripts/product-banner.ts', 'utf8');
    expect(source).toContain('Perokado');
    expect(source).toContain('emblem');
  });
});
