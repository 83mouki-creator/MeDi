import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '../db';
import { users, sessions, loginAttempts, type User } from '../db/schema';
import { env } from './env';
import { newId } from './utils';
import { normalizeIvorianPhone } from './staff-access';
import { roleHome } from './roles';

const scrypt = promisify(scryptCb) as (p: string | Buffer, s: string | Buffer, k: number, o?: object) => Promise<Buffer>;

// ─────────────────────────────── Mots de passe ───────────────────────────────

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** Hache un mot de passe avec scrypt + sel aléatoire (jamais de mot de passe en clair). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize('NFKC'), salt, 64, SCRYPT_PARAMS);
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, N, r, p, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// ─────────────────────────────── Sessions ───────────────────────────────

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.sessionTtlDays * 24 * 60 * 60 * 1000);
  const h = await headers();

  await db.insert(sessions).values({
    id: newId('ses_'),
    tokenHash: sha256(token),
    userId,
    expiresAt,
    ip: clientIpFrom(h),
    userAgent: h.get('user-agent')?.slice(0, 255) ?? null,
  });

  const store = await cookies();
  store.set(env.sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
    expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(env.sessionCookieName)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }
  store.delete(env.sessionCookieName);
}

export type SessionUser = Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'phone' | 'role' | 'staffTask'>;

