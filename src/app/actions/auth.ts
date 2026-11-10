'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, passwordResetTokens, addresses } from '@/db/schema';
import {
  authenticate,
  AuthError,
  clientIpFrom,
  destroySession,
  getCurrentUser,
  hashPassword,
  lookupUsersByIdentifier,
  verifyPassword,
} from '@/lib/auth';
import { registerSchema, fieldErrors } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';
import { roleHome } from '@/lib/roles';
import { newId, slugify } from '@/lib/utils';
import { createHash, randomBytes } from 'node:crypto';
import { normalizeIvorianPhone } from '@/lib/staff-access';
import { sendEmail, emailStatus } from '@/lib/email';
import { queueEmail } from '@/lib/email-queue';
import { passwordResetEmail, welcomeEmail } from '@/lib/email-templates';
import { storeEmailInfo } from '@/lib/email-store';
import { getStoreSettings } from '@/lib/settings';
import { env } from '@/lib/env';

export type AuthState = { error?: string; fieldErrors?: Record<string, string>; success?: string };

/**
 * Connexion : e-mail **ou** numéro ivoirien.
 *
 * Un agent créé par l'administrateur n'a pas forcément d'adresse e-mail : son
 * numéro de téléphone fait office d'identifiant.
 */
export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const identifier = String(formData.get('identifier') ?? formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  const fieldErrorsMap: Record<string, string> = {};
  if (!identifier) fieldErrorsMap.identifier = 'E-mail ou numéro de téléphone requis';
  if (!password) fieldErrorsMap.password = 'Mot de passe requis';
  if (Object.keys(fieldErrorsMap).length > 0) return { fieldErrors: fieldErrorsMap };

  const isEmail = identifier.includes('@');
  if (isEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identifier)) {
    return { fieldErrors: { identifier: 'Adresse e-mail invalide' } };
  }
  if (!isEmail && !normalizeIvorianPhone(identifier).ok && identifier.replace(/\D/g, '').length < 8) {
    return { fieldErrors: { identifier: 'Numéro ivoirien invalide (ex. 05 44 01 41 82)' } };
  }

  const h = await headers();
  const ip = clientIpFrom(h);
  const limit = rateLimit(`login:${ip ?? 'local'}:${identifier.toLowerCase()}`, 10, 300);
  if (!limit.allowed) return { error: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' };

  const redirectTo = String(formData.get('redirectTo') ?? '');

  try {
    const user = await authenticate(identifier, password);
    await audit(
      { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone, role: user.role, staffTask: user.staffTask },
      { action: 'auth.login', entity: 'user', entityId: user.id, ip },
    );
    const fallback = user.role === 'CUSTOMER' ? '/compte' : roleHome(user.role);
    const target = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : fallback;
    redirect(target);
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message };
    if (typeof error === 'object' && error !== null && 'digest' in error) throw error;
    console.error('[auth] connexion', error);
    return { error: 'Connexion impossible pour le moment.' };
  }
}

/**
 * Inscription **client** uniquement (boutique).
 *
 * Aucun compte interne ne se crée ici : le rôle est forcé à `CUSTOMER` et les
 * comptes du personnel naissent exclusivement dans /admin/utilisateurs.
 */
export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    password: String(formData.get('password') ?? ''),
    acceptTerms: formData.get('acceptTerms') ?? '',
  });

  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const h = await headers();
  const ip = clientIpFrom(h);
  const limit = rateLimit(`register:${ip ?? 'local'}`, 5, 600);
  if (!limit.allowed) return { error: 'Trop de créations de compte depuis cette connexion. Réessayez plus tard.' };

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (existing.length > 0) {
    return { fieldErrors: { email: 'Un compte existe déjà avec cette adresse.' } };
  }

  const phone = normalizeIvorianPhone(parsed.data.phone);
  let phoneNormalized: string | null = null;
  if (phone.ok) {
    const takenPhone = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneNormalized, phone.canonical))
      .limit(1);
    if (takenPhone[0]) return { fieldErrors: { phone: 'Ce numéro est déjà rattaché à un compte.' } };
    phoneNormalized = phone.canonical;
  }

  const id = newId('usr_');
  await db.insert(users).values({
    id,
    email: parsed.data.email,
    passwordHash: await hashPassword(parsed.data.password),
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    phone: phone.ok ? phone.display : parsed.data.phone,
    phoneNormalized,
    // Rôle imposé : impossible de s'octroyer un accès au back-office.
    role: 'CUSTOMER',
  });

  await authenticate(parsed.data.email, parsed.data.password);
  await audit(null, { action: 'auth.register', entity: 'user', entityId: id, ip });

  // E-mail de bienvenue : envoyé après la réponse (jamais bloquant). Sans
  // fournisseur configuré, `queueEmail` ne fait rien — le compte reste créé.
  if (emailStatus().configured) {
    const settings = await getStoreSettings().catch(() => null);
    if (settings) {
      queueEmail({
        to: parsed.data.email,
        ...welcomeEmail({ firstName: parsed.data.firstName, email: parsed.data.email, store: storeEmailInfo(settings) }),
      });
    }
  }

  redirect('/compte');
}

