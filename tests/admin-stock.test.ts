import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { getStockCounters, listStockProducts } from '@/lib/admin';
import { resetDb } from './helpers';

const id = (n: number) => `stk_${n}`;

async function seed(n: number, stock: number, reserved = 0, active = true) {
  await db.execute(sql`
    INSERT INTO products (id, sku, slug, name, price, stock, reserved, low_stock_threshold, is_active, is_archived)
    VALUES (${id(n)}, ${`SKU-${n}`}, ${`produit-${n}`}, ${`Produit ${n}`}, 10000, ${stock}, ${reserved}, 5, ${active}, false)
  `);
}

beforeEach(async () => {
  await resetDb();
});

describe('Administration — écran Stock', () => {
  it('compte tous les produits publiés, pas un échantillon', async () => {
    for (let i = 0; i < 40; i += 1) await seed(i, 20);

    const counters = await getStockCounters();
    expect(counters.tracked).toBe(40);
    expect(counters.low).toBe(0);
    expect(counters.out).toBe(0);
  });

  it('distingue les produits sous le seuil et les produits épuisés', async () => {
    await seed(1, 20);
    await seed(2, 3); // sous le seuil de 5
    await seed(3, 2, 2); // disponible 0 -> épuisé
    await seed(4, 50, 0, false); // masqué : ignoré

    const counters = await getStockCounters();
    expect(counters.tracked).toBe(3);
    expect(counters.low).toBe(2);
    expect(counters.out).toBe(1);
  });

  it('liste l’ensemble du catalogue, disponibilité la plus basse d’abord', async () => {
    await seed(1, 30);
    await seed(2, 2);
    await seed(3, 12);

    const all = await listStockProducts({ perPage: 25 });
    expect(all.total).toBe(3);
    expect(all.items.map((item) => item.sku)).toEqual(['SKU-2', 'SKU-3', 'SKU-1']);
    expect(all.items[0].available).toBe(2);
  });

  it('pagine sans perdre le total', async () => {
    for (let i = 0; i < 30; i += 1) await seed(i, 10);

    const first = await listStockProducts({ perPage: 25 });
    expect(first.total).toBe(30);
    expect(first.items).toHaveLength(25);
    expect(first.totalPages).toBe(2);

    const second = await listStockProducts({ perPage: 25, page: 2 });
    expect(second.items).toHaveLength(5);
    expect(second.page).toBe(2);
  });

  it('filtre par recherche et par état de stock', async () => {
    await seed(1, 0); // nom « Produit 1 »
    await seed(2, 40);
    await seed(3, 0);

    const search = await listStockProducts({ q: 'produit 3' });
    expect(search.total).toBe(1);
    expect(search.items[0].sku).toBe('SKU-3');

    const low = await listStockProducts({ filter: 'low' });
    expect(low.items.map((item) => item.sku).sort()).toEqual(['SKU-1', 'SKU-3']);

    const out = await listStockProducts({ filter: 'out' });
    expect(out.items).toHaveLength(2);

    const none = await listStockProducts({ q: 'introuvable-xyz' });
    expect(none.items).toHaveLength(0);
    expect(none.total).toBe(0);
  });

  it('calcule la disponibilité en retirant les unités réservées', async () => {
    await seed(1, 10, 4);

    const result = await listStockProducts({});
    expect(result.items[0].stock).toBe(10);
    expect(result.items[0].reserved).toBe(4);
    expect(result.items[0].available).toBe(6);
  });
});
