'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { passwordResetTokens, users } from '@/db/schema';
import {
  canManageUser,
  assignableRoles,
  STAFF_ROLES,
  clientIpFrom,
  createSession,
  hashPassword,
  requirePermission,
} from '@/lib/auth';
import { audit } from '@/lib/audit';
import { env } from '@/lib/env';
import { getStoreSettings } from '@/lib/settings';
import { roleDefinition, roleHome } from '@/lib/roles';
import { rateLimit } from '@/lib/rate-limit';
import { newId } from '@/lib/utils';
import {
  STAFF_CODE_TTL_HOURS,
  generateStaffCode,
  hashStaffCode,
  isValidStaffCodeShape,
  normalizeIvorianPhone,
  staffInviteMessage,
  staffResetMessage,
  validateStaffPassword,
} from '@/lib/staff-access';
import { sendWhatsApp } from '@/lib/whatsapp';
import { sendEmail, emailStatus } from '@/lib/email';

export type StaffInvitation = {
  userId: string;
  fullName: string;
  phone: string;
  roleLabel: string;
  task: string;
  code: string;
  activationUrl: string;
  whatsappLink: string;
  whatsappDelivered: boolean;
  whatsappError?: string;
  whatsappMode: 'api' | 'link';
};

export type StaffState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  invitation?: StaffInvitation;
  resetLink?: {
    userId: string;
    fullName: string;
    url: string;
    whatsappLink: string;
    emailDelivered: boolean;
    emailError?: string;
  };
};

const INTERNAL_MAIL_DOMAIN = 'agents.medi.local';

function internalEmail(phoneDigits: string) {
  return `agent.${phoneDigits}@${INTERNAL_MAIL_DOMAIN}`;
}

function fullName(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(' ');
}

function nameMatches(input: string, stored: string | null) {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const a = normalize(input);
  const b = normalize(stored ?? '');
  if (!b) return false;
  // Tolérance : « Awa Koné » saisi en un champ, ou nom composé.
  if (a === b) return true;
  const partsA = new Set(a.split(' '));
  const partsB = b.split(' ').filter(Boolean);
  return partsB.length > 0 && partsB.every((part) => partsA.has(part));
}

/**
 * Création d'un agent par un administrateur.
 *
 * Aucun agent ne peut s'inscrire lui-même : le compte naît ici, avec son rôle,
 * sa tâche et un code d'accès à usage unique transmis par WhatsApp.
 */
