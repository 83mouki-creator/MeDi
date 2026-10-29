import { beforeEach, describe, expect, it } from 'vitest';
import { listProducts } from '@/lib/catalog';
import { searchProducts, suggest } from '@/lib/search';
import { computeAvailability, computePricing } from '@/lib/pricing';
import { randomBytes } from 'node:crypto';
import { db } from '@/db';
import { categories } from '@/db/schema';
import { resetDb, createProduct, createCategory, createBrand } from './helpers';

beforeEach(async () => {
  await resetDb();
});

describe('règles de prix et de disponibilité', () => {
  it('n’applique une promotion que dans sa fenêtre de validité', () => {
    const base = { price: '20000', promoPrice: '15000' };

    const future = computePricing({ ...base, promoStartsAt: new Date(Date.now() + 86_400_000), promoEndsAt: null });
    expect(future.onPromo).toBe(false);
    expect(future.price).toBe(20000);

    const active = computePricing({ ...base, promoStartsAt: new Date(Date.now() - 86_400_000), promoEndsAt: null });
    expect(active.onPromo).toBe(true);
    expect(active.price).toBe(15000);
    expect(active.discountPercent).toBe(25);

    const expired = computePricing({ ...base, promoStartsAt: null, promoEndsAt: new Date(Date.now() - 1000) });
    expect(expired.onPromo).toBe(false);
  });

  it('ignore une promotion supérieure ou égale au prix de base', () => {
    const pricing = computePricing({ price: '10000', promoPrice: '12000', promoStartsAt: null, promoEndsAt: null });
    expect(pricing.onPromo).toBe(false);
    expect(pricing.price).toBe(10000);
  });

  it('annonce « épuisé » quand le stock disponible est nul, sauf précommande explicite', () => {
    const out = computeAvailability({ stock: 2, reserved: 2, allowPreorder: false }, 5);
    expect(out.state).toBe('OUT_OF_STOCK');
    expect(out.canOrder).toBe(false);

    const preorder = computeAvailability({ stock: 0, reserved: 0, allowPreorder: true }, 5);
    expect(preorder.state).toBe('PREORDER');
    expect(preorder.canOrder).toBe(true);

    expect(computeAvailability({ stock: 3, reserved: 0, allowPreorder: false }, 5).state).toBe('LOW_STOCK');
    expect(computeAvailability({ stock: 20, reserved: 2, allowPreorder: false }, 5).state).toBe('IN_STOCK');
  });
});

describe('catalogue : filtres et tri', () => {
  it('filtre par catégorie, marque, prix et disponibilité', async () => {
    const category = await createCategory('Plomberie (test)');
    const brand = await createBrand('Nasco');
    await createProduct({ name: 'Tuyau PVC 32 mm', price: '4500', stock: 20, categoryId: category.id, brandId: brand.id });
    await createProduct({ name: 'Tuyau PVC 40 mm', price: '6500', stock: 0, categoryId: category.id, brandId: brand.id });
    await createProduct({ name: 'Robinet laiton', price: '9000', stock: 4, categoryId: category.id, brandId: brand.id });

    const byCategory = await listProducts({ category: category.slug });
    expect(byCategory.total).toBe(3);

    const inStock = await listProducts({ category: category.slug, availability: 'in_stock' });
    expect(inStock.items.every((item) => item.stock - item.reserved > 0)).toBe(true);
    expect(inStock.total).toBe(2);

    const priceAsc = await listProducts({ category: category.slug, sort: 'price_asc' });
    expect(Number(priceAsc.items[0]!.effectivePrice)).toBe(4500);

    const priceDesc = await listProducts({ category: category.slug, sort: 'price_desc' });
    expect(Number(priceDesc.items[0]!.effectivePrice)).toBe(9000);

    const ranged = await listProducts({ category: category.slug, minPrice: 5000, maxPrice: 7000 });
    expect(ranged.items.map((item) => item.name)).toEqual(['Tuyau PVC 40 mm']);
  });

  it('remonte les produits des sous-catégories depuis une catégorie parente', async () => {
    const parent = await createCategory('Éclairage LED (test)');
    const [child] = await db
      .insert(categories)
      .values({ id: `tst_cat_${randomBytes(3).toString('hex')}`, slug: `spots-${randomBytes(3).toString('hex')}`, name: 'Spots (test)', parentId: parent.id })
      .returning();

    await createProduct({ name: 'Spot encastré 18 W', categoryId: child!.id, price: '9500', stock: 12 });
    await createProduct({ name: 'Ampoule flamante', categoryId: parent.id, price: '2500', stock: 20 });
    await createProduct({ name: 'Produit hors rayon', price: '1000', stock: 5 });

    const fromParent = await listProducts({ category: parent.slug });
    expect(fromParent.total).toBe(2);
    expect(fromParent.items.map((item) => item.name).sort()).toEqual(['Ampoule flamante', 'Spot encastré 18 W']);

    const fromChild = await listProducts({ category: child!.slug });
    expect(fromChild.total).toBe(1);
    expect(fromChild.items[0]!.name).toBe('Spot encastré 18 W');
  });

  it('masque les produits inactifs ou archivés', async () => {
    const category = await createCategory('Divers (test)');
    await createProduct({ name: 'Produit actif', categoryId: category.id });
    await createProduct({ name: 'Produit inactif', categoryId: category.id, isActive: false });
    await createProduct({ name: 'Produit archivé', categoryId: category.id, isArchived: true });

    const result = await listProducts({ category: category.slug });
    expect(result.total).toBe(1);
    expect(result.items[0]!.name).toBe('Produit actif');
  });
});

