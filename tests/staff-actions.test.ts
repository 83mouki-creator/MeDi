import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { authenticate, verifyPassword } from '@/lib/auth';
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

const { createStaffAction, activateStaffAccessAction, regenerateStaffCodeAction, issuePasswordResetLinkAction } =
  await import('@/app/actions/admin-staff');

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(async () => {
  cookieJar.clear();
  await resetDb();
});

async function signInAsOwner() {
  const owner = await createUser({ email: 'patron@medi.test', role: 'OWNER' });
  await authenticate('patron@medi.test', 'MotDePasseTest123!');
  return owner;
}

describe('création d’un agent par l’administrateur', () => {
  it('refuse un visiteur non connecté', async () => {
    const state = await createStaffAction({}, form({ firstName: 'Awa', lastName: 'Koné', phone: '07 08 90 48 91', staffTask: 'Caisse', role: 'CASHIER' }));
    expect(state.error).toMatch(/administrateurs/i);
    expect(state.invitation).toBeUndefined();
  });

  it('crée un agent, génère un code unique et un lien WhatsApp', async () => {
    await signInAsOwner();
    const state = await createStaffAction(
      {},
      form({
        firstName: 'Awa',
        lastName: 'Koné',
        phone: '07 08 90 48 91',
        staffTask: 'Caisse du matin',
        role: 'CASHIER',
      }),
    );

    expect(state.error).toBeUndefined();
    expect(state.invitation?.code).toMatch(/^MEDI(-[A-HJ-NP-Z2-9]{4}){3}$/);
    expect(state.invitation?.whatsappLink).toContain('https://wa.me/2250708904891');
    expect(state.invitation?.roleLabel).toBe('Caissier');

    const rows = await db.select().from(users).where(eq(users.phoneNormalized, '+2250708904891'));
    const agent = rows[0]!;
    expect(agent.firstName).toBe('Awa');
    expect(agent.staffTask).toBe('Caisse du matin');
    expect(agent.role).toBe('CASHIER');
    expect(agent.createdByUserId).not.toBeNull();
    // Le code n'est jamais stocké en clair.
    expect(agent.staffCodeHash).not.toBe(state.invitation!.code);
    expect(agent.staffCodeHash).toMatch(/^[0-9a-f]{64}$/);
    // L'agent n'a pas de mot de passe utilisable avant activation.
    expect(await verifyPassword('', agent.passwordHash)).toBe(false);
  });

  it('refuse un numéro ivoirien mal formé et un doublon', async () => {
    await signInAsOwner();
    const bad = await createStaffAction(
      {},
      form({ firstName: 'Awa', lastName: 'Koné', phone: '06 12', staffTask: 'Caisse', role: 'CASHIER' }),
    );
    expect(bad.fieldErrors?.phone).toBeTruthy();

    const ok = form({ firstName: 'Awa', lastName: 'Koné', phone: '0708904891', staffTask: 'Caisse', role: 'CASHIER' });
    expect((await createStaffAction({}, ok)).invitation).toBeTruthy();
    const duplicate = await createStaffAction(
      {},
      form({ firstName: 'Ali', lastName: 'Traoré', phone: '+225 07 08 90 48 91', staffTask: 'Stock', role: 'WAREHOUSE_KEEPER' }),
    );
    expect(duplicate.fieldErrors?.phone).toMatch(/déjà/);
  });

  it('interdit à un administrateur de créer un compte de son niveau ou supérieur', async () => {
    await createUser({ email: 'chef@medi.test', role: 'ADMIN' });
    await authenticate('chef@medi.test', 'MotDePasseTest123!');

    const admin = await createStaffAction(
      {},
      form({ firstName: 'Ali', lastName: 'Traoré', phone: '05 11 22 33 44', staffTask: 'Direction', role: 'ADMIN' }),
    );
    expect(admin.fieldErrors?.role).toBeTruthy();

    const agent = await createStaffAction(
      {},
      form({ firstName: 'Ali', lastName: 'Traoré', phone: '05 11 22 33 44', staffTask: 'Magasin', role: 'WAREHOUSE_KEEPER' }),
    );
    expect(agent.invitation).toBeTruthy();
  });
});