/** Retourne l'utilisateur connecté ou null. Ne lève jamais d'exception. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const token = store.get(env.sessionCookieName)?.value;
    if (!token) return null;

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        role: users.role,
        staffTask: users.staffTask,
        isActive: users.isActive,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
      .limit(1);

    const row = rows[0];
    if (!row || !row.isActive) return null;
    return {
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      role: row.role,
      staffTask: row.staffTask,
    };
  } catch (error) {
    // Next.js signale par une exception interne qu'une route ne peut pas être
    // prérendue statiquement (usage de cookies) : elle doit être propagée pour
    // que la route soit rendue dynamiquement, pas avalée comme une erreur.
    if (isNextDynamicUsageError(error)) throw error;
    console.error('[auth] session illisible', error);
    return null;
  }
}

function isNextDynamicUsageError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest === 'string' && digest.startsWith('DYNAMIC_SERVER_USAGE')) return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && message.includes('Dynamic server usage');
}

// ─────────────────────────────── Rôles & permissions ───────────────────────────────

/** Tous les comptes internes (jamais le client final). */
export const STAFF_ROLES = [
  'OWNER',
  'ADMIN',
  'ACCOUNTANT',
  'CASHIER',
  'SALES_ADVISOR',
  'WAREHOUSE_KEEPER',
  'CATALOG_MANAGER',
  'DELIVERY_MANAGER',
  'SUPPORT_AGENT',
  'STOCK_MANAGER',
  'ORDER_MANAGER',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export type Permission =
  | 'products.read'
  | 'products.write'
  | 'stock.write'
  | 'catalog.import'
  | 'orders.read'
  | 'orders.write'
  | 'payments.read'
  | 'payments.confirm'
  | 'messages.handle'
  | 'delivery.manage'
  | 'settings.write'
  | 'users.manage'
  | 'audit.read'
  | 'stats.read';

/**
 * Matrice des droits — la seule source de vérité.
 *
 * Elle est appliquée côté serveur (`requirePermission`) et utilisée pour filtrer
 * la navigation. Un droit absent ici est refusé, même si le lien est connu.
 */
const PERMISSIONS: Record<Permission, readonly string[]> = {
  'products.read': ['STOCK_MANAGER', 'ORDER_MANAGER', 'CASHIER', 'SALES_ADVISOR', 'WAREHOUSE_KEEPER', 'CATALOG_MANAGER', 'DELIVERY_MANAGER', 'SUPPORT_AGENT', 'ACCOUNTANT', 'ADMIN', 'OWNER'],
  'products.write': ['STOCK_MANAGER', 'CATALOG_MANAGER', 'ADMIN', 'OWNER'],
  'stock.write': ['STOCK_MANAGER', 'WAREHOUSE_KEEPER', 'CATALOG_MANAGER', 'ADMIN', 'OWNER'],
  'catalog.import': ['STOCK_MANAGER', 'CATALOG_MANAGER', 'ADMIN', 'OWNER'],
  'orders.read': ['STOCK_MANAGER', 'ORDER_MANAGER', 'CASHIER', 'SALES_ADVISOR', 'WAREHOUSE_KEEPER', 'DELIVERY_MANAGER', 'SUPPORT_AGENT', 'ACCOUNTANT', 'ADMIN', 'OWNER'],
  'orders.write': ['ORDER_MANAGER', 'SALES_ADVISOR', 'DELIVERY_MANAGER', 'ADMIN', 'OWNER'],
  'payments.read': ['ORDER_MANAGER', 'CASHIER', 'ACCOUNTANT', 'ADMIN', 'OWNER'],
  'payments.confirm': ['CASHIER', 'ACCOUNTANT', 'ADMIN', 'OWNER'],
  'messages.handle': ['ORDER_MANAGER', 'SALES_ADVISOR', 'SUPPORT_AGENT', 'ADMIN', 'OWNER'],
  'delivery.manage': ['DELIVERY_MANAGER', 'ADMIN', 'OWNER'],
  'settings.write': ['ADMIN', 'OWNER'],
  'users.manage': ['ADMIN', 'OWNER'],
  'audit.read': ['ACCOUNTANT', 'ADMIN', 'OWNER'],
  'stats.read': ['ACCOUNTANT', 'ADMIN', 'OWNER'],
};

export function can(role: string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSIONS[permission].includes(role);
}

export function isStaff(role: string | null | undefined): role is StaffRole {
  return Boolean(role && (STAFF_ROLES as readonly string[]).includes(role));
}

/** Droits effectifs d'un rôle (utilisé par l'écran d'administration). */
export function permissionsFor(role: string | null | undefined): Permission[] {
  if (!role) return [];
  return (Object.keys(PERMISSIONS) as Permission[]).filter((permission) => PERMISSIONS[permission].includes(role));
}

/**
 * Hiérarchie : un administrateur gère les agents, jamais un autre administrateur
 * ni le propriétaire. Seul le propriétaire peut nommer ou modifier un
 * administrateur/propriétaire.
 */
export const ROLE_LEVEL: Record<string, number> = {
  OWNER: 100,
  ADMIN: 80,
  ACCOUNTANT: 50,
  CASHIER: 40,
  SALES_ADVISOR: 40,
  WAREHOUSE_KEEPER: 30,
  CATALOG_MANAGER: 40,
  DELIVERY_MANAGER: 40,
  SUPPORT_AGENT: 30,
  STOCK_MANAGER: 50,
  ORDER_MANAGER: 50,
  CUSTOMER: 0,
};

export function roleLevel(role: string | null | undefined): number {
  return role ? (ROLE_LEVEL[role] ?? 0) : 0;
}

/** Rôles qu'un acteur peut attribuer (strictement inférieurs au sien). */
export function assignableRoles(actorRole: string | null | undefined): StaffRole[] {
  const actorLevel = roleLevel(actorRole);
  if (actorRole === 'OWNER') return [...STAFF_ROLES];
  return STAFF_ROLES.filter((role) => roleLevel(role) < actorLevel);
}

/** Peut-on administrer ce compte ? (création, désactivation, nouveau code) */
export function canManageUser(actorRole: string | null | undefined, targetRole: string | null | undefined): boolean {
  if (!actorRole || !can(actorRole, 'users.manage')) return false;
  // On ne modifie jamais un compte de niveau égal ou supérieur au sien.
  return roleLevel(targetRole) < roleLevel(actorRole);
}

/**
 * Garde-fou des pages du back-office.
 *
 * Les liens de navigation sont déjà filtrés, mais un agent qui tape une URL
 * directe doit être arrêté ici : ses droits sont limités à sa fonction. En cas
 * de refus, on le renvoie vers l'écran de sa propre tâche (jamais une erreur
 * sèche qui laisserait croire que l'outil est cassé).
 */
export async function requirePagePermission(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/connexion?redirectTo=/admin');
  if (!isStaff(user.role)) redirect('/compte');
  if (!can(user.role, permission)) {
    const home = roleHome(user.role);
    if (home && home !== '/admin') redirect(`${home}?refus=droits`);
    redirect('/compte');
  }
  return user;
}

/** Vérification d'autorisation côté serveur — à appeler dans chaque action sensible. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  if (!can(user.role, permission)) throw new Error('FORBIDDEN');
  return user;
}

// ─────────────────────────────── Anti-bruteforce ───────────────────────────────

export const LOGIN_WINDOW_MINUTES = 15;
export const MAX_FAILED_ATTEMPTS = 8;

export function clientIpFrom(h: Headers): string | null {
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? null;
}

export async function recentFailedAttempts(email: string, ip: string | null) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000);
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.success, false),
        gt(loginAttempts.createdAt, since),
        ip ? sql`(${loginAttempts.email} = ${email.toLowerCase()} OR ${loginAttempts.ip} = ${ip})` : eq(loginAttempts.email, email.toLowerCase()),
      ),
    );
  return rows[0]?.count ?? 0;
}

export async function recordLoginAttempt(email: string, ip: string | null, success: boolean) {
  await db.insert(loginAttempts).values({
    id: newId('att_'),
    email: email.toLowerCase(),
    ip,
    success,
  });
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_CREDENTIALS' | 'RATE_LIMITED' | 'LOCKED' | 'INACTIVE',
  ) {
    super(message);
  }
}

/** Authentification e-mail + mot de passe avec limitation des tentatives. */
/**
 * Retrouve un compte par e-mail **ou** par téléphone ivoirien.
 * Le personnel se connecte avec son numéro s'il n'a pas d'adresse e-mail.
 */
export async function lookupUsersByIdentifier(identifier: string) {
  const raw = identifier.trim();
  if (!raw) return [];
  if (raw.includes('@')) {
    return db.select().from(users).where(eq(users.email, raw.toLowerCase())).limit(1);
  }
  const phone = normalizeIvorianPhone(raw);
  if (phone.ok) {
    const byPhone = await db.select().from(users).where(eq(users.phoneNormalized, phone.canonical)).limit(1);
    if (byPhone.length > 0) return byPhone;
  }
  // Repli : numéro saisi dans un format historique (« +225 07 … »).
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length >= 8) {
    return db.select().from(users).where(eq(users.phone, raw)).limit(1);
  }
  return [];
}