export async function createStaffAction(_prev: StaffState, formData: FormData): Promise<StaffState> {
  let actor;
  try {
    actor = await requirePermission('users.manage');
  } catch {
    return { error: 'Seuls les administrateurs peuvent créer un agent.' };
  }

  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const phoneInput = String(formData.get('phone') ?? '');
  const staffTask = String(formData.get('staffTask') ?? '').trim();
  const role = String(formData.get('role') ?? '') as string;
  const emailInput = String(formData.get('email') ?? '').trim().toLowerCase();

  const fieldErrors: Record<string, string> = {};
  if (firstName.length < 2) fieldErrors.firstName = 'Indiquez le prénom.';
  if (lastName.length < 2) fieldErrors.lastName = 'Indiquez le nom.';
  if (staffTask.length < 3) fieldErrors.staffTask = 'Précisez la tâche assignée (ex. « Caisse du matin »).';
  if (!roleDefinition(role) || role === 'OWNER') {
    fieldErrors.role = 'Choisissez un rôle valide.';
  } else if (!assignableRoles(actor.role).includes(role as (typeof STAFF_ROLES)[number])) {
    fieldErrors.role = 'Vous ne pouvez pas attribuer un rôle supérieur ou égal au vôtre.';
  }
  if (emailInput && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailInput)) {
    fieldErrors.email = 'Adresse e-mail invalide (ou laissez vide).';
  }

  const phone = normalizeIvorianPhone(phoneInput);
  if (!phone.ok) {
    fieldErrors.phone = 'Numéro ivoirien invalide. Format attendu : 07 08 90 48 91.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, error: 'Vérifiez les champs signalés.' };
  }

  const canonicalPhone = phone.ok ? phone.canonical : '';
  const digits = canonicalPhone.replace(/\D/g, '');
  const email = emailInput || internalEmail(digits);

  const existingPhone = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phoneNormalized, canonicalPhone))
    .limit(1);
  if (existingPhone[0]) return { fieldErrors: { phone: 'Ce numéro est déjà rattaché à un compte.' } };

  const existingEmail = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existingEmail[0]) return { fieldErrors: { email: 'Un compte utilise déjà cette adresse.' } };

  const code = generateStaffCode();
  const id = newId('usr_');
  const expiresAt = new Date(Date.now() + STAFF_CODE_TTL_HOURS * 60 * 60 * 1000);
  const now = new Date();

  await db.insert(users).values({
    id,
    email,
    // Mot de passe inutilisable : l'agent le choisit lui-même à l'activation.
    passwordHash: await hashPassword(`${generateStaffCode()}-${generateStaffCode()}`),
    firstName,
    lastName,
    phone: phone.ok ? phone.display : phoneInput,
    phoneNormalized: canonicalPhone,
    role: role as typeof users.$inferInsert.role,
    staffTask,
    staffCodeHash: hashStaffCode(code),
    staffCodeCreatedAt: now,
    staffCodeExpiresAt: expiresAt,
    createdByUserId: actor.id,
    isActive: true,
  });

  const definition = roleDefinition(role)!;
  const settings = await getStoreSettings().catch(() => null);
  const activationUrl = `${env.appUrl.replace(/\/$/, '')}/connexion/agent`;
  const message = staffInviteMessage({
    firstName,
    lastName,
    phone: canonicalPhone,
    code,
    roleLabel: definition.label,
    task: staffTask,
    activationUrl,
    storeName: settings?.storeName,
  });

  const delivery = await sendWhatsApp({
    to: canonicalPhone,
    message,
    templateParams: [fullName(firstName, lastName), staffTask, code, activationUrl],
  });

  if (delivery.delivered) {
    await db.update(users).set({ staffCodeSentAt: new Date() }).where(eq(users.id, id));
  }

  await audit(actor, {
    action: 'staff.created',
    entity: 'user',
    entityId: id,
    metadata: { role, task: staffTask, channel: delivery.delivered ? 'whatsapp-api' : 'whatsapp-link' },
  });

  return {
    success: delivery.delivered
      ? `Agent créé. Le code a été envoyé sur WhatsApp au ${phone.ok ? phone.display : canonicalPhone}.`
      : `Agent créé. Envoyez le code par WhatsApp au ${phone.ok ? phone.display : canonicalPhone} : le message est déjà rédigé.`,
    invitation: {
      userId: id,
      fullName: fullName(firstName, lastName),
      phone: phone.ok ? phone.display : canonicalPhone,
      roleLabel: definition.label,
      task: staffTask,
      code,
      activationUrl,
      whatsappLink: delivery.link,
      whatsappDelivered: delivery.delivered,
      whatsappError: delivery.error,
      whatsappMode: delivery.mode,
    },
  };
}

/**
 * Activation par l'agent : code + nom + téléphone, puis choix du mot de passe.
 * Le code est à usage unique et ne peut pas servir deux fois.
 */
