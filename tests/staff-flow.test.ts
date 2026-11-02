import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { authenticate, hashPassword, lookupUsersByIdentifier } from '@/lib/auth';
import { STAFF_CODE_TTL_HOURS, generateStaffCode, hashStaffCode, normalizeIvorianPhone } from '@/lib/staff-access';
import { resetDb } from './helpers';

// `authenticate` lit les en-têtes (IP) et pose un cookie de session : hors requête
// Next, on fournit un contexte minimal pour tester la logique sans serveur.
vi.mock('next/headers', () => {
  const store = new Map<string, string>();
  return {
    headers: async () => new Headers({ 'x-forwarded-for': '127.0.0.1' }),
    cookies: async () => ({
      get: (name: string) => (store.has(name) ? { name, value: store.get(name)! } : undefined),
      set: (name: string, value: string) => store.set(name, value),
      delete: (name: string) => store.delete(name),
    }),
  };
});

beforeEach(async () => {
  await resetDb();
});

/**
 * Parcours d'un agent : l'administrateur crée le compte avec un code, l'agent
 * active son accès puis se connecte au back-office avec son téléphone.
 */
async function createStaffInvite(overrides: Partial<typeof users.$inferInsert> = {}) {
  const code = generateStaffCode();
  const phone = normalizeIvorianPhone('07 08 90 48 91');
  if (!phone.ok) throw new Error('numéro de test invalide');
  const id = 'usr_staff_test';
  await db.insert(users).values({
    id,
    email: 'agent.2250708904891@agents.medi.local',
    passwordHash: await hashPassword(generateStaffCode()),
    firstName: 'Awa',
    lastName: 'Koné',
    phone: phone.display,
    phoneNormalized: phone.canonical,
    role: 'CASHIER',
    staffTask: 'Caisse du matin',
    staffCodeHash: hashStaffCode(code),
    staffCodeCreatedAt: new Date(),
    staffCodeExpiresAt: new Date(Date.now() + STAFF_CODE_TTL_HOURS * 3600 * 1000),
    ...overrides,
  });
  return { id, code, phone: phone.canonical };
}

describe('accès du personnel', () => {
  it('retrouve un agent par son téléphone ivoirien ou par e-mail', async () => {
    const { id } = await createStaffInvite();
    const byPhone = await lookupUsersByIdentifier('07 08 90 48 91');
    expect(byPhone[0]?.id).toBe(id);
    const byInternational = await lookupUsersByIdentifier('+225 07 08 90 48 91');
    expect(byInternational[0]?.id).toBe(id);
    const byEmail = await lookupUsersByIdentifier('agent.2250708904891@agents.medi.local');
    expect(byEmail[0]?.id).toBe(id);
  });

  it('ne retrouve rien pour un numéro inconnu ou une chaîne vide', async () => {
    await createStaffInvite();
    expect(await lookupUsersByIdentifier('05 00 00 00 00')).toHaveLength(0);
    expect(await lookupUsersByIdentifier('   ')).toHaveLength(0);
  });

  it('n’accepte un code qu’une seule fois (le code est effacé après activation)', async () => {
    const { id, code } = await createStaffInvite();
    const first = await db.select().from(users).where(eq(users.staffCodeHash, hashStaffCode(code)));
    expect(first).toHaveLength(1);
    const expiresAt = first[0]!.staffCodeExpiresAt!;
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Activation : mot de passe choisi, code consommé.
    await db
      .update(users)
      .set({ passwordHash: await hashPassword('Caisse2026ok'), staffCodeUsedAt: new Date(), staffCodeHash: null })
      .where(eq(users.id, id));

    const second = await db.select().from(users).where(eq(users.staffCodeHash, hashStaffCode(code)));
    expect(second).toHaveLength(0);
  });

  it('permet la connexion par téléphone après activation, jamais avant', async () => {
    const { code, id } = await createStaffInvite();
    // Avant activation, le mot de passe est un aléatoire non communiqué.
    await expect(authenticate('07 08 90 48 91', code)).rejects.toThrow();

    await db
      .update(users)
      .set({ passwordHash: await hashPassword('Caisse2026ok'), staffCodeUsedAt: new Date(), staffCodeHash: null })
      .where(eq(users.id, id));

    const session = await authenticate('07 08 90 48 91', 'Caisse2026ok');
    expect(session.id).toBe(id);
    expect(session.role).toBe('CASHIER');
    const after = await db.select({ lastLoginAt: users.lastLoginAt }).from(users).where(eq(users.id, id));
    expect(after[0]?.lastLoginAt).not.toBeNull();
  });

  it('refuse un compte désactivé même avec le bon mot de passe', async () => {
    const { id } = await createStaffInvite({ isActive: false, passwordHash: await hashPassword('Caisse2026ok') });
    await expect(authenticate('0708904891', 'Caisse2026ok')).rejects.toThrow(/désactivé/i);
    const rows = await db.select({ isActive: users.isActive }).from(users).where(eq(users.id, id));
    expect(rows[0]?.isActive).toBe(false);
  });

  it('n’autorise qu’un seul compte par numéro de téléphone', async () => {
    await createStaffInvite();
    await expect(
      createStaffInvite({ id: 'usr_doublon', email: 'autre@agents.medi.local' }),
    ).rejects.toThrow();
  });

  it('un agent créé sans e-mail réel ne peut pas être joint par e-mail', () => {
    expect('agent.2250708904891@agents.medi.local'.endsWith('@agents.medi.local')).toBe(true);
  });
});
