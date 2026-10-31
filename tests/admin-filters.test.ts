import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { listOrders } from '@/lib/orders';
import { listAuditLogs } from '@/lib/audit';
import { listStockProducts } from '@/lib/admin';
import { sanitizeSearch } from '@/lib/utils';
import { resetDb, createProduct } from './helpers';

beforeEach(async () => {
  await resetDb();
});

describe('sanitizeSearch', () => {
  it('retire les caractères de contrôle et borne la longueur', () => {
    expect(sanitizeSearch('scie\u0000 circulaire\u001f')).toBe('scie circulaire');
    expect(sanitizeSearch('   vis   inox   ')).toBe('vis inox');
    expect(sanitizeSearch('a'.repeat(200))).toHaveLength(80);
    expect(sanitizeSearch(undefined)).toBe('');
  });
});

describe('Filtres d’administration tolérants aux URL modifiées', () => {
  it('ignore un statut de commande inconnu au lieu de faire échouer la requête', async () => {
    await expect(listOrders({ status: 'NEW' })).resolves.toMatchObject({ total: 0 });
    await expect(listOrders({ paymentStatus: 'BIDON' })).resolves.toMatchObject({ total: 0 });
    await expect(listOrders({ from: 'pas-une-date', to: 'jamais' })).resolves.toMatchObject({ total: 0 });
  });

  it('recherche une commande par numéro', async () => {
    await db.execute(sql`
      INSERT INTO orders (id, number, status, payment_status, payment_method, delivery_method,
        customer_first_name, customer_last_name, phone, city, subtotal, shipping_fee, total,
        access_token, created_at, updated_at)
      VALUES ('o1', 'MED-2026-90001', 'PENDING_CONFIRMATION', 'UNPAID', 'WAVE', 'PICKUP',
        'Awa', 'Koffi', '+2250700000000', 'Daloa', 10000, 0, 10000, 'tok', now(), now())
    `);

    const found = await listOrders({ q: 'MED-2026-90001' });
    expect(found.total).toBe(1);
    expect(found.orders[0].number).toBe('MED-2026-90001');
  });

  it('ne casse pas sur un octet nul dans la recherche du journal', async () => {
    await expect(listAuditLogs(1, 10, 'pa\u0000yment')).resolves.toMatchObject({ total: 0 });
  });

  it('ne casse pas sur un octet nul dans la recherche de stock', async () => {
    await createProduct({ name: 'Perceuse à percussion' });

    const polluted = await listStockProducts({ q: 'perceuse\u0000' });
    expect(polluted.total).toBe(1);

    const clean = await listStockProducts({ q: 'perceuse' });
    expect(clean.items[0].name).toBe('Perceuse à percussion');
  });
});
