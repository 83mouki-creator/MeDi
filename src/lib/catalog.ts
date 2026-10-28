import { sql, type SQL } from 'drizzle-orm';
import { db } from '../db';
import { normalizeText } from './utils';

/** Produit tel qu'affiché dans une grille ou un carrousel. */
export type ProductCard = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  price: string;
  promoPrice: string | null;
  effectivePrice: string;
  onPromo: boolean;
  discountPercent: number;
  imageUrl: string | null;
  imageAlt: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  stock: number;
  reserved: number;
  lowStockThreshold: number | null;
  allowPreorder: boolean;
  isFeatured: boolean;
  brandName: string | null;
  brandSlug: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  createdAt: string;
};

export type CatalogFilters = {
  q?: string;
  category?: string; // slug
  brand?: string; // slug
  minPrice?: number;
  maxPrice?: number;
  availability?: 'in_stock' | 'promo' | 'all';
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
  page?: number;
  perPage?: number;
};

/** Fragment SQL : prix effectif (promo active uniquement dans sa fenêtre). */
const PROMO_ACTIVE = sql`(
  p.promo_price IS NOT NULL AND p.promo_price > 0 AND p.promo_price < p.price
  AND (p.promo_starts_at IS NULL OR p.promo_starts_at <= now())
  AND (p.promo_ends_at IS NULL OR p.promo_ends_at >= now())
)`;

const CARD_COLUMNS = sql`
  p.id, p.sku, p.slug, p.name, p.short_description,
  p.price, p.promo_price,
  CASE WHEN ${PROMO_ACTIVE} THEN p.promo_price ELSE p.price END AS effective_price,
  ${PROMO_ACTIVE} AS on_promo,
  p.stock, p.reserved, p.low_stock_threshold, p.allow_preorder, p.is_featured, p.created_at,
  pi.url AS image_url, pi.alt AS image_alt, pi.width AS image_width, pi.height AS image_height,
  b.name AS brand_name, b.slug AS brand_slug,
  c.name AS category_name, c.slug AS category_slug
`;

/** Jointure de l'image principale (position la plus basse). */
const MAIN_IMAGE_JOIN = sql`
  LEFT JOIN LATERAL (
    SELECT url, alt, width, height FROM product_images
    WHERE product_id = p.id ORDER BY position ASC, created_at ASC LIMIT 1
  ) pi ON true
`;

