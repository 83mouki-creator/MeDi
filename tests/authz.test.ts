import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import {
  STAFF_ROLES,
  assignableRoles,
  can,
  canManageUser,
  hashPassword,
  isStaff,
  permissionsFor,
  verifyPassword,
  type Permission,
} from '@/lib/auth';
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

const SITE = { STOCK_MANAGER: true, ORDER_MANAGER: true, CASHIER: true, SALES_ADVISOR: true, WAREHOUSE_KEEPER: true, CATALOG_MANAGER: true, DELIVERY_MANAGER: true, SUPPORT_AGENT: true, ACCOUNTANT: true, ADMIN: true, OWNER: true };

describe('matrice des permissions', () => {
  const expectations: Record<Permission, Record<string, boolean>> = {
    'products.read': SITE,
    'products.write': { STOCK_MANAGER: true, CATALOG_MANAGER: true, ADMIN: true, OWNER: true },
    'stock.write': { STOCK_MANAGER: true, WAREHOUSE_KEEPER: true, CATALOG_MANAGER: true, ADMIN: true, OWNER: true },
    'catalog.import': { STOCK_MANAGER: true, CATALOG_MANAGER: true, ADMIN: true, OWNER: true },
    'orders.read': { STOCK_MANAGER: true, ORDER_MANAGER: true, CASHIER: true, SALES_ADVISOR: true, WAREHOUSE_KEEPER: true, DELIVERY_MANAGER: true, SUPPORT_AGENT: true, ACCOUNTANT: true, ADMIN: true, OWNER: true },
    'orders.write': { ORDER_MANAGER: true, SALES_ADVISOR: true, DELIVERY_MANAGER: true, ADMIN: true, OWNER: true },
    'payments.read': { ORDER_MANAGER: true, CASHIER: true, ACCOUNTANT: true, ADMIN: true, OWNER: true },
    'payments.confirm': { CASHIER: true, ACCOUNTANT: true, ADMIN: true, OWNER: true },
    'messages.handle': { ORDER_MANAGER: true, SALES_ADVISOR: true, SUPPORT_AGENT: true, ADMIN: true, OWNER: true },
    'delivery.manage': { DELIVERY_MANAGER: true, ADMIN: true, OWNER: true },
    'settings.write': { ADMIN: true, OWNER: true },
    'users.manage': { ADMIN: true, OWNER: true },
    'audit.read': { ACCOUNTANT: true, ADMIN: true, OWNER: true },
    'stats.read': { ACCOUNTANT: true, ADMIN: true, OWNER: true },
  };

  it('applique exactement les droits attendus par rôle', () => {
    for (const [permission, roles] of Object.entries(expectations)) {
      for (const role of STAFF_ROLES) {
        const expected = roles[role] ?? false;
        expect(can(role, permission as Permission), `${role} → ${permission}`).toBe(expected);
      }
      expect(can('CUSTOMER', permission as Permission), `CUSTOMER → ${permission}`).toBe(false);
    }
  });

  it('donne à chaque agent des droits limités à sa fonction', () => {
    // Un caissier encaisse, mais ne gère ni le catalogue ni les comptes.
    expect(permissionsFor('CASHIER')).toEqual(
      expect.arrayContaining(['orders.read', 'products.read', 'payments.read', 'payments.confirm']),
    );
    expect(permissionsFor('CASHIER')).not.toContain('products.write');
    expect(permissionsFor('CASHIER')).not.toContain('users.manage');
    // Le magasinier gère le stock, pas les paiements.
    expect(can('WAREHOUSE_KEEPER', 'stock.write')).toBe(true);
    expect(can('WAREHOUSE_KEEPER', 'payments.confirm')).toBe(false);
    // Le service client traite les messages, pas les livraisons.
    expect(can('SUPPORT_AGENT', 'messages.handle')).toBe(true);
    expect(can('SUPPORT_AGENT', 'delivery.manage')).toBe(false);
    // Le responsable livraisons ne touche ni au catalogue ni aux utilisateurs.
    expect(can('DELIVERY_MANAGER', 'delivery.manage')).toBe(true);
    expect(can('DELIVERY_MANAGER', 'catalog.import')).toBe(false);
    expect(can('DELIVERY_MANAGER', 'users.manage')).toBe(false);
  });

  it('réserve la hiérarchie : on ne gère que des comptes strictement inférieurs', () => {
    expect(assignableRoles('OWNER')).toEqual([...STAFF_ROLES]);
    expect(assignableRoles('ADMIN')).not.toContain('ADMIN');
    expect(assignableRoles('ADMIN')).not.toContain('OWNER');
    expect(assignableRoles('ADMIN')).toContain('CASHIER');
    expect(assignableRoles('CASHIER')).not.toContain('ADMIN');
    expect(assignableRoles(null)).toEqual([]);

    expect(canManageUser('ADMIN', 'CASHIER')).toBe(true);
    expect(canManageUser('ADMIN', 'ADMIN')).toBe(false);
    expect(canManageUser('ADMIN', 'OWNER')).toBe(false);
    expect(canManageUser('OWNER', 'ADMIN')).toBe(true);
    // Sans droit users.manage, inutile d'avoir un niveau supérieur.
    expect(canManageUser('STOCK_MANAGER', 'CASHIER')).toBe(false);
    expect(canManageUser(null, 'CASHIER')).toBe(false);
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
    expect(isStaff('CASHIER')).toBe(true);
    expect(isStaff('WAREHOUSE_KEEPER')).toBe(true);
    expect(isStaff('CUSTOMER')).toBe(false);
    expect(isStaff(null)).toBe(false);
  });
});
