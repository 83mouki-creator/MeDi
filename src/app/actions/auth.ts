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
  verifyPassword,
  requirePermission,
} from '@/lib/auth';
import { loginSchema, registerSchema, fieldErrors } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';
import { newId, slugify } from '@/lib/utils';
import { createHash, randomBytes } from 'node:crypto';

export type AuthState = { error?: string; fieldErrors?: Record<string, string>; success?: string };

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const h = await headers();
  const ip = clientIpFrom(h);
  const limit = rateLimit(`login:${ip ?? 'local'}:${parsed.data.email}`, 10, 300);
  if (!limit.allowed) return { error: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' };

  const redirectTo = String(formData.get('redirectTo') ?? '');

  try {
    const user = await authenticate(parsed.data.email, parsed.data.password);
    await audit(
      { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone, role: user.role },
      { action: 'auth.login', entity: 'user', entityId: user.id, ip },
    );
    const target = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : user.role === 'CUSTOMER' ? '/compte' : '/admin';
    redirect(target);
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message };
    if (typeof error === 'object' && error !== null && 'digest' in error) throw error;
    console.error('[auth] connexion', error);
    return { error: 'Connexion impossible pour le moment.' };
  }
}

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

  const id = newId('usr_');
  await db.insert(users).values({
    id,
    email: parsed.data.email,
    passwordHash: await hashPassword(parsed.data.password),
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    phone: parsed.data.phone,
    role: 'CUSTOMER',
  });

  await authenticate(parsed.data.email, parsed.data.password);
  await audit(null, { action: 'auth.register', entity: 'user', entityId: id, ip });
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

  await db.update(users).set({ firstName, lastName, phone, email, updatedAt: new Date() }).where(eq(users.id, user.id));
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
 * Demande de réinitialisation. Un jeton est créé mais n'est jamais renvoyé au
 * navigateur : sans service d'e-mail configuré, l'administrateur transmet le lien
 * de façon sécurisée depuis /admin/utilisateurs. La réponse est identique que le
 * compte existe ou non (pas d'énumération des comptes).
 */
export async function requestPasswordResetAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const generic = {
    success:
      'Si un compte existe pour cette adresse, une procédure de réinitialisation a été enregistrée. Contactez la boutique si vous ne recevez rien.',
  };
  if (!email) return { fieldErrors: { email: 'Adresse requise' } };

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (user) {
    const token = randomBytes(32).toString('base64url');
    await db.insert(passwordResetTokens).values({
      id: newId('rst_'),
      tokenHash: createHash('sha256').update(token).digest('hex'),
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await audit(null, { action: 'auth.password_reset_requested', entity: 'user', entityId: user.id });
  }
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

export async function createManagedUserAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const actor = await requirePermission('users.manage').catch(() => null);
  if (!actor) return { error: 'Action réservée au propriétaire.' };

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const role = String(formData.get('role') ?? 'ADMIN') as 'OWNER' | 'ADMIN' | 'STOCK_MANAGER' | 'ORDER_MANAGER' | 'CUSTOMER';
  const password = String(formData.get('password') ?? '');

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { fieldErrors: { email: 'E-mail invalide' } };
  if (password.length < 12) return { fieldErrors: { password: '12 caractères minimum pour un compte interne' } };

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return { fieldErrors: { email: 'Un compte utilise déjà cette adresse.' } };

  const id = newId('usr_');
  await db.insert(users).values({
    id,
    email,
    passwordHash: await hashPassword(password),
    firstName: firstName || null,
    lastName: lastName || null,
    role,
  });

  await audit(actor, { action: 'user.created', entity: 'user', entityId: id, metadata: { email, role } });
  return { success: `Compte ${role} créé pour ${email}.` };
}

export async function toggleUserActiveAction(formData: FormData) {
  const actor = await requirePermission('users.manage').catch(() => null);
  if (!actor) redirect('/admin');
  const id = String(formData.get('id') ?? '');
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const target = rows[0];
  if (!target || target.id === actor.id) redirect('/admin/utilisateurs');

  await db.update(users).set({ isActive: !target.isActive }).where(eq(users.id, id));
  await audit(actor, { action: target.isActive ? 'user.disabled' : 'user.enabled', entity: 'user', entityId: id });
  redirect('/admin/utilisateurs');
}

export { slugify };