export async function activateStaffAccessAction(_prev: StaffState, formData: FormData): Promise<StaffState> {
  const h = await headers();
  const ip = clientIpFrom(h);
  const limit = rateLimit(`staff-activation:${ip ?? 'local'}`, 12, 10 * 60);
  if (!limit.allowed) {
    return { error: 'Trop de tentatives. Réessayez dans quelques minutes ou contactez votre responsable.' };
  }

  const codeInput = String(formData.get('code') ?? '');
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const phoneInput = String(formData.get('phone') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('passwordConfirm') ?? '');

  const fieldErrors: Record<string, string> = {};
  if (!isValidStaffCodeShape(codeInput)) fieldErrors.code = 'Code incomplet : format MEDI-XXXX-XXXX-XXXX.';
  if (firstName.length < 2) fieldErrors.firstName = 'Indiquez votre prénom.';
  if (lastName.length < 2) fieldErrors.lastName = 'Indiquez votre nom.';

  const phone = normalizeIvorianPhone(phoneInput);
  if (!phone.ok) fieldErrors.phone = 'Numéro ivoirien invalide (ex. 07 08 90 48 91).';

  const passwordError = validateStaffPassword(password, confirm);
  if (passwordError) fieldErrors.password = passwordError;

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, error: 'Vérifiez les informations saisies.' };
  }

  const rows = await db.select().from(users).where(eq(users.staffCodeHash, hashStaffCode(codeInput))).limit(1);
  const user = rows[0];

  const genericError = {
    error:
      'Code, nom ou téléphone incorrect, ou code déjà utilisé. Vérifiez le message WhatsApp reçu, ou demandez un nouveau code à votre responsable.',
  };

  if (!user || !user.phoneNormalized || !phone.ok) return genericError;
  if (user.staffCodeUsedAt) return genericError;
  if (user.staffCodeExpiresAt && user.staffCodeExpiresAt.getTime() < Date.now()) {
    return { error: 'Ce code a expiré. Demandez un nouveau code à votre responsable.' };
  }
  if (!user.isActive) return { error: 'Ce compte est désactivé. Contactez votre responsable.' };
  if (user.phoneNormalized !== phone.canonical) return genericError;
  if (!nameMatches(firstName, user.firstName) || !nameMatches(lastName, user.lastName)) return genericError;

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      staffCodeUsedAt: new Date(),
      // Le code est consommé : il ne peut plus servir, même en cas de fuite.
      staffCodeHash: null,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  await audit(null, {
    action: 'staff.access_activated',
    entity: 'user',
    entityId: user.id,
    ip,
    metadata: { role: user.role },
  });
  await createSession(user.id);

  redirect(roleHome(user.role));
}

/** Nouveau code (l'ancien est invalidé). Réservé aux comptes de niveau supérieur. */
export async function regenerateStaffCodeAction(_prev: StaffState, formData: FormData): Promise<StaffState> {
  let actor;
  try {
    actor = await requirePermission('users.manage');
  } catch {
    return { error: 'Action réservée aux administrateurs.' };
  }

  const id = String(formData.get('id') ?? '');
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const target = rows[0];
  if (!target) return { error: 'Agent introuvable.' };
  if (!canManageUser(actor.role, target.role)) return { error: 'Vous ne pouvez pas modifier ce compte.' };

  const code = generateStaffCode();
  const now = new Date();
  await db
    .update(users)
    .set({
      staffCodeHash: hashStaffCode(code),
      staffCodeCreatedAt: now,
      staffCodeExpiresAt: new Date(now.getTime() + STAFF_CODE_TTL_HOURS * 60 * 60 * 1000),
      staffCodeUsedAt: null,
      staffCodeSentAt: null,
      updatedAt: now,
    })
    .where(eq(users.id, id));

  const settings = await getStoreSettings().catch(() => null);
  const activationUrl = `${env.appUrl.replace(/\/$/, '')}/connexion/agent`;
  const message = staffInviteMessage({
    firstName: target.firstName ?? '',
    lastName: target.lastName ?? '',
    phone: target.phone ?? '',
    code,
    roleLabel: roleDefinition(target.role)?.label ?? target.role,
    task: target.staffTask ?? 'Non précisée',
    activationUrl,
    storeName: settings?.storeName,
  });
  const delivery = target.phoneNormalized
    ? await sendWhatsApp({ to: target.phoneNormalized, message })
    : { delivered: false, mode: 'link' as const, link: '', error: 'Numéro de téléphone absent.' };

  if (delivery.delivered) {
    await db.update(users).set({ staffCodeSentAt: new Date() }).where(eq(users.id, id));
  }

  await audit(actor, { action: 'staff.code_regenerated', entity: 'user', entityId: id });

  return {
    success: delivery.delivered ? 'Nouveau code envoyé par WhatsApp.' : 'Nouveau code généré : envoyez-le par WhatsApp.',
    invitation: {
      userId: id,
      fullName: fullName(target.firstName ?? '', target.lastName ?? ''),
      phone: target.phone ?? '',
      roleLabel: roleDefinition(target.role)?.label ?? target.role,
      task: target.staffTask ?? '',
      code,
      activationUrl,
      whatsappLink: delivery.link,
      whatsappDelivered: delivery.delivered,
      whatsappError: delivery.error,
      whatsappMode: delivery.mode,
    },
  };
}

