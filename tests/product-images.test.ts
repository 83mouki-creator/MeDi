import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import nextConfig from '../next.config';
import { versionedImageUrl } from '@/lib/image-url';

/**
 * Garde-fous des vignettes catalogue.
 *
 * Deux pièges silencieux sont couverts ici :
 *   1. le serveur d'images de Next met en cache **sous la clé de l'URL source** :
 *      une photo remplacée au même chemin reste l'ancienne pendant des jours
 *      (l'ancien bandeau « MeDi » a survécu comme ça). L'affichage ajoute donc
 *      `?v=<empreinte>` et `images.localPatterns` doit accepter ces requêtes,
 *      sinon Next refuse de servir l'image et la fiche produit tombe en erreur ;
 *   2. le bandeau dessiné sur les photos doit porter l'emblème et le nom de la
 *      boutique, et plus aucune mention de l'ancienne enseigne.
 */

type ImageEntry = { url: string; checksum: string; width: number; height: number };

const IMAGES: Record<string, ImageEntry> = JSON.parse(
  readFileSync('data/catalogue/images.json', 'utf8'),
) as Record<string, ImageEntry>;

describe('vignettes du catalogue', () => {
  it('enregistre chaque photo avec son empreinte', () => {
    for (const [sku, entry] of Object.entries(IMAGES)) {
      expect(entry.url, sku).toMatch(/^\/catalogue\/[a-z0-9-]+\.webp$/);
      expect(entry.checksum, sku).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('versionne l’URL affichée à partir de l’empreinte', () => {
    const entry = IMAGES['31900'];
    expect(versionedImageUrl(entry!.url, entry!.checksum)).toBe(
      `${entry!.url}?v=${entry!.checksum.slice(0, 12)}`,
    );
  });

  it('laisse intactes les URL déjà versionnées, distantes ou hors catalogue', () => {
    expect(versionedImageUrl('/catalogue/a.webp?v=abcdef123456', 'x')).toBe('/catalogue/a.webp?v=abcdef123456');
    expect(versionedImageUrl('https://res.cloudinary.com/x/y.jpg', 'abc')).toBe('https://res.cloudinary.com/x/y.jpg');
    expect(versionedImageUrl('/uploads/photo.webp', 'abcdef')).toBe('/uploads/photo.webp');
    expect(versionedImageUrl(null, 'abcdef')).toBeNull();
  });

  it('déclare les requêtes versionnées dans images.localPatterns', () => {
    const patterns = nextConfig.images?.localPatterns ?? [];
    expect(patterns.some((pattern) => pattern.pathname === '/catalogue/**')).toBe(true);
  });

  it('dessine le bandeau avec l’emblème et le nom de la boutique', () => {
    const source = readFileSync('scripts/product-banner.ts', 'utf8');
    expect(source).toContain('Perokado');
    expect(source).toContain('emblem');
  });

  it('ne laisse aucune trace de l’ancienne enseigne dans le dessin des photos', () => {
    for (const file of ['scripts/product-banner.ts', 'scripts/build-product-images.ts']) {
      const source = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(source.toLowerCase(), file).not.toContain('medi shop');
    }
  });
});
