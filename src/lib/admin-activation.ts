/**
 * Création du tout premier compte propriétaire (OWNER).
 *
 * Aucun compte administrateur n'est livré avec le site, et aucun mot de passe
 * par défaut n'existe. La création passe par un lien d'activation :
 *
 *  - il faut le jeton d'activation (variable d'environnement ADMIN_SETUP_TOKEN) ;
 *  - il ne fonctionne que s'il n'existe encore aucun compte OWNER ni ADMIN ;
 *  - le mot de passe est choisi par la personne qui active le compte et n'est
 *    jamais transmis ni journalisé.
 *
 * Dès que le premier administrateur existe, la page d'activation se ferme d'elle-même.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { hashPassword } from './auth';
import { newId } from './utils';
import { env } from './env';

/** Valeur arbitraire et stable : verrou pour éviter deux activations simultanées. */
const ACTIVATION_LOCK_KEY = 732196401;

const ADMIN_ROLES = ['OWNER', 'ADMIN'] as const;

export type ActivationStatus =
  /** Jeton valide et aucun administrateur en base : l'activation est possible. */
  | 'ready'
  /** Jeton valide mais un administrateur existe déjà : page fermée. */
  | 'initialise'
  /** Jeton absent, désactivé ou incorrect : la page n'existe pas. */
  | 'refuse';

function sameToken(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

async function adminExists(): Promise<boolean> {
  const rows = await db.select({ id: users.id }).from(users).where(inArray(users.role, ADMIN_ROLES)).limit(1);
  return rows.length > 0;
}

export async function adminActivationStatus(token: string | null | undefined): Promise<ActivationStatus> {
  const expected = env.adminSetupToken;
  if (!expected || !token || !sameToken(token, expected)) return 'refuse';
  return (await adminExists()) ? 'initialise' : 'ready';
}

export type OwnerCreationInput = {
  token: string;
  /** Nom affiché dans l'interface (ex. « MeDi »). */
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

export type OwnerCreationResult =
  | { ok: true; userId: string; email: string; name: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

/** Validation du mot de passe : 10 caractères minimum, une lettre et un chiffre. */
export function passwordProblem(password: string): string | null {
  if (password.length < 10) return '10 caractères minimum.';
  if (!/[A-Za-z]/.test(password)) return 'Ajoutez au moins une lettre.';
  if (!/\d/.test(password)) return 'Ajoutez au moins un chiffre.';
  return null;
}

class EmailTakenError extends Error {}

export async function createFirstOwner(input: OwnerCreationInput): Promise<OwnerCreationResult> {
  const status = await adminActivationStatus(input.token);
  if (status === 'refuse') return { ok: false, error: 'Ce lien d’activation n’est pas valide.' };
  if (status === 'initialise') {
    return { ok: false, error: 'Un compte administrateur existe déjà : connectez-vous normalement.' };
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const fieldErrors: Record<string, string> = {};

  if (name.length < 2) fieldErrors.name = 'Indiquez le nom à afficher (2 caractères minimum).';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fieldErrors.email = 'Adresse e-mail invalide.';

  const problem = passwordProblem(input.password);
  if (problem) fieldErrors.password = problem;
  if (input.password !== input.passwordConfirm) fieldErrors.passwordConfirm = 'Les deux mots de passe ne correspondent pas.';

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const passwordHash = await hashPassword(input.password);

  try {
    const userId = await db.transaction(async (tx) => {
      // Empêche deux créations simultanées du premier administrateur.
      await tx.execute(sql`select pg_advisory_xact_lock(${ACTIVATION_LOCK_KEY})`);

      const already = await tx.select({ id: users.id }).from(users).where(inArray(users.role, ADMIN_ROLES)).limit(1);
      if (already.length > 0) return null;

      const taken = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (taken.length > 0) throw new EmailTakenError();

      const id = newId('usr_');
      await tx.insert(users).values({
        id,
        email,
        passwordHash,
        firstName: name,
        lastName: '',
        role: 'OWNER',
        isActive: true,
      });
      return id;
    });

    if (!userId) return { ok: false, error: 'Un compte administrateur existe déjà : connectez-vous normalement.' };
    return { ok: true, userId, email, name };
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return {
        ok: false,
        fieldErrors: { email: 'Un compte client utilise déjà cette adresse. Choisissez une autre adresse.' },
      };
    }
    throw error;
  }
}