describe('recherche texte', () => {
  it('trouve par nom exact, partiel, référence, marque et synonyme', async () => {
    const category = await createCategory('Outillage électroportatif (test)');
    const brand = await createBrand('Nasco');
    const product = await createProduct({
      name: 'Perceuse à percussion 850 W',
      categoryId: category.id,
      brandId: brand.id,
      keywords: ['visseuse', 'perceuse visseuse', 'foreuse'],
      shortDescription: 'Mandrin 13 mm, puissance 850 W.',
    });

    for (const query of ['Perceuse à percussion 850 W', 'perceuse', 'PERCEUSE', product.sku, 'Nasco']) {
      const result = await searchProducts(query);
      expect(result.items.some((item) => item.id === product.id), `requête « ${query} »`).toBe(true);
    }

    const synonym = await searchProducts('visseuse');
    expect(synonym.items.some((item) => item.id === product.id)).toBe(true);
  });

  it('tolère une faute de frappe (trigrammes)', async () => {
    await createProduct({ name: 'Marteau de charpentier 500 g', keywords: ['marteau'] });
    const result = await searchProducts('marteu');
    expect(result.total).toBeGreaterThan(0);
    expect(result.items[0]!.name).toContain('Marteau');
  });

  it('renvoie un résultat vide sans erreur pour une requête sans correspondance', async () => {
    await createProduct({ name: 'Ciment 50 kg' });
    const result = await searchProducts('quantum-flux-capacitor');
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('propose des suggestions dès la saisie, même sur plusieurs mots', async () => {
    const product = await createProduct({
      name: 'Interrupteur différentiel 2P 40 A — 30 mA',
      shortDescription: 'Protection des personnes, gamme Easy9.',
      keywords: ['differentiel', 'ddr', 'easy9'],
    });

    // Un seul mot, puis deux mots saisis dans le désordre : la suggestion doit
    // rester proposée pendant la frappe.
    for (const query of ['differentiel', 'differentiel 40', '40 differentiel']) {
      const results = await suggest(query);
      expect(
        results.some((item) => item.kind === 'product' && item.href === `/produit/${product.slug}`),
        `suggestion pour « ${query} »`,
      ).toBe(true);
    }

    // Deux mots qui ne désignent pas le même produit ne doivent pas le proposer.
    const unrelated = await suggest('differentiel ciment');
    expect(unrelated.some((item) => item.href === `/produit/${product.slug}`)).toBe(false);
  });

  it('respecte la pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await createProduct({ name: `Ciment test ${i}`, categoryId: null });
    }
    const page1 = await searchProducts('ciment', { page: 1, perPage: 2 });
    const page2 = await searchProducts('ciment', { page: 2, perPage: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(2);
    expect(page1.items[0]!.id).not.toBe(page2.items[0]!.id);
    expect(page1.total).toBe(5);
    expect(page1.totalPages).toBe(3);
  });
});

describe('prix affiché dans les cartes produit', () => {
  it('expose le prix promotionnel et le pourcentage de remise', async () => {
    const category = await createCategory('Promo (test)');
    await createProduct({
      name: 'Scie circulaire en promotion',
      price: '50000',
      promoPrice: '40000',
      promoStartsAt: new Date(Date.now() - 3600_000),
      categoryId: category.id,
      stock: 3,
    });

    const result = await listProducts({ category: category.slug });
    const item = result.items[0]!;
    expect(item.onPromo).toBe(true);
    expect(Number(item.effectivePrice)).toBe(40000);
    expect(item.discountPercent).toBe(20);
  });
});
