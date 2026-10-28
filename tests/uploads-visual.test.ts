import { beforeEach, describe, expect, it } from 'vitest';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { cosineSimilarity, embedImage, indexImage, providerInfo, searchByImage } from '@/lib/visual';
import { resetDb, createProduct, addProductImage } from './helpers';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const PUBLIC_DIR = path.join(process.cwd(), 'public');

async function png(color: { r: number; g: number; b: number }, size = 120) {
  return sharp({ create: { width: size, height: size, channels: 3, background: color } }).png().toBuffer();
}

async function fileFrom(buffer: Buffer, type: string, name: string) {
  return new File([new Uint8Array(buffer)], name, { type });
}

let zones: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  zones = await resetDb();
  void zones;
});

describe('téléversement d’images', () => {
  it('refuse un fichier qui n’est pas une image', async () => {
    const { storeImage, UploadError } = await import('@/lib/storage');
    const file = await fileFrom(Buffer.from('pas une image'), 'text/plain', 'note.txt');
    await expect(storeImage({ file })).rejects.toBeInstanceOf(UploadError);
  });

  it('refuse une image dont le contenu ne correspond pas au type déclaré', async () => {
    const { storeImage, UploadError } = await import('@/lib/storage');
    const file = await fileFrom(Buffer.from('contenu falsifié'), 'image/png', 'faux.png');
    await expect(storeImage({ file })).rejects.toBeInstanceOf(UploadError);
  });

  it('accepte une image valide, la normalise en WebP et calcule une empreinte', async () => {
    const { storeImage } = await import('@/lib/storage');
    const file = await fileFrom(await png({ r: 200, g: 30, b: 30 }, 400), 'image/png', 'produit.png');
    const stored = await storeImage({ file, name: 'Perceuse test' });

    expect(stored.url.startsWith('/uploads/')).toBe(true);
    expect(stored.url.endsWith('.webp')).toBe(true);
    expect(stored.width).toBeGreaterThan(0);
    expect(stored.height).toBeGreaterThan(0);
    expect(stored.bytes).toBeGreaterThan(0);
    expect(stored.checksum).toMatch(/^[a-f0-9]{64}$/);

    const written = await readFile(path.join(PUBLIC_DIR, stored.url));
    const meta = await sharp(written).metadata();
    expect(meta.format).toBe('webp');

    await rm(path.join(PUBLIC_DIR, stored.url), { force: true });
  });
});

describe('recherche visuelle', () => {
  it('expose un fournisseur explicite et ne prétend pas être sémantique', () => {
    const provider = providerInfo();
    expect(provider.available).toBe(true);
    expect(provider.id).toBe('local');
    expect(provider.semantic).toBe(false);
    expect(provider.note.length).toBeGreaterThan(20);
  });

  it('produit des descripteurs comparables (rouge ≠ bleu)', async () => {
    const red = await embedImage(await png({ r: 220, g: 30, b: 30 }));
    const blue = await embedImage(await png({ r: 30, g: 40, b: 200 }));
    const red2 = await embedImage(await png({ r: 215, g: 35, b: 35 }));

    const similar = cosineSimilarity(red.vector, red2.vector);
    const different = cosineSimilarity(red.vector, blue.vector);

    expect(red.vector).toHaveLength(blue.vector.length);
    // Le descripteur local reste un comparateur grossier : on vérifie l'ordre
    // (même couleur > couleur opposée), pas une précision de modèle profond.
    expect(similar).toBeGreaterThan(0.7);
    expect(different).toBeLessThan(0.5);
    expect(similar).toBeGreaterThan(different + 0.2);
  });

  it('retrouve le produit dont l’image est la plus proche', async () => {
    const product = await createProduct({ name: 'Casque de chantier jaune', price: '7500', stock: 6 });
    const filename = `test-visual-${Date.now()}.png`;
    await sharp(await png({ r: 240, g: 200, b: 20 }, 300)).png().toFile(path.join(UPLOAD_DIR, filename));
    const image = await addProductImage(product.id, `/uploads/${filename}`);

    const indexed = await indexImage({ imageId: image.id, url: `/uploads/${filename}`, table: 'product_images' });
    expect(indexed.ok).toBe(true);

    const result = await searchByImage(await png({ r: 238, g: 198, b: 25 }, 300), 'image/png', 5);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error('recherche indisponible');

    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0]!.product.id).toBe(product.id);
    // Le descripteur local n'est pas calibré : jamais de « correspondance certaine ».
    expect(result.confident).toBe(false);
    expect(result.calibrated).toBe(false);

    await rm(path.join(UPLOAD_DIR, filename), { force: true });
  });

  it('compare réellement plusieurs produits et classe le meilleur en premier', async () => {
    const red = await createProduct({ name: 'Seau rouge', price: '3000', stock: 4 });
    const blue = await createProduct({ name: 'Bidon bleu', price: '4500', stock: 4 });

    const stamp = Date.now();
    const redName = `test-red-${stamp}.png`;
    const blueName = `test-blue-${stamp}.png`;
    await sharp(await png({ r: 230, g: 20, b: 20 }, 300)).png().toFile(path.join(UPLOAD_DIR, redName));
    await sharp(await png({ r: 20, g: 30, b: 220 }, 300)).png().toFile(path.join(UPLOAD_DIR, blueName));

    const [redImage, blueImage] = await Promise.all([
      addProductImage(red.id, `/uploads/${redName}`),
      addProductImage(blue.id, `/uploads/${blueName}`),
    ]);
    await indexImage({ imageId: redImage.id, url: `/uploads/${redName}` });
    await indexImage({ imageId: blueImage.id, url: `/uploads/${blueName}` });

    const result = await searchByImage(await png({ r: 225, g: 25, b: 25 }, 300), 'image/png', 4);
    if (!result.available) throw new Error('recherche indisponible');

    expect(result.matches[0]!.product.id).toBe(red.id);
    const blueMatch = result.matches.find((m) => m.product.id === blue.id);
    if (blueMatch) expect(blueMatch.score).toBeLessThan(result.matches[0]!.score);

    await Promise.all([
      rm(path.join(UPLOAD_DIR, redName), { force: true }),
      rm(path.join(UPLOAD_DIR, blueName), { force: true }),
    ]);
  });
});