/** Authentification par e-mail ou téléphone + mot de passe, avec limitation des tentatives. */
export async function authenticate(identifier: string, password: string): Promise<SessionUser> {
  const h = await headers();
  const ip = clientIpFrom(h);
  const normalizedEmail = identifier.toLowerCase().trim();

  const failures = await recentFailedAttempts(normalizedEmail, ip);
  if (failures >= MAX_FAILED_ATTEMPTS) {
    throw new AuthError(
      `Trop de tentatives échouées. Réessayez dans ${LOGIN_WINDOW_MINUTES} minutes.`,
      'RATE_LIMITED',
    );
  }

  const rows = await lookupUsersByIdentifier(identifier).then((list) => list.slice(0, 1));
  const user = rows[0];

  // Comparaison effectuée même si l'utilisateur n'existe pas (temps de réponse constant).
  const dummyHash =
    'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
  const ok = await verifyPassword(password, user?.passwordHash ?? dummyHash);

  if (!user || !ok) {
    await recordLoginAttempt(normalizedEmail, ip, false);
    throw new AuthError('Identifiant ou mot de passe incorrect.', 'INVALID_CREDENTIALS');
  }
  if (!user.isActive) {
    await recordLoginAttempt(normalizedEmail, ip, false);
    throw new AuthError('Ce compte est désactivé. Contactez la boutique.', 'INACTIVE');
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw new AuthError('Compte temporairement verrouillé.', 'LOCKED');
  }

  await db.update(users).set({ lastLoginAt: new Date(), failedAttempts: 0 }).where(eq(users.id, user.id));
  await recordLoginAttempt(normalizedEmail, ip, true);
  await createSession(user.id);

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
    staffTask: user.staffTask,
  };
}