export async function logoutAction() {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await audit(user, { action: 'auth.logout', entity: 'user', entityId: user.id });
  redirect('/');
}

export async function updateProfileAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Vous devez être connecté.' };

  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').replace(/[\s.-]/g, '');
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  const errors: Record<string, string> = {};
  if (firstName.length < 2) errors.firstName = 'Prénom requis';
  if (lastName.length < 2) errors.lastName = 'Nom requis';
  if (!/^(?:\+?225)?\d{10}$/.test(phone)) errors.phone = 'Téléphone invalide (ex. 0701020304)';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'E-mail invalide';
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  if (email !== user.email) {
    const taken = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (taken[0] && taken[0].id !== user.id) return { fieldErrors: { email: 'Cette adresse est déjà utilisée.' } };
  }

  const normalized = normalizeIvorianPhone(phone);
  if (normalized.ok) {
    const clash = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneNormalized, normalized.canonical))
      .limit(1);
    if (clash[0] && clash[0].id !== user.id) {
      return { fieldErrors: { phone: 'Ce numéro est déjà rattaché à un autre compte.' } };
    }
  }

  await db
    .update(users)
    .set({
      firstName,
      lastName,
      phone: normalized.ok ? normalized.display : phone,
      phoneNormalized: normalized.ok ? normalized.canonical : null,
      email,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
  await audit(user, { action: 'account.profile_updated', entity: 'user', entityId: user.id });
  return { success: 'Vos informations ont été mises à jour.' };
}

export async function changePasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const session = await getCurrentUser();
  if (!session) return { error: 'Vous devez être connecté.' };

  const current = String(formData.get('currentPassword') ?? '');
  const next = String(formData.get('newPassword') ?? '');

  if (next.length < 10 || !/[a-zA-Z]/.test(next) || !/\d/.test(next)) {
    return { fieldErrors: { newPassword: 'Au moins 10 caractères, avec lettres et chiffres.' } };
  }

  const rows = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(current, user.passwordHash))) {
    return { fieldErrors: { currentPassword: 'Mot de passe actuel incorrect.' } };
  }

  await db.update(users).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(users.id, user.id));
  await audit(session, { action: 'account.password_changed', entity: 'user', entityId: user.id });
  return { success: 'Mot de passe modifié.' };
}

/**
 * Suppression du compte client par la personne elle-même.
 *
 * Google Play impose qu'une application qui permet de créer un compte permette
 * aussi de le supprimer depuis l'application (ou depuis une page web accessible
 * sans installer l'app) : c'est ce que fait cette action, sans passer par la
 * boutique. Trois garde-fous : le mot à recopier, le mot de passe, et un rôle
 * limité aux clients (un agent ne peut pas s'effacer lui-même et laisser la
 * boutique sans personne).
 *
 * Ce qui est effacé : le compte, le mot de passe, les adresses enregistrées et
 * toutes les sessions ouvertes (suppression en cascade). Ce qui reste : les
 * commandes déjà passées, détachées du compte (`orders.user_id` passe à NULL),
 * parce qu'elles servent de justificatif de vente, de garantie et de retour.
 */
export async function deleteAccountAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const session = await getCurrentUser();
  if (!session) return { error: 'Vous devez être connecté.' };

  if (session.role !== 'CUSTOMER') {
    return {
      error:
        'Les comptes du personnel ne se suppriment pas depuis cette page : demandez au propriétaire de la boutique de retirer votre accès dans l’administration.',
    };
  }

  // Mot à recopier : un frein simple contre le clic malheureux.
  const keyword = 'SUPPRIMER';
  const typed = String(formData.get('confirmation') ?? '').trim().toUpperCase();
  const password = String(formData.get('password') ?? '');

  if (typed !== keyword) {
    return { fieldErrors: { confirmation: `Écrivez ${keyword} pour confirmer.` } };
  }

  const h = await headers();
  const ip = clientIpFrom(h);
  const limit = rateLimit(`delete-account:${session.id}`, 5, 3600);
  if (!limit.allowed) return { error: 'Trop de tentatives. Réessayez dans une heure.' };

  const rows = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
  const user = rows[0];
  if (!user) return { error: 'Compte introuvable.' };

  if (user.passwordHash && !(await verifyPassword(password, user.passwordHash))) {
    return { fieldErrors: { password: 'Mot de passe incorrect.' } };
  }

  // Les commandes conservées ne sont pas supprimées : on les détache du compte
  // (la contrainte de clé étrangère met `user_id` à NULL) pour ne pas perdre la
  // comptabilité de la boutique.
  await destroySession();
  await db.delete(users).where(eq(users.id, user.id));
  await audit(null, {
    action: 'account.deleted',
    entity: 'user',
    entityId: user.id,
    ip,
    metadata: { accountId: user.id, role: user.role },
  });

  redirect('/supprimer-mon-compte/confirmation');
}

