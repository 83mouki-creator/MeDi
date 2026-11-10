import { beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { orderItems, orders, productStickers, products, stickers } from '@/db/schema';
import { getDashboardMetrics, productProfitability, productsMissingPurchasePrice } from '@/lib/admin';
import { importCatalogCsv } from '@/lib/import';
import {
  MAX_STICKERS_PER_PRODUCT,
  STICKER_ICONS,
  STICKER_TONES,
  applyStickerToProducts,
  isStickerLive,
  listStickers,
  removeStickerFromProduct,
  setProductStickers,
  stickersForProduct,
  stickersForProducts,
} from '@/lib/stickers';
import { createOrder } from '@/lib/orders';
import type { CheckoutInput } from '@/lib/validation';
import { createProduct, createUser, checkoutInput, resetDb } from './helpers';

let zones: Awaited<ReturnType<typeof resetDb>>;
let neighbourhood: string;

beforeEach(async () => {
  zones = await resetDb();
  neighbourhood = 'Commerce';
});

/** Crée un sticker directement en base (l'action d'admin exige une session). */
async function createSticker(overrides: Partial<{ label: string; tone: 'GOLD' | 'GREEN'; isActive: boolean; startsAt: Date | null; endsAt: Date | null }> = {}) {
  const id = `stk_test_${Math.random().toString(36).slice(2, 10)}`;
  await db.insert(stickers).values({
    id,
    label: overrides.label ?? 'Garantie 12 mois',
    detail: 'Pièces et main-d’œuvre',
    tone: overrides.tone ?? 'GOLD',
    icon: 'shield',
    startsAt: overrides.startsAt ?? null,
    endsAt: overrides.endsAt ?? null,
    isActive: overrides.isActive ?? true,
  });
  return id;
}

/* ------------------------------------------------------------------ */
/* Stickers                                                            */
/* ------------------------------------------------------------------ */

describe('stickers produit', () => {
  it('expose deux emplacements au maximum et les cinq teintes prévues', () => {
    expect(MAX_STICKERS_PER_PRODUCT).toBe(2);
    expect(STICKER_TONES).toEqual(['GOLD', 'GREEN', 'RED', 'NAVY', 'WHITE']);
    expect(STICKER_ICONS).toContain('shield');
    expect(STICKER_ICONS).toContain('percent');
  });

  it('n’affiche un sticker que s’il est actif et dans sa fenêtre de dates', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const base = { isActive: true, startsAt: null, endsAt: null };
    expect(isStickerLive(base, now)).toBe(true);
    expect(isStickerLive({ ...base, isActive: false }, now)).toBe(false);
    expect(isStickerLive({ ...base, startsAt: new Date('2026-07-01') }, now)).toBe(false);
    expect(isStickerLive({ ...base, endsAt: new Date('2026-06-01') }, now)).toBe(false);
    // Bornes incluses : le jour de fin reste visible.
    expect(isStickerLive({ ...base, endsAt: new Date('2026-06-15T23:59:59Z') }, now)).toBe(true);
  });

  it('applique un sticker à tout le catalogue puis refuse le troisième', async () => {
    const first = await createProduct({ name: 'Perceuse', stock: 5 });
    const second = await createProduct({ name: 'Marteau', stock: 5 });
    const a = await createSticker({ label: 'Garantie 12 mois' });
    const b = await createSticker({ label: '-20 %', tone: 'GREEN' });
    const c = await createSticker({ label: 'Livraison offerte' });

    const productIds = [first.id, second.id];
    expect(await applyStickerToProducts({ stickerId: a, productIds, mode: 'add' })).toEqual({
      applied: 2,
      skipped: 0,
    });
    expect(await applyStickerToProducts({ stickerId: b, productIds, mode: 'add' })).toEqual({
      applied: 2,
      skipped: 0,
    });
    // Les deux emplacements sont pris : le troisième est ignoré, pas écrasé.
    expect(await applyStickerToProducts({ stickerId: c, productIds, mode: 'add' })).toEqual({
      applied: 0,
      skipped: 2,
    });

    const visible = await stickersForProduct(first.id);
    expect(visible).toHaveLength(2);
    expect(visible.map((sticker) => sticker.position).sort()).toEqual([0, 1]);
  });

  it('remplace les stickers existants quand on le demande', async () => {
    const product = await createProduct({ stock: 3 });
    const a = await createSticker({ label: 'Garantie 12 mois' });
    const b = await createSticker({ label: '-20 %' });
    await applyStickerToProducts({ stickerId: a, productIds: [product.id], mode: 'add' });
    await applyStickerToProducts({ stickerId: b, productIds: [product.id], mode: 'replace' });

    const visible = await stickersForProduct(product.id);
    expect(visible).toHaveLength(1);
    expect(visible[0]!.label).toBe('-20 %');
  });

  it('la base refuse elle-même un troisième sticker (contrainte de sécurité)', async () => {
    const product = await createProduct({ stock: 3 });
    const ids = [await createSticker({ label: 'Un' }), await createSticker({ label: 'Deux' }), await createSticker({ label: 'Trois' })];
    await db.insert(productStickers).values([
      { productId: product.id, stickerId: ids[0]!, position: 0 },
      { productId: product.id, stickerId: ids[1]!, position: 1 },
    ]);
    await expect(
      db.insert(productStickers).values({ productId: product.id, stickerId: ids[2]!, position: 0 }),
    ).rejects.toThrow();
  });

  it('ne montre jamais un sticker inactif au client', async () => {
    const product = await createProduct({ stock: 3 });
    const off = await createSticker({ label: 'Soldes', isActive: false });
    const on = await createSticker({ label: 'Garantie 6 mois' });
    await db.insert(productStickers).values([
      { productId: product.id, stickerId: off, position: 0 },
      { productId: product.id, stickerId: on, position: 1 },
    ]);

    const visible = await stickersForProduct(product.id);
    expect(visible.map((sticker) => sticker.label)).toEqual(['Garantie 6 mois']);

    const map = await stickersForProducts([product.id]);
    expect(map.get(product.id)).toHaveLength(1);
  });

  it('enregistre l’ordre des emplacements et retire un sticker d’un produit', async () => {
    const product = await createProduct({ stock: 3 });
    const a = await createSticker({ label: 'Gauche' });
    const b = await createSticker({ label: 'Droite' });
    await setProductStickers(product.id, [a, b]);
    const ordered = await stickersForProduct(product.id);
    expect(ordered.map((sticker) => [sticker.label, sticker.position])).toEqual([
      ['Gauche', 0],
      ['Droite', 1],
    ]);

    await removeStickerFromProduct(product.id, a);
    expect((await stickersForProduct(product.id)).map((sticker) => sticker.label)).toEqual(['Droite']);
  });

  it('compte les produits concernés dans le catalogue des stickers', async () => {
    const product = await createProduct({ stock: 3 });
    const id = await createSticker({ label: 'Garantie 12 mois' });
    await applyStickerToProducts({ stickerId: id, productIds: [product.id], mode: 'add' });
    const list = await listStickers();
    expect(list.find((sticker) => sticker.id === id)?.productCount).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* Prix d'achat et bénéfice net                                        */
/* ------------------------------------------------------------------ */

function input(overrides: Record<string, unknown>): CheckoutInput {
  return checkoutInput(overrides) as unknown as CheckoutInput;
}

describe('prix d’achat et bénéfice net', () => {
  it('fige le prix d’achat sur la ligne de commande, pas seulement sur le produit', async () => {
    const product = await createProduct({ price: '20000', stock: 5 });
    await db.update(products).set({ purchasePrice: '12000' }).where(eq(products.id, product.id));

    const { order } = await createOrder({
      input: input({
        items: [{ productId: product.id, quantity: 2 }],
        deliveryMethod: 'LOCAL_DELIVERY',
        zoneId: zones.localZone.id,
        neighbourhood,
        paymentMethod: 'WAVE',
      }),
    });

    const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    expect(lines).toHaveLength(1);
    expect(Number(lines[0]!.purchasePriceSnapshot)).toBe(12000);

    // Le tarif fournisseur change : la vente passée ne bouge pas.
    await db.update(products).set({ purchasePrice: '15000' }).where(eq(products.id, product.id));
    const after = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    expect(Number(after[0]!.purchasePriceSnapshot)).toBe(12000);
  });

  it('laisse le prix d’achat inconnu à NULL plutôt qu’à zéro', async () => {
    const product = await createProduct({ price: '9000', stock: 4 });
    const { order } = await createOrder({
      input: input({
        items: [{ productId: product.id, quantity: 1 }],
        deliveryMethod: 'LOCAL_DELIVERY',
        zoneId: zones.localZone.id,
        neighbourhood,
        paymentMethod: 'WAVE',
      }),
    });
    const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    expect(lines[0]!.purchasePriceSnapshot).toBeNull();
  });

  it('calcule le bénéfice net sur les commandes réellement payées', async () => {
    const product = await createProduct({ price: '20000', stock: 10 });
    await db.update(products).set({ purchasePrice: '12000' }).where(eq(products.id, product.id));

    const { order } = await createOrder({
      input: input({
        items: [{ productId: product.id, quantity: 3 }],
        deliveryMethod: 'LOCAL_DELIVERY',
        zoneId: zones.localZone.id,
        neighbourhood,
        paymentMethod: 'WAVE',
      }),
    });

    // Non payée : aucun bénéfice.
    expect((await getDashboardMetrics()).profitTotal).toBe(0);

    await db.update(orders).set({ paymentStatus: 'PAID', status: 'PAYMENT_CONFIRMED' }).where(eq(orders.id, order.id));

    // (20 000 − 12 000) × 3 = 24 000, hors frais de livraison.
    const metrics = await getDashboardMetrics();
    expect(metrics.profitTotal).toBe(24000);
    expect(metrics.profitMonth).toBe(24000);
    // Le CA, lui, inclut la livraison : 60 000 + 2 000.
    expect(metrics.revenue).toBe(62000);
    expect(metrics.revenueNetMonth).toBe(60000);
  });

  it('ne compte jamais une vente sans prix d’achat comme du bénéfice', async () => {
    const known = await createProduct({ price: '10000', stock: 10 });
    const unknown = await createProduct({ price: '50000', stock: 10 });
    await db.update(products).set({ purchasePrice: '7000' }).where(eq(products.id, known.id));

    const { order } = await createOrder({
      input: input({
        items: [
          { productId: known.id, quantity: 1 },
          { productId: unknown.id, quantity: 1 },
        ],
        deliveryMethod: 'LOCAL_DELIVERY',
        zoneId: zones.localZone.id,
        neighbourhood,
        paymentMethod: 'WAVE',
      }),
    });
    await db.update(orders).set({ paymentStatus: 'PAID', status: 'PAYMENT_CONFIRMED' }).where(eq(orders.id, order.id));

    const metrics = await getDashboardMetrics();
    expect(metrics.profitTotal).toBe(3000);
    expect(metrics.unitsWithoutCost).toBe(1);
    expect(metrics.productsWithoutCost).toBe(1);

    const missing = await productsMissingPurchasePrice();
    expect(missing.map((row) => row.id)).toEqual([unknown.id]);
  });

  it('classe les produits par bénéfice et signale un prix d’achat manquant', async () => {
    const good = await createProduct({ name: 'Perceuse', price: '30000', stock: 10 });
    const thin = await createProduct({ name: 'Ciment', price: '5000', stock: 100 });
    await db.update(products).set({ purchasePrice: '20000' }).where(eq(products.id, good.id));
    await db.update(products).set({ purchasePrice: '4700' }).where(eq(products.id, thin.id));

    const { order } = await createOrder({
      input: input({
        items: [
          { productId: good.id, quantity: 1 },
          { productId: thin.id, quantity: 2 },
        ],
        deliveryMethod: 'LOCAL_DELIVERY',
        zoneId: zones.localZone.id,
        neighbourhood,
        paymentMethod: 'WAVE',
      }),
    });
    await db.update(orders).set({ paymentStatus: 'PAID', status: 'PAYMENT_CONFIRMED' }).where(eq(orders.id, order.id));

    const rows = await productProfitability();
    expect(rows.map((row) => row.name)).toEqual(['Perceuse', 'Ciment']);
    expect(rows[0]!.profit).toBe(10000);
    expect(rows[1]!.profit).toBe(600);
    expect(rows[0]!.marginRate).toBe(33);
    expect(rows.every((row) => row.missingCost === false)).toBe(true);
  });

  it('lit la colonne prix_achat du fichier CSV', async () => {
    const csv = [
      'sku;nom;prix;prix_achat;stock;categorie;marque;description_courte;prix_promo;mots_cles',
      'PER-9001;Perceuse 850 W;25000;16000;12;Outillage;Nasco;Mandrin 13 mm;21000;perceuse',
    ].join('\n');
    const report = await importCatalogCsv(csv);
    expect(report.created).toBe(1);

    const rows = await db.select().from(products).where(eq(products.sku, 'PER-9001'));
    expect(Number(rows[0]!.purchasePrice)).toBe(16000);
  });

  it('conserve le prix d’achat existant quand la colonne est vide lors d’une mise à jour', async () => {
    const withCost = 'sku;nom;prix;prix_achat;stock\nPER-9002;Marteau;6000;4000;10';
    await importCatalogCsv(withCost);
    const withoutCost = 'sku;nom;prix;prix_achat;stock\nPER-9002;Marteau renforcé;6500;;8';
    await importCatalogCsv(withoutCost);

    const rows = await db.select().from(products).where(eq(products.sku, 'PER-9002'));
    expect(rows[0]!.name).toBe('Marteau renforcé');
    expect(rows[0]!.stock).toBe(8);
    expect(Number(rows[0]!.purchasePrice)).toBe(4000);
  });

  it('garde le prix d’achat hors de la boutique publique', async () => {
    const product = await createProduct({ price: '15000', stock: 4 });
    await db.update(products).set({ purchasePrice: '9000' }).where(eq(products.id, product.id));

    // Aucune requête de la vitrine ne sélectionne la colonne : on vérifie ici
    // qu'aucun type public ne l'expose.
    const { getProductBySlug } = await import('@/lib/catalog');
    const detail = await getProductBySlug(product.slug);
    expect(detail).not.toBeNull();
    expect(Object.keys(detail!)).not.toContain('purchasePrice');
    expect(JSON.stringify(detail)).not.toContain('purchasePrice');
  });
});

/* ------------------------------------------------------------------ */
/* Migration                                                           */
/* ------------------------------------------------------------------ */

describe('migration du prix d’achat', () => {
  it('la table order_items possède la colonne figée', async () => {
    const result = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'order_items' AND column_name = 'purchase_price_snapshot'
    `);
    expect(result.rows).toHaveLength(1);
  });
});