function mapCard(row: Record<string, unknown>): ProductCard {
  const price = Number(row.price);
  const effectivePrice = Number(row.effective_price);
  return {
    id: String(row.id),
    sku: String(row.sku),
    slug: String(row.slug),
    name: String(row.name),
    shortDescription: (row.short_description as string | null) ?? null,
    price: String(row.price),
    promoPrice: row.promo_price === null ? null : String(row.promo_price),
    effectivePrice: String(row.effective_price),
    onPromo: Boolean(row.on_promo),
    discountPercent:
      row.on_promo && price > 0 ? Math.round(((price - effectivePrice) / price) * 100) : 0,
    imageUrl: (row.image_url as string | null) ?? null,
    imageAlt: (row.image_alt as string | null) ?? null,
    imageWidth: row.image_width === null ? null : Number(row.image_width),
    imageHeight: row.image_height === null ? null : Number(row.image_height),
    stock: Number(row.stock),
    reserved: Number(row.reserved),
    lowStockThreshold: row.low_stock_threshold === null ? null : Number(row.low_stock_threshold),
    allowPreorder: Boolean(row.allow_preorder),
    isFeatured: Boolean(row.is_featured),
    brandName: (row.brand_name as string | null) ?? null,
    brandSlug: (row.brand_slug as string | null) ?? null,
    categoryName: (row.category_name as string | null) ?? null,
    categorySlug: (row.category_slug as string | null) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

function baseConditions(): SQL[] {
  return [sql`p.is_active = true`, sql`p.is_archived = false`];
}

export async function listProducts(filters: CatalogFilters = {}): Promise<{ items: ProductCard[]; total: number; page: number; perPage: number; totalPages: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(60, Math.max(1, filters.perPage ?? 24));
  const conditions = baseConditions();

  if (filters.category) conditions.push(sql`c.slug = ${filters.category}`);
  if (filters.brand) conditions.push(sql`b.slug = ${filters.brand}`);
  if (filters.minPrice !== undefined) conditions.push(sql`(CASE WHEN ${PROMO_ACTIVE} THEN p.promo_price ELSE p.price END) >= ${filters.minPrice}`);
  if (filters.maxPrice !== undefined) conditions.push(sql`(CASE WHEN ${PROMO_ACTIVE} THEN p.promo_price ELSE p.price END) <= ${filters.maxPrice}`);
  if (filters.availability === 'in_stock') conditions.push(sql`(p.stock - p.reserved) > 0`);
  if (filters.availability === 'promo') conditions.push(PROMO_ACTIVE);

  const where = sql.join(conditions, sql` AND `);

  const orderBy =
    filters.sort === 'price_asc'
      ? sql`effective_price ASC, p.name ASC`
      : filters.sort === 'price_desc'
        ? sql`effective_price DESC, p.name ASC`
        : filters.sort === 'newest'
          ? sql`p.created_at DESC`
          : sql`p.is_featured DESC, p.sold_count DESC, p.created_at DESC`;

  const result = await db.execute(sql`
    SELECT ${CARD_COLUMNS}, count(*) OVER() AS total_count
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN categories c ON c.id = p.category_id
    ${MAIN_IMAGE_JOIN}
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `);

  const rows = result.rows as Record<string, unknown>[];
  const total = rows[0] ? Number(rows[0].total_count) : 0;

  return {
    items: rows.map(mapCard),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/** Détail complet d'un produit pour la fiche produit. */
export async function getProductBySlug(slug: string) {
  const rows = await db.execute(sql`
    SELECT ${CARD_COLUMNS},
      p.description, p.warranty, p.keywords, p.promo_starts_at, p.promo_ends_at,
      p.category_id, p.brand_id, p.supplier_id, p.is_active, p.is_archived,
      s.name AS supplier_name,
      b.description AS brand_description
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    ${MAIN_IMAGE_JOIN}
    WHERE p.slug = ${slug} AND p.is_archived = false
    LIMIT 1
  `);

  const row = (rows.rows as Record<string, unknown>[])[0];
  if (!row) return null;

  const card = mapCard(row);
  const [images, attributes] = await Promise.all([
    db.execute(sql`
      SELECT id, url, alt, width, height, position FROM product_images
      WHERE product_id = ${card.id} ORDER BY position ASC, created_at ASC
    `),
    db.execute(sql`
      SELECT id, name, value FROM product_attributes
      WHERE product_id = ${card.id} ORDER BY position ASC, name ASC
    `),
  ]);

  return {
    ...card,
    description: (row.description as string | null) ?? null,
    warranty: (row.warranty as string | null) ?? null,
    keywords: (row.keywords as string[] | null) ?? [],
    supplierName: (row.supplier_name as string | null) ?? null,
    categoryId: (row.category_id as string | null) ?? null,
    brandId: (row.brand_id as string | null) ?? null,
    isActive: Boolean(row.is_active),
    isArchived: Boolean(row.is_archived),
    brandDescription: (row.brand_description as string | null) ?? null,
    promoStartsAt: row.promo_starts_at ? new Date(row.promo_starts_at as string).toISOString() : null,
    promoEndsAt: row.promo_ends_at ? new Date(row.promo_ends_at as string).toISOString() : null,
    images: (images.rows as Record<string, unknown>[]).map((i) => ({
      id: String(i.id),
      url: String(i.url),
      alt: (i.alt as string | null) ?? null,
      width: i.width === null ? null : Number(i.width),
      height: i.height === null ? null : Number(i.height),
    })),
    attributes: (attributes.rows as Record<string, unknown>[]).map((a) => ({
      name: String(a.name),
      value: String(a.value),
    })),
  };
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

/** Produits similaires : même catégorie, puis même marque. */
export async function getRelatedProducts(product: { id: string; categoryId?: string | null; brandId?: string | null }, limit = 8) {
  const rows = await db.execute(sql`
    SELECT ${CARD_COLUMNS},
      (CASE WHEN p.category_id = ${product.categoryId ?? null} THEN 2 ELSE 0 END
       + CASE WHEN p.brand_id = ${product.brandId ?? null} THEN 1 ELSE 0 END) AS affinity
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN categories c ON c.id = p.category_id
    ${MAIN_IMAGE_JOIN}
    WHERE p.is_active = true AND p.is_archived = false AND p.id <> ${product.id}
      AND (p.category_id = ${product.categoryId ?? null} OR p.brand_id = ${product.brandId ?? null})
    ORDER BY affinity DESC, p.sold_count DESC, p.created_at DESC
    LIMIT ${limit}
  `);
  return (rows.rows as Record<string, unknown>[]).map(mapCard);
}

export async function getProductsByIds(ids: string[]) {
  if (ids.length === 0) return [] as ProductCard[];
  const rows = await db.execute(sql`
    SELECT ${CARD_COLUMNS}
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN categories c ON c.id = p.category_id
    ${MAIN_IMAGE_JOIN}
    WHERE p.id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
  `);
  return (rows.rows as Record<string, unknown>[]).map(mapCard);
}

export async function listFeatured(limit = 8) {
  const rows = await db.execute(sql`
    SELECT ${CARD_COLUMNS} FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN categories c ON c.id = p.category_id
    ${MAIN_IMAGE_JOIN}
    WHERE p.is_active = true AND p.is_archived = false AND p.is_featured = true
    ORDER BY p.sold_count DESC, p.created_at DESC LIMIT ${limit}
  `);
  return (rows.rows as Record<string, unknown>[]).map(mapCard);
}

export async function listBestSellers(limit = 8) {
  const rows = await db.execute(sql`
    SELECT ${CARD_COLUMNS} FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN categories c ON c.id = p.category_id
    ${MAIN_IMAGE_JOIN}
    WHERE p.is_active = true AND p.is_archived = false AND (p.stock - p.reserved) > 0
    ORDER BY p.sold_count DESC, p.created_at DESC LIMIT ${limit}
  `);
  return (rows.rows as Record<string, unknown>[]).map(mapCard);
}

export async function listNewArrivals(limit = 8) {
  const rows = await db.execute(sql`
    SELECT ${CARD_COLUMNS} FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN categories c ON c.id = p.category_id
    ${MAIN_IMAGE_JOIN}
    WHERE p.is_active = true AND p.is_archived = false
    ORDER BY p.created_at DESC LIMIT ${limit}
  `);
  return (rows.rows as Record<string, unknown>[]).map(mapCard);
}

export async function listPromotions(limit = 8) {
  const rows = await db.execute(sql`
    SELECT ${CARD_COLUMNS} FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN categories c ON c.id = p.category_id
    ${MAIN_IMAGE_JOIN}
    WHERE p.is_active = true AND p.is_archived = false AND ${PROMO_ACTIVE}
    ORDER BY ((p.price - p.promo_price) / NULLIF(p.price,0)) DESC LIMIT ${limit}
  `);
  return (rows.rows as Record<string, unknown>[]).map(mapCard);
}

/** Arborescence de catégories actives avec comptage de produits publiés. */
export async function getCategoryTree() {
  const rows = await db.execute(sql`
    SELECT c.id, c.slug, c.name, c.parent_id, c.position, c.image_url,
           (SELECT count(*)::int FROM products p
             WHERE p.category_id = c.id AND p.is_active = true AND p.is_archived = false) AS product_count
    FROM categories c
    WHERE c.is_active = true
    ORDER BY c.position ASC, c.name ASC
  `);
  const all = (rows.rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    parentId: (r.parent_id as string | null) ?? null,
    position: Number(r.position),
    imageUrl: (r.image_url as string | null) ?? null,
    productCount: Number(r.product_count),
  }));
  return {
    roots: all.filter((c) => !c.parentId),
    childrenOf: (parentId: string) => all.filter((c) => c.parentId === parentId),
    all,
  };
}

export async function listBrandsWithCounts() {
  const rows = await db.execute(sql`
    SELECT b.id, b.slug, b.name, b.logo_url,
      (SELECT count(*)::int FROM products p WHERE p.brand_id = b.id AND p.is_active = true AND p.is_archived = false) AS product_count
    FROM brands b WHERE b.is_active = true ORDER BY b.name ASC
  `);
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    logoUrl: (r.logo_url as string | null) ?? null,
    productCount: Number(r.product_count),
  }));
}