export async function saveAddressAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Vous devez être connecté.' };

  const id = String(formData.get('id') ?? '');
  const values = {
    label: String(formData.get('label') ?? '').trim() || null,
    recipientName: String(formData.get('recipientName') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').replace(/[\s.-]/g, ''),
    city: String(formData.get('city') ?? '').trim(),
    commune: String(formData.get('commune') ?? '').trim() || null,
    addressLine: String(formData.get('addressLine') ?? '').trim(),
    landmark: String(formData.get('landmark') ?? '').trim() || null,
  };

  const errors: Record<string, string> = {};
  if (values.recipientName.length < 2) errors.recipientName = 'Nom du destinataire requis';
  if (!/^(?:\+?225)?\d{10}$/.test(values.phone)) errors.phone = 'Téléphone invalide';
  if (values.city.length < 2) errors.city = 'Ville requise';
  if (values.addressLine.length < 5) errors.addressLine = 'Adresse requise';
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  if (id) {
    const owned = await db.select({ id: addresses.id }).from(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, user.id))).limit(1);
    if (!owned[0]) return { error: 'Adresse introuvable.' };
    await db.update(addresses).set({ ...values, updatedAt: new Date() }).where(eq(addresses.id, id));
  } else {
    const count = await db.select({ id: addresses.id }).from(addresses).where(eq(addresses.userId, user.id));
    await db.insert(addresses).values({
      id: newId('adr_'),
      userId: user.id,
      ...values,
      isDefault: count.length === 0,
    });
  }

  return { success: 'Adresse enregistrée.' };
}

export async function deleteAddressAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get('id') ?? '');
  await db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, user.id)));
  redirect('/compte/adresses');
}

/**
 * Demande de réinitialisation depuis la page publique.
 *
 * Si un service d'e-mail est configuré (`RESEND_API_KEY` ou `BREVO_API_KEY` +
 * `EMAIL_FROM`), le lien part immédiatement par e-mail. Sinon, le jeton est créé
 * et l'administrateur transmet le lien depuis /admin/utilisateurs (WhatsApp).
 * La réponse est identique que le compte existe ou non (pas d'énumération).
 */
export async function requestPasswordResetAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const identifier = String(formData.get('identifier') ?? formData.get('email') ?? '').trim();
  const generic = {
    success: emailStatus().configured
      ? 'Si un compte existe pour cet identifiant, un lien de réinitialisation vient d’être envoyé. Pensez à vérifier vos indésirables.'
      : 'Demande enregistrée. Aucun service d’e-mail n’est configuré : contactez la boutique (WhatsApp) pour recevoir votre lien de réinitialisation.',
  };
  if (!identifier) return { fieldErrors: { identifier: 'E-mail ou téléphone requis' } };

  const rows = await lookupUsersByIdentifier(identifier).then((list) => list.slice(0, 1));
  const user = rows[0];
  if (!user) return generic;

  const token = randomBytes(32).toString('base64url');
  await db.insert(passwordResetTokens).values({
    id: newId('rst_'),
    tokenHash: createHash('sha256').update(token).digest('hex'),
    userId: user.id,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  let sent = false;
  if (emailStatus().configured) {
    const settings = await getStoreSettings();
    const url = `${env.appUrl.replace(/\/$/, '')}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`;
    const message = passwordResetEmail({
      firstName: user.firstName || user.email,
      resetUrl: url,
      expiresInMinutes: 60,
      store: storeEmailInfo(settings),
    });
    const result = await sendEmail({ to: user.email, ...message });
    sent = result.sent;
    if (!result.sent) console.error('[auth] envoi e-mail de réinitialisation', result.error);
  }

  await audit(null, {
    action: 'auth.password_reset_requested',
    entity: 'user',
    entityId: user.id,
    metadata: { channel: sent ? 'email' : 'manual' },
  });

  return generic;
}

export async function resetPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  if (password.length < 10 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return { fieldErrors: { password: 'Au moins 10 caractères, avec lettres et chiffres.' } };
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const rows = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash)).limit(1);
  const record = rows[0];
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: 'Lien de réinitialisation invalide ou expiré.' };
  }

  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, record.userId));
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, record.id));
  await audit(null, { action: 'auth.password_reset_completed', entity: 'user', entityId: record.userId });
  redirect('/connexion?reset=1');
}

export { slugify };
