import { cookies, headers } from 'next/headers';
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '../db';
import { users, sessions, loginAttempts, type User } from '../db/schema';
import { env } from './env';
import { newId } from './utils';

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

export type SessionUser = Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'phone' | 'role'>;

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

export const STAFF_ROLES = ['STOCK_MANAGER', 'ORDER_MANAGER', 'ADMIN', 'OWNER'] as const;

export type Permission =
  | 'products.read'
  | 'products.write'
  | 'orders.read'
  | 'orders.write'
  | 'payments.confirm'
  | 'settings.write'
  | 'users.manage'
  | 'audit.read';

const PERMISSIONS: Record<Permission, readonly string[]> = {
  'products.read': ['STOCK_MANAGER', 'ORDER_MANAGER', 'ADMIN', 'OWNER'],
  'products.write': ['STOCK_MANAGER', 'ADMIN', 'OWNER'],
  'orders.read': ['STOCK_MANAGER', 'ORDER_MANAGER', 'ADMIN', 'OWNER'],
  'orders.write': ['ORDER_MANAGER', 'ADMIN', 'OWNER'],
  'payments.confirm': ['ADMIN', 'OWNER'],
  'settings.write': ['ADMIN', 'OWNER'],
  'users.manage': ['OWNER'],
  'audit.read': ['ADMIN', 'OWNER'],
};

export function can(role: string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSIONS[permission].includes(role);
}

export function isStaff(role: string | null | undefined) {
  return Boolean(role && (STAFF_ROLES as readonly string[]).includes(role));
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
export async function authenticate(email: string, password: string): Promise<SessionUser> {
  const h = await headers();
  const ip = clientIpFrom(h);
  const normalizedEmail = email.toLowerCase().trim();

  const failures = await recentFailedAttempts(normalizedEmail, ip);
  if (failures >= MAX_FAILED_ATTEMPTS) {
    throw new AuthError(
      `Trop de tentatives échouées. Réessayez dans ${LOGIN_WINDOW_MINUTES} minutes.`,
      'RATE_LIMITED',
    );
  }

  const rows = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  const user = rows[0];

  // Comparaison effectuée même si l'utilisateur n'existe pas (temps de réponse constant).
  const dummyHash =
    'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
  const ok = await verifyPassword(password, user?.passwordHash ?? dummyHash);

  if (!user || !ok) {
    await recordLoginAttempt(normalizedEmail, ip, false);
    throw new AuthError('Adresse e-mail ou mot de passe incorrect.', 'INVALID_CREDENTIALS');
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
  };
}