/** Lien de réinitialisation à remettre par WhatsApp (ou par e-mail si configuré). */
export async function issuePasswordResetLinkAction(_prev: StaffState, formData: FormData): Promise<StaffState> {
  let actor;
  try {
    actor = await requirePermission('users.manage');
  } catch {
    return { error: 'Action réservée aux administrateurs.' };
  }

  const id = String(formData.get('id') ?? '');
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const target = rows[0];
  if (!target) return { error: 'Compte introuvable.' };
  if (!canManageUser(actor.role, target.role)) return { error: 'Vous ne pouvez pas agir sur ce compte.' };

  const token = generateStaffCode().replace(/-/g, '') + generateStaffCode().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await db.insert(passwordResetTokens).values({
    id: newId('rst_'),
    tokenHash: createHash('sha256').update(token).digest('hex'),
    userId: target.id,
    expiresAt,
  });

  const url = `${env.appUrl.replace(/\/$/, '')}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`;
  const settings = await getStoreSettings().catch(() => null);
  const firstName = target.firstName ?? '';
  const message = staffResetMessage({ firstName: firstName || target.email, resetUrl: url, storeName: settings?.storeName });

  const whatsapp = target.phoneNormalized ? await sendWhatsApp({ to: target.phoneNormalized, message }) : null;

  let emailDelivered = false;
  let emailError: string | undefined;
  if (emailStatus().configured && !target.email.endsWith(`@${INTERNAL_MAIL_DOMAIN}`)) {
    const result = await sendEmail({ to: target.email, subject: 'MeDi — réinitialisation de votre mot de passe', text: message });
    emailDelivered = result.sent;
    emailError = result.error;
  }

  await audit(actor, {
    action: 'auth.password_reset_link_issued',
    entity: 'user',
    entityId: target.id,
    metadata: { channel: whatsapp?.delivered ? 'whatsapp' : emailDelivered ? 'email' : 'manual', expiresAt: expiresAt.toISOString() },
  });

  return {
    success: 'Lien créé (valable 1 heure, usage unique).',
    resetLink: {
      userId: target.id,
      fullName: fullName(target.firstName ?? '', target.lastName ?? '') || target.email,
      url,
      whatsappLink: whatsapp?.link ?? '',
      emailDelivered,
      emailError,
    },
  };
}

/** Activation / désactivation avec contrôle de hiérarchie et protection du dernier propriétaire. */
export async function setStaffActiveAction(formData: FormData) {
  let actor;
  try {
    actor = await requirePermission('users.manage');
  } catch {
    return redirect('/admin');
  }
  const id = String(formData.get('id') ?? '');
  const active = String(formData.get('active') ?? '') === '1';

  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const target = rows[0];
  if (!target || target.id === actor.id) redirect('/admin/utilisateurs');
  if (!canManageUser(actor.role, target.role)) redirect('/admin/utilisateurs?refus=hierarchie');

  if (!active && target.role === 'OWNER') {
    const owners = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, 'OWNER'), eq(users.isActive, true)));
    if ((owners[0]?.count ?? 0) <= 1) redirect('/admin/utilisateurs?refus=dernier-proprietaire');
  }

  await db.update(users).set({ isActive: active, updatedAt: new Date() }).where(eq(users.id, id));
  await audit(actor, { action: active ? 'user.enabled' : 'user.disabled', entity: 'user', entityId: id });
  redirect('/admin/utilisateurs');
}

/**
 * Suppression du code en attente (l'agent ne peut plus activer son accès).
 * Le compte reste, désactivé par sécurité.
 */
export async function revokeStaffCodeAction(formData: FormData) {
  let actor;
  try {
    actor = await requirePermission('users.manage');
  } catch {
    return redirect('/admin');
  }
  const id = String(formData.get('id') ?? '');
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const target = rows[0];
  if (!target) redirect('/admin/utilisateurs');
  if (!canManageUser(actor.role, target.role)) redirect('/admin/utilisateurs?refus=hierarchie');

  await db.update(users).set({ staffCodeHash: null, isActive: false, updatedAt: new Date() }).where(eq(users.id, id));
  await audit(actor, { action: 'staff.code_revoked', entity: 'user', entityId: id });
  redirect('/admin/utilisateurs');
}


