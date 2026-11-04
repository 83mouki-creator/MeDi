import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { addresses, auditLogs, orders, sessions, users } from '@/db/schema';
import { authenticate, getCurrentUser } from '@/lib/auth';
import { resetDb, createUser } from './helpers';

/**
 * Contexte Next minimal : `headers()` (IP) et `cookies()` (session).
 * Le magasin de cookies est partagé entre appels, comme dans un navigateur.
 */
const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '127.0.0.1', 'user-agent': 'vitest' }),
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
}));

/**
 * `redirect()` de Next.js ne « rend » jamais la main : il lève une exception
 * que le routeur intercepte. On reproduit ce comportement pour pouvoir vérifier
 * la destination finale.
 */
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), { digest: `NEXT_REDIRECT;replace;${url};307;` });
  },
}));

const { deleteAccountAction } = await import('@/app/actions/auth');

const PASSWORD = 'MotDePasseTest123!';

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

async function signInAs(role: 'CUSTOMER' | 'OWNER' | 'ADMIN' = 'CUSTOMER') {
  const email = `suppression-${role.toLowerCase()}@medi.test`;
  const user = await createUser({ email, role });
  await authenticate(email, PASSWORD);
  return user;
}

async function userExists(id: string) {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  return rows.length > 0;
}

beforeEach(async () => {
  cookieJar.clear();
  await resetDb();
});

describe('Suppression de compte en libre-service', () => {
  it('efface le compte, les adresses et les sessions du client', async () => {
    const user = await signInAs();
    await db.insert(addresses).values({
      id: 'adr_suppression',
      userId: user.id,
      recipientName: 'Awa Koné',
      phone: '0701020304',
      city: 'Daloa',
      addressLine: 'Quartier Commerce, près du marché',
      isDefault: true,
    });

    await expect(
      deleteAccountAction({}, form({ confirmation: 'supprimer', password: PASSWORD })),
    ).rejects.toThrow('NEXT_REDIRECT:/supprimer-mon-compte/confirmation');

    expect(await userExists(user.id)).toBe(false);
    const remainingAddresses = await db.select().from(addresses).where(eq(addresses.userId, user.id));
    expect(remainingAddresses).toEqual([]);
    const remainingSessions = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(remainingSessions).toEqual([]);
    // La session du navigateur est fermée : plus personne n'est connecté.
    expect(await getCurrentUser()).toBeNull();
  });

  it('garde les commandes passées, détachées du compte', async () => {
    const user = await signInAs();
    await db.insert(orders).values({
      id: 'ord_suppression',
      number: 'MED-2026-09999',
      userId: user.id,
      customerFirstName: 'Awa',
      customerLastName: 'Koné',
      phone: '0701020304',
      deliveryMethod: 'PICKUP',
      city: 'Daloa',
      subtotal: '15000',
      total: '15000',
      paymentMethod: 'CASH_IN_STORE',
      accessToken: 'jeton-suppression-test',
    });

    await expect(
      deleteAccountAction({}, form({ confirmation: 'SUPPRIMER', password: PASSWORD })),
    ).rejects.toThrow('NEXT_REDIRECT');

    const rows = await db.select().from(orders).where(eq(orders.id, 'ord_suppression'));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBeNull();
    expect(rows[0]!.customerLastName).toBe('Koné');
  });

  it('écrit une ligne de journal, sans conserver l’identité du client', async () => {
    const user = await signInAs();
    await expect(
      deleteAccountAction({}, form({ confirmation: 'SUPPRIMER', password: PASSWORD })),
    ).rejects.toThrow('NEXT_REDIRECT');

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'account.deleted'));
    expect(logs).toHaveLength(1);
    expect(logs[0]!.actorEmail).toBeNull();
    expect(logs[0]!.userId).toBeNull();
    expect(JSON.stringify(logs[0]!.metadata)).not.toContain('suppression-customer@medi.test');
    expect(JSON.stringify(logs[0]!.metadata)).toContain(user.id);
  });

  it('refuse un mot de confirmation absent ou différent', async () => {
    const user = await signInAs();
    const state = await deleteAccountAction({}, form({ confirmation: 'oui', password: PASSWORD }));
    expect(state.fieldErrors?.confirmation).toContain('SUPPRIMER');
    expect(await userExists(user.id)).toBe(true);
    expect(await getCurrentUser()).not.toBeNull();

    const empty = await deleteAccountAction({}, form({ password: PASSWORD }));
    expect(empty.fieldErrors?.confirmation).toBeTruthy();
    expect(await userExists(user.id)).toBe(true);
  });

  it('refuse un mot de passe incorrect', async () => {
    const user = await signInAs();
    const state = await deleteAccountAction({}, form({ confirmation: 'SUPPRIMER', password: 'mauvais-mot-de-passe' }));
    expect(state.fieldErrors?.password).toBe('Mot de passe incorrect.');
    expect(await userExists(user.id)).toBe(true);
  });

  it('protège les comptes du personnel', async () => {
    for (const role of ['OWNER', 'ADMIN'] as const) {
      cookieJar.clear();
      const staff = await signInAs(role);
      const state = await deleteAccountAction({}, form({ confirmation: 'SUPPRIMER', password: PASSWORD }));
      expect(state.error, role).toContain('comptes du personnel');
      expect(await userExists(staff.id), role).toBe(true);
    }
  });

  it('refuse un visiteur non connecté', async () => {
    const state = await deleteAccountAction({}, form({ confirmation: 'SUPPRIMER', password: PASSWORD }));
    expect(state.error).toBe('Vous devez être connecté.');
  });
});
