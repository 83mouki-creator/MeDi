import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { countContactMessages, listContactMessages } from '@/lib/admin';
import { resetDb } from './helpers';

async function insert(id: string, status: string, createdAt: string, subject = `Sujet ${id}`) {
  await db.execute(sql`
    INSERT INTO contact_messages (id, name, email, subject, message, status, created_at)
    VALUES (${id}, ${`Client ${id}`}, ${`${id}@example.com`}, ${subject}, ${'Message de test détaillé.'}, ${status}, ${createdAt}::timestamptz)
  `);
}

beforeEach(async () => {
  await resetDb();
});

describe('Administration — demandes clients', () => {
  it('compte les nouvelles demandes et celles restant à traiter', async () => {
    await insert('m1', 'NEW', '2026-01-01T10:00:00Z');
    await insert('m2', 'NEW', '2026-01-02T10:00:00Z');
    await insert('m3', 'IN_PROGRESS', '2026-01-03T10:00:00Z');
    await insert('m4', 'CLOSED', '2026-01-04T10:00:00Z');

    const counters = await countContactMessages();
    expect(counters.total).toBe(4);
    expect(counters.newCount).toBe(2);
    expect(counters.open).toBe(3);
  });

  it('affiche par défaut les demandes encore à traiter, les plus récentes d’abord', async () => {
    await insert('m1', 'NEW', '2026-01-01T10:00:00Z');
    await insert('m2', 'CLOSED', '2026-01-02T10:00:00Z');
    await insert('m3', 'IN_PROGRESS', '2026-01-03T10:00:00Z');

    const result = await listContactMessages();
    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.id)).toEqual(['m3', 'm1']);
  });

  it('filtre par statut et pagine', async () => {
    for (let i = 0; i < 25; i += 1) await insert(`m${i}`, 'NEW', `2026-02-${String(i + 1).padStart(2, '0')}T10:00:00Z`);
    await insert('closed1', 'CLOSED', '2026-03-01T10:00:00Z');

    const closed = await listContactMessages({ status: 'CLOSED' });
    expect(closed.items.map((item) => item.id)).toEqual(['closed1']);

    const firstPage = await listContactMessages({ status: 'NEW', perPage: 20 });
    expect(firstPage.total).toBe(25);
    expect(firstPage.totalPages).toBe(2);
    expect(firstPage.items).toHaveLength(20);

    const secondPage = await listContactMessages({ status: 'NEW', perPage: 20, page: 2 });
    expect(secondPage.items).toHaveLength(5);
  });

  it('retrouve le message complet et les coordonnées du client', async () => {
    await insert('m1', 'NEW', '2026-01-01T10:00:00Z', 'Disponibilité scie circulaire');

    const result = await listContactMessages({ status: 'all' });
    expect(result.items[0]).toMatchObject({
      subject: 'Disponibilité scie circulaire',
      email: 'm1@example.com',
      status: 'NEW',
      message: 'Message de test détaillé.',
    });
  });
});
