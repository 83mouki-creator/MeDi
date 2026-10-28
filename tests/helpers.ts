import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db, pool } from '@/db';
import {
  brands,
  categories,
  deliveryZones,
  products,
  productImages,
  storeSettings,
  users,
} from '@/db/schema';
import { buildSearchText } from '@/lib/catalog';
import { hashPassword } from '@/lib/auth';

export const TEST_PREFIX = 'tst_';
const id = (prefix: string) => `${TEST_PREFIX}${prefix}_${randomBytes(4).toString('hex')}`;

/** Vide toutes les tables applicatives (la base de test est jetable). */
export async function resetDb() {
  const tables = await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'drizzle_migrations'",
  );
  const names = tables.rows.map((row) => `"${row.tablename}"`).join(', ');
  if (names) await pool.query(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);

  // Réglages de base : paiement à la livraison autorisé sous 300 000 FCFA.
  await db.insert(storeSettings).values({
    id: 1,
    storeName: 'MeDi Test',
    city: 'Daloa',
    allowCod: true,
    codMaxAmount: '300000',
    allowPickup: true,
    allowLocalDelivery: true,
    lowStockThreshold: 5,
    reservationMinutes: 120,
    waveMode: 'MANUAL',
  });

  return {
    pickupZone: await createZone({ name: 'Retrait boutique (test)', city: 'Daloa', isLocal: true, isPickup: true, fee: '0' }),
    localZone: await createZone({ name: 'Daloa centre (test)', city: 'Daloa', isLocal: true, isPickup: false, fee: '2000' }),
    localFreeZone: await createZone({
      name: 'Daloa gratuit (test)',
      city: 'Daloa',
      isLocal: true,
      isPickup: false,
      fee: '3000',
      freeAbove: '50000',
    }),
    carrierZone: await createZone({
      name: 'Abidjan (test)',
      city: 'Abidjan',
      isLocal: false,
      isPickup: false,
      fee: '7500',
    }),
  };
}

export async function createZone(input: {
  name: string;
  city: string;
  isLocal: boolean;
  isPickup: boolean;
  fee: string;
  freeAbove?: string;
}) {
  const [zone] = await db
    .insert(deliveryZones)
    .values({
      id: id('zone'),
      name: input.name,
      city: input.city,
      isLocal: input.isLocal,
      isPickup: input.isPickup,
      fee: input.fee,
      freeAbove: input.freeAbove ?? null,
      estimatedDelay: '24 h (test)',
      isActive: true,
    })
    .returning();
  return zone!;
}

export async function createCategory(name = 'Outillage (test)') {
  const [row] = await db
    .insert(categories)
    .values({
      id: id('cat'),
      slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomBytes(3).toString('hex')}`,
      name,
      isActive: true,
    })
    .returning();
  return row!;
}

export async function createBrand(name = 'Nasco') {
  const [row] = await db
    .insert(brands)
    .values({
      id: id('brd'),
      slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomBytes(3).toString('hex')}`,
      name,
      isActive: true,
    })
    .returning();
  return row!;
}

export type TestProductInput = {
  name?: string;
  price?: string;
  stock?: number;
  reserved?: number;
  promoPrice?: string | null;
  promoStartsAt?: Date | null;
  promoEndsAt?: Date | null;
  categoryId?: string | null;
  brandId?: string | null;
  keywords?: string[];
  isActive?: boolean;
  isArchived?: boolean;
  allowPreorder?: boolean;
  lowStockThreshold?: number | null;
  shortDescription?: string | null;
};

let skuCounter = 9000;

export async function createProduct(input: TestProductInput = {}) {
  skuCounter += 1;
  const sku = `TEST-${skuCounter}`;
  const name = input.name ?? `Produit de test ${sku}`;
  const [category, brand] = await Promise.all([
    input.categoryId
      ? db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(eq(categories.id, input.categoryId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : createCategory().then((row) => ({ id: row.id, name: row.name })),
    input.brandId
      ? db
          .select({ id: brands.id, name: brands.name })
          .from(brands)
          .where(eq(brands.id, input.brandId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : createBrand('Nasco').then((row) => ({ id: row.id, name: row.name })),
  ]);

  const searchText = buildSearchText({
    name,
    sku,
    shortDescription: input.shortDescription ?? null,
    keywords: input.keywords ?? [],
    brandName: brand?.name ?? null,
    categoryName: category?.name ?? null,
  });

  const [row] = await db
    .insert(products)
    .values({
      id: id('prd'),
      sku,
      slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${sku.toLowerCase()}`,
      name,
      shortDescription: input.shortDescription ?? 'Produit utilisé par la suite de tests.',
      description: 'Description de test.',
      categoryId: input.categoryId ?? category?.id ?? null,
      brandId: input.brandId ?? brand?.id ?? null,
      price: input.price ?? '15000',
      promoPrice: input.promoPrice ?? null,
      promoStartsAt: input.promoStartsAt ?? null,
      promoEndsAt: input.promoEndsAt ?? null,
      stock: input.stock ?? 10,
      reserved: input.reserved ?? 0,
      lowStockThreshold: input.lowStockThreshold ?? null,
      allowPreorder: input.allowPreorder ?? false,
      isActive: input.isActive ?? true,
      isArchived: input.isArchived ?? false,
      searchText,
    })
    .returning();
  return row!;
}

export async function addProductImage(productId: string, url = '/uploads/test.webp') {
  const [row] = await db
    .insert(productImages)
    .values({ id: id('img'), productId, url, alt: 'Image de test', position: 0, width: 600, height: 600 })
    .returning();
  return row!;
}

export async function createUser(input: { email?: string; role?: 'CUSTOMER' | 'ADMIN' | 'OWNER' | 'STOCK_MANAGER' | 'ORDER_MANAGER' } = {}) {
  const email = input.email ?? `client-${randomBytes(4).toString('hex')}@test.ci`;
  const [row] = await db
    .insert(users)
    .values({
      id: id('usr'),
      email,
      passwordHash: await hashPassword('MotDePasseTest123!'),
      firstName: 'Client',
      lastName: 'Test',
      role: input.role ?? 'CUSTOMER',
      isActive: true,
    })
    .returning();
  return row!;
}

export async function productState(productId: string) {
  const rows = await db
    .select({ stock: products.stock, reserved: products.reserved, soldCount: products.soldCount })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  return rows[0]!;
}

export async function scalar<T = number>(query: ReturnType<typeof sql>): Promise<T> {
  const result = await db.execute(query);
  return (result.rows[0] as Record<string, T>)[Object.keys(result.rows[0] as object)[0]!]!;
}

export function checkoutInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    firstName: 'Awa',
    lastName: 'Koné',
    phone: '0701020304',
    email: 'awa@example.ci',
    deliveryMethod: 'PICKUP' as const,
    zoneId: '',
    city: 'Daloa',
    commune: '',
    addressLine: '',
    landmark: '',
    carrier: '',
    paymentMethod: 'CASH_IN_STORE' as const,
    customerNote: '',
    items: [],
    ...overrides,
  };
}