describe('activation par l’agent', () => {
  async function invite(role = 'CASHIER') {
    await signInAsOwner();
    const state = await createStaffAction(
      {},
      form({ firstName: 'Awa', lastName: 'Koné', phone: '07 08 90 48 91', staffTask: 'Caisse', role }),
    );
    cookieJar.clear(); // l'agent n'est pas connecté
    return state.invitation!;
  }

  it('active le compte avec code + nom + téléphone, puis connecte l’agent', async () => {
    const invitation = await invite();

    let redirectDigest: string | undefined;
    try {
      await activateStaffAccessAction(
        {},
        form({
          code: invitation.code.toLowerCase(),
          firstName: 'Awa',
          lastName: 'Kone',
          phone: '07 08 90 48 91',
          password: 'Caisse2026ok',
          passwordConfirm: 'Caisse2026ok',
        }),
      );
    } catch (error) {
      redirectDigest = (error as { digest?: string }).digest;
    }
    expect(redirectDigest).toContain('/admin/paiements');

    const agent = (await db.select().from(users).where(eq(users.id, invitation.userId)))[0]!;
    expect(agent.staffCodeHash).toBeNull();
    expect(agent.staffCodeUsedAt).not.toBeNull();
    expect(agent.lastLoginAt).not.toBeNull();

    // Connexion ensuite avec le téléphone.
    cookieJar.clear();
    const session = await authenticate('0708904891', 'Caisse2026ok');
    expect(session.role).toBe('CASHIER');
  });

  it('refuse un code déjà utilisé', async () => {
    const invitation = await invite();
    const payload = {
      code: invitation.code,
      firstName: 'Awa',
      lastName: 'Koné',
      phone: '07 08 90 48 91',
      password: 'Caisse2026ok',
      passwordConfirm: 'Caisse2026ok',
    };
    await expect(activateStaffAccessAction({}, form(payload))).rejects.toMatchObject({ digest: expect.stringContaining('/') });
    const second = await activateStaffAccessAction({}, form({ ...payload, password: 'Autre2026ok', passwordConfirm: 'Autre2026ok' }));
    expect(second.error).toMatch(/incorrect|utilisé/i);
  });

  it('refuse un nom, un téléphone ou un mot de passe qui ne correspondent pas', async () => {
    const invitation = await invite();
    const base = {
      code: invitation.code,
      firstName: 'Awa',
      lastName: 'Koné',
      phone: '07 08 90 48 91',
      password: 'Caisse2026ok',
      passwordConfirm: 'Caisse2026ok',
    };

    const wrongName = await activateStaffAccessAction({}, form({ ...base, lastName: 'Traoré' }));
    expect(wrongName.error).toBeTruthy();

    const wrongPhone = await activateStaffAccessAction({}, form({ ...base, phone: '05 00 00 00 00' }));
    expect(wrongPhone.error).toBeTruthy();

    const weak = await activateStaffAccessAction({}, form({ ...base, password: 'court1', passwordConfirm: 'court1' }));
    expect(weak.fieldErrors?.password).toBeTruthy();

    const mismatch = await activateStaffAccessAction({}, form({ ...base, passwordConfirm: 'Autre2026ok' }));
    expect(mismatch.fieldErrors?.password).toMatch(/correspondent/);

    // Aucune de ces tentatives n'a consommé le code.
    const agent = (await db.select().from(users).where(eq(users.id, invitation.userId)))[0]!;
    expect(agent.staffCodeHash).not.toBeNull();
  });

  it('refuse un compte désactivé et un code inconnu', async () => {
    const invitation = await invite();
    await db.update(users).set({ isActive: false }).where(eq(users.id, invitation.userId));
    const disabled = await activateStaffAccessAction({}, form({ code: invitation.code, firstName: 'Awa', lastName: 'Koné', phone: '07 08 90 48 91', password: 'Caisse2026ok', passwordConfirm: 'Caisse2026ok' }));
    expect(disabled.error).toMatch(/désactivé/i);

    const unknown = await activateStaffAccessAction({}, form({ code: 'MEDI-2222-3333-4444', firstName: 'Awa', lastName: 'Koné', phone: '07 08 90 48 91', password: 'Caisse2026ok', passwordConfirm: 'Caisse2026ok' }));
    expect(unknown.error).toBeTruthy();
  });
});

describe('codes et liens émis par l’administrateur', () => {
  it('régénère un code pour un agent subalterne et invalide l’ancien', async () => {
    await signInAsOwner();
    const first = await createStaffAction({}, form({ firstName: 'Awa', lastName: 'Koné', phone: '07 08 90 48 91', staffTask: 'Caisse', role: 'CASHIER' }));
    const second = await regenerateStaffCodeAction({}, form({ id: first.invitation!.userId }));
    expect(second.invitation?.code).toBeTruthy();
    expect(second.invitation?.code).not.toBe(first.invitation!.code);
  });

  it('refuse à un caissier de régénérer un code', async () => {
    const cashier = await createUser({ role: 'ORDER_MANAGER' });
    await db.update(users).set({ role: 'CASHIER' }).where(eq(users.id, cashier.id));
    await authenticate('patron@medi.test', 'MotDePasseTest123!').catch(() => undefined);
    const state = await regenerateStaffCodeAction({}, form({ id: cashier.id }));
    expect(state.error).toMatch(/administrateurs/i);
  });

  it('crée un lien de réinitialisation à usage unique', async () => {
    await signInAsOwner();
    const target = await createUser({ role: 'CUSTOMER' });
    const state = await issuePasswordResetLinkAction({}, form({ id: target.id }));
    expect(state.resetLink?.url).toContain('/reinitialiser-mot-de-passe?token=');
    expect(state.resetLink?.emailDelivered).toBe(false); // aucun fournisseur e-mail configuré en test
  });
});