/**
 * Construit le texte de recherche normalisé d'un produit : nom, SKU, marque,
 * catégorie, mots-clés et caractéristiques. Stocké en base pour l'index GIN.
 */
export function buildSearchText(input: {
  name: string;
  sku?: string | null;
  shortDescription?: string | null;
  keywords?: string[] | null;
  brandName?: string | null;
  categoryName?: string | null;
  attributes?: { name: string; value: string }[] | null;
}) {
  const parts = [
    input.name,
    input.sku ?? '',
    input.brandName ?? '',
    input.categoryName ?? '',
    input.shortDescription ?? '',
    ...(input.keywords ?? []),
    ...(input.attributes ?? []).flatMap((a) => [a.name, a.value]),
  ];
  return normalizeText(parts.filter(Boolean).join(' '));
}

export async function getPriceRange() {
  const rows = await db.execute(sql`
    SELECT coalesce(min(CASE WHEN ${PROMO_ACTIVE} THEN p.promo_price ELSE p.price END), 0)::int AS min_price,
           coalesce(max(CASE WHEN ${PROMO_ACTIVE} THEN p.promo_price ELSE p.price END), 0)::int AS max_price
    FROM products p WHERE p.is_active = true AND p.is_archived = false
  `);
  const row = (rows.rows as Record<string, unknown>[])[0];
  return { min: Number(row?.min_price ?? 0), max: Number(row?.max_price ?? 0) };
}
