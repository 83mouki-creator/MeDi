import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { adminActivationStatus, createFirstOwner, passwordProblem } from '@/lib/admin-activation';
import { resetDb } from './helpers';

const VALID_TOKEN = 'jeton-activation-de-test-0123456789';

const form = (overrides: Record<string, string> = {}) => ({
  token: VALID_TOKEN,
  name: 'MeDi',
  email: 'direction@exemple.ci',
  password: 'MotDePasse-2026',
  passwordConfirm: 'MotDePasse-2026',
  ...overrides,
});

beforeEach(async () => {
  await resetDb();
  process.env.ADMIN_SETUP_TOKEN = VALID_TOKEN;
});

afterEach(() => {
  delete process.env.ADMIN_SETUP_TOKEN;
});

describe('Activation du premier compte propriétaire', () => {
  it('refuse tout accès quand aucune activation n’est configurée', async () => {
    delete process.env.ADMIN_SETUP_TOKEN;

    expect(await adminActivationStatus(VALID_TOKEN)).toBe('refuse');
    const result = await createFirstOwner(form());
    expect(result.ok).toBe(false);
    expect(await db.select({ id: users.id }).from(users)).toHaveLength(0);
  });

  it('refuse un jeton incorrect ou absent', async () => {
    expect(await adminActivationStatus('mauvais-jeton')).toBe('refuse');
    expect(await adminActivationStatus('')).toBe('refuse');
    expect(await adminActivationStatus(undefined)).toBe('refuse');
    expect(await adminActivationStatus(null)).toBe('refuse');

    const result = await createFirstOwner(form({ token: 'mauvais-jeton' }));
    expect(result.ok).toBe(false);
    expect(await db.select({ id: users.id }).from(users)).toHaveLength(0);
  });

  it('accepte le bon jeton tant qu’aucun administrateur n’existe', async () => {
    expect(await adminActivationStatus(VALID_TOKEN)).toBe('ready');
  });

  it('crée un compte OWNER actif avec le nom affiché demandé', async () => {
    const result = await createFirstOwner(form());
    expect(result.ok).toBe(true);

    const rows = await db.select().from(users).where(eq(users.email, 'direction@exemple.ci'));
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe('OWNER');
    expect(rows[0].firstName).toBe('MeDi');
    expect(rows[0].isActive).toBe(true);
    // Mot de passe haché (scrypt), jamais stocké en clair.
    expect(rows[0].passwordHash).toMatch(/^scrypt\$/);
    expect(rows[0].passwordHash).not.toContain('MotDePasse-2026');
  });

  it('ferme l’activation dès que le premier administrateur existe', async () => {
    expect((await createFirstOwner(form())).ok).toBe(true);

    expect(await adminActivationStatus(VALID_TOKEN)).toBe('initialise');
    const second = await createFirstOwner(form({ email: 'autre@exemple.ci' }));
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toContain('existe déjà');

    expect(await db.select({ id: users.id }).from(users).where(eq(users.role, 'OWNER'))).toHaveLength(1);
  });

  it('refuse un mot de passe trop faible ou non confirmé', async () => {
    const short = await createFirstOwner(form({ password: 'court1', passwordConfirm: 'court1' }));
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.fieldErrors?.password).toBeDefined();

    const mismatch = await createFirstOwner(form({ passwordConfirm: 'Autre-MotDePasse-2026' }));
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.fieldErrors?.passwordConfirm).toBeDefined();

    expect(await db.select({ id: users.id }).from(users)).toHaveLength(0);
  });

  it('refuse une adresse e-mail invalide', async () => {
    const result = await createFirstOwner(form({ email: 'pas-un-email' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.email).toBeDefined();
  });

  it('signale une adresse déjà utilisée par un compte client', async () => {
    await db.insert(users).values({
      id: 'usr_client_test',
      email: 'direction@exemple.ci',
      passwordHash: 'scrypt$16384$8$1$c2Vs$c2Vs',
      firstName: 'Client',
      lastName: 'Test',
      role: 'CUSTOMER',
    });

    const result = await createFirstOwner(form());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.email).toBeDefined();

    const owners = await db.select({ id: users.id }).from(users).where(eq(users.role, 'OWNER'));
    expect(owners).toHaveLength(0);
  });

  it('applique la règle de robustesse du mot de passe', () => {
    expect(passwordProblem('court')).not.toBeNull();
    expect(passwordProblem('motdepassesanschiffre')).not.toBeNull();
    expect(passwordProblem('12345678901234')).not.toBeNull();
    expect(passwordProblem('MotDePasse-2026')).toBeNull();
  });
});
