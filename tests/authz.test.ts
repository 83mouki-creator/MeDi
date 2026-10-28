import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { can, hashPassword, isStaff, verifyPassword, type Permission } from '@/lib/auth';
import { resetDb, createUser } from './helpers';

beforeEach(async () => {
  await resetDb();
});

describe('mots de passe', () => {
  it('ne stocke jamais un mot de passe en clair et vérifie correctement', async () => {
    const password = 'Quincaillerie#2026';
    const hash = await hashPassword(password);

    expect(hash).not.toContain(password);
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('mauvais-mot-de-passe', hash)).toBe(false);
    expect(await verifyPassword(password, 'hash-invalide')).toBe(false);
  });

  it('produit un condensat différent à chaque fois (sel aléatoire)', async () => {
    const [a, b] = await Promise.all([hashPassword('Quincaillerie#2026'), hashPassword('Quincaillerie#2026')]);
    expect(a).not.toBe(b);
    expect(await verifyPassword('Quincaillerie#2026', b)).toBe(true);
  });

  it('enregistre uniquement le condensat en base', async () => {
    const user = await createUser();
    const rows = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id));
    const hash = rows[0]!.hash;
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash).not.toContain('MotDePasseTest123!');
  });
});

describe('matrice des permissions', () => {
  const expectations: Record<Permission, Record<string, boolean>> = {
    'products.read': { CUSTOMER: false, STOCK_MANAGER: true, ORDER_MANAGER: true, ADMIN: true, OWNER: true },
    'products.write': { CUSTOMER: false, STOCK_MANAGER: true, ORDER_MANAGER: false, ADMIN: true, OWNER: true },
    'orders.read': { CUSTOMER: false, STOCK_MANAGER: true, ORDER_MANAGER: true, ADMIN: true, OWNER: true },
    'orders.write': { CUSTOMER: false, STOCK_MANAGER: false, ORDER_MANAGER: true, ADMIN: true, OWNER: true },
    'payments.confirm': { CUSTOMER: false, STOCK_MANAGER: false, ORDER_MANAGER: false, ADMIN: true, OWNER: true },
    'settings.write': { CUSTOMER: false, STOCK_MANAGER: false, ORDER_MANAGER: false, ADMIN: true, OWNER: true },
    'users.manage': { CUSTOMER: false, STOCK_MANAGER: false, ORDER_MANAGER: false, ADMIN: false, OWNER: true },
    'audit.read': { CUSTOMER: false, STOCK_MANAGER: false, ORDER_MANAGER: false, ADMIN: true, OWNER: true },
  };

  it('applique exactement les droits attendus par rôle', () => {
    for (const [permission, roles] of Object.entries(expectations)) {
      for (const [role, expected] of Object.entries(roles)) {
        expect(can(role, permission as Permission), `${role} → ${permission}`).toBe(expected);
      }
    }
  });

  it('refuse tout accès sans rôle (visiteur, utilisateur inconnu)', () => {
    for (const permission of Object.keys(expectations) as Permission[]) {
      expect(can(null, permission)).toBe(false);
      expect(can(undefined, permission)).toBe(false);
      expect(can('ROLE_INEXISTANT', permission)).toBe(false);
    }
  });

  it('distingue le personnel du client final', () => {
    expect(isStaff('OWNER')).toBe(true);
    expect(isStaff('STOCK_MANAGER')).toBe(true);
    expect(isStaff('CUSTOMER')).toBe(false);
    expect(isStaff(null)).toBe(false);
  });
});
