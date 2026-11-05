import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { sessions, users } from '@/db/schema';
import { authenticate, getCurrentUser, verifyPassword } from '@/lib/auth';
import { resetDb } from './helpers';

/**
 * Inscription d'un client depuis la vitrine (`/inscription`).
 *
 * Ces tests décrivent la promesse faite au client : n'importe qui peut ouvrir un
 * compte en dix secondes, et ce compte ne peut **jamais** donner accès au
 * back-office — quel que soit le contenu du formulaire envoyé.
 */

const cookieJar = new Map<string, string>();
/** Une adresse IP différente par test : le limiteur d'inscriptions est par IP. */
let ip = '10.0.0.1';

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': ip, 'user-agent': 'vitest' }),
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), { digest: `NEXT_REDIRECT;replace;${url};307;` });
  },
}));

const { registerAction } = await import('@/app/actions/auth');

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const VALID = {
  firstName: 'Awa',
  lastName: 'Koné',
  email: 'awa.kone@example.ci',
  phone: '0701020304',
  password: 'MotDePasse2026',
  acceptTerms: 'on',
};

let counter = 0;
beforeEach(async () => {
  cookieJar.clear();
  await resetDb();
  counter += 1;
  ip = `10.0.${Math.floor(counter / 250)}.${counter % 250}`;
});

async function accountOf(email: string) {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

describe('Inscription d’un client', () => {
  it('crée le compte, ouvre la session et redirige vers l’espace client', async () => {
    await expect(registerAction({}, form(VALID))).rejects.toThrow('NEXT_REDIRECT:/compte');

    const compte = await accountOf('awa.kone@example.ci');
    expect(compte).not.toBeNull();
    expect(compte!.role).toBe('CUSTOMER');
    expect(compte!.isActive).toBe(true);
    expect(compte!.firstName).toBe('Awa');
    expect(compte!.lastName).toBe('Koné');
    // Le mot de passe n'est jamais stocké en clair.
    expect(compte!.passwordHash).not.toContain('MotDePasse2026');
    expect(await verifyPassword('MotDePasse2026', compte!.passwordHash)).toBe(true);

    // La session est ouverte : le client est tout de suite connecté.
    const current = await getCurrentUser();
    expect(current?.email).toBe('awa.kone@example.ci');
    const ouvertes = await db.select().from(sessions).where(eq(sessions.userId, compte!.id));
    expect(ouvertes).toHaveLength(1);
  });

  it('enregistre le numéro ivoirien sous forme canonique (+225…)', async () => {
    await expect(registerAction({}, form({ ...VALID, phone: '07 01 02 03 04' }))).rejects.toThrow('NEXT_REDIRECT');
    const compte = await accountOf('awa.kone@example.ci');
    expect(compte!.phoneNormalized).toBe('+2250701020304');
    // Ce numéro permet ensuite de se connecter (agents et clients).
    cookieJar.clear();
    const connected = await authenticate('0701020304', 'MotDePasse2026');
    expect(connected.id).toBe(compte!.id);
  });

  it('ne laisse jamais choisir un rôle interne, même en forçant le formulaire', async () => {
    await expect(
      registerAction({}, form({ ...VALID, role: 'OWNER', staffTask: 'Caisse' })),
    ).rejects.toThrow('NEXT_REDIRECT');

    const compte = await accountOf('awa.kone@example.ci');
    expect(compte!.role).toBe('CUSTOMER');
    expect(compte!.staffTask).toBeNull();
  });

  it('refuse un compte existant avec la même adresse', async () => {
    await expect(registerAction({}, form(VALID))).rejects.toThrow('NEXT_REDIRECT');
    cookieJar.clear();

    const state = await registerAction({}, form({ ...VALID, phone: '0705060708' }));
    expect(state.fieldErrors?.email).toBe('Un compte existe déjà avec cette adresse.');
    const tous = await db.select().from(users).where(eq(users.email, 'awa.kone@example.ci'));
    expect(tous).toHaveLength(1);
  });

  it('refuse un numéro déjà rattaché à un autre compte', async () => {
    await expect(registerAction({}, form(VALID))).rejects.toThrow('NEXT_REDIRECT');
    cookieJar.clear();

    const state = await registerAction({}, form({ ...VALID, email: 'autre@example.ci' }));
    expect(state.fieldErrors?.phone).toBe('Ce numéro est déjà rattaché à un compte.');
  });

  it('refuse un mot de passe trop faible', async () => {
    const state = await registerAction({}, form({ ...VALID, password: 'court1' }));
    expect(state.fieldErrors?.password).toContain('10 caractères');
    expect(await accountOf('awa.kone@example.ci')).toBeNull();

    const sansChiffre = await registerAction({}, form({ ...VALID, password: 'motdepasselettres' }));
    expect(sansChiffre.fieldErrors?.password).toContain('au moins une lettre et un chiffre');
  });

  it('exige l’acceptation des conditions de vente', async () => {
    const state = await registerAction({}, form({ ...VALID, acceptTerms: '' }));
    expect(state.fieldErrors?.acceptTerms).toContain('conditions de vente');
    expect(await accountOf('awa.kone@example.ci')).toBeNull();
  });

  it('refuse une adresse e-mail invalide', async () => {
    const state = await registerAction({}, form({ ...VALID, email: 'awa.kone' }));
    expect(state.fieldErrors?.email).toBe('Adresse e-mail invalide');
  });

  it('range les adresses en minuscules pour éviter les doublons', async () => {
    await expect(
      registerAction({}, form({ ...VALID, email: 'Awa.Kone@Example.CI' })),
    ).rejects.toThrow('NEXT_REDIRECT');
    cookieJar.clear();

    expect(await accountOf('awa.kone@example.ci')).not.toBeNull();
    const state = await registerAction({}, form({ ...VALID, phone: '0705060708' }));
    expect(state.fieldErrors?.email).toBeTruthy();
  });

  it('reste accessible depuis le pied de page, même sans compte', () => {
    // Un client qui n'a jamais entendu parler du site doit trouver le lien.
    const footer = readFileSync('src/components/site-footer.tsx', 'utf8');
    expect(footer).toContain('href="/inscription"');
    // Et le lien disparaît une fois connecté (pas de doublon d'information).
    expect(footer).toContain('user ? null :');
  });

  it('bloque les inscriptions en série depuis une même connexion', async () => {
    // 5 inscriptions autorisées par IP et par tranche de 10 minutes.
    for (let i = 0; i < 5; i += 1) {
      await expect(
        registerAction({}, form({ ...VALID, email: `client${i}@example.ci`, phone: `070102030${i}` })),
      ).rejects.toThrow('NEXT_REDIRECT');
      cookieJar.clear();
    }
    const state = await registerAction({}, form({ ...VALID, email: 'client6@example.ci', phone: '0701020309' }));
    expect(state.error).toContain('Trop de créations de compte');
  });
});
