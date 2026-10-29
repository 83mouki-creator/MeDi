import { sql } from 'drizzle-orm';
import { db } from '../db';
import { normalizeText } from './utils';
import type { ProductCard } from './catalog';

/**
 * Recherche textuelle : PostgreSQL Full-Text Search (configuration `french`) sur
 * une colonne normalisée, combinée aux trigrammes (pg_trgm) pour les fautes de
 * frappe et les recherches partielles.
 *
 * Priorité : correspondance exacte (SKU, nom) > préfixe > pertinence plein texte
 * > similarité approximative.
 */

export type SearchOptions = {
  page?: number;
  perPage?: number;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
  availability?: 'all' | 'in_stock';
  category?: string;
  brand?: string;
};

export type SearchResult = {
  items: (ProductCard & { score: number })[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  query: string;
  usedFuzzy: boolean;
};

const CARD_SQL = sql`
  p.id, p.sku, p.slug, p.name, p.short_description,
  p.price, p.promo_price,
  effective_price, on_promo,
  p.stock, p.reserved, p.low_stock_threshold, p.allow_preorder, p.is_featured, p.created_at,
  pi.url AS image_url, pi.alt AS image_alt, pi.width AS image_width, pi.height AS image_height,
  b.name AS brand_name, b.slug AS brand_slug,
  c.name AS category_name, c.slug AS category_slug
`;

function buildScoreFragment(q: string) {
  return sql`
    (
      CASE
        WHEN lower(p.sku) = lower(${q}) THEN 1000
        WHEN lower(p.name) = lower(${q}) THEN 900
        WHEN lower(p.name) LIKE lower(${q}) || '%' THEN 600
        WHEN lower(p.sku) LIKE lower(${q}) || '%' THEN 550
        WHEN lower(b.name) = lower(${q}) THEN 450
        WHEN c.name IS NOT NULL AND lower(c.name) = lower(${q}) THEN 400
        WHEN lower(p.name) LIKE '%' || lower(${q}) || '%' THEN 300
        ELSE 0
      END
      + ts_rank(to_tsvector('french', p.search_text), websearch_to_tsquery('french', ${q})) * 120
      + similarity(p.search_text, lower(${q})) * 25
      + similarity(lower(p.name), lower(${q})) * 40
    )
  `;
}

export async function searchProducts(rawQuery: string, options: SearchOptions = {}): Promise<SearchResult> {
  const query = normalizeText(rawQuery);
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(60, Math.max(1, options.perPage ?? 24));

  if (!query) {
    return { items: [], total: 0, page, perPage, totalPages: 1, query: '', usedFuzzy: false };
  }

  // Terme exploitable par les trigrammes (>= 3 caractères).
  const fuzzyCapable = query.length >= 3;
  const words = query.split(' ').filter((w) => w.length >= 3);

  const conditions = [
    sql`p.is_active = true`,
    sql`p.is_archived = false`,
    sql`(
      to_tsvector('french', p.search_text) @@ websearch_to_tsquery('french', ${query})
      ${fuzzyCapable ? sql`OR p.search_text % ${query}
      OR EXISTS (
        SELECT 1 FROM regexp_split_to_table(p.search_text, ' ') AS tok
        WHERE word_similarity(${query}, tok) >= 0.7
      )` : sql``}
      ${words.length > 1 ? sql`OR ${sql.join(words.map((w) => sql`p.search_text LIKE ${'%' + w + '%'}`), sql` AND `)}` : sql``}
      OR lower(p.name) LIKE ${'%' + query + '%'}
      OR lower(p.sku) LIKE ${'%' + query + '%'}
      ${fuzzyCapable ? sql`OR similarity(lower(p.name), ${query}) > 0.3` : sql``}
    )`,
  ];

  if (options.availability === 'in_stock') conditions.push(sql`(p.stock - p.reserved) > 0`);
  if (options.category) conditions.push(sql`c.slug = ${options.category}`);
  if (options.brand) conditions.push(sql`b.slug = ${options.brand}`);

  const where = sql.join(conditions, sql` AND `);
  const score = buildScoreFragment(query);
  const orderBy =
    options.sort === 'price_asc'
      ? sql`effective_price ASC`
      : options.sort === 'price_desc'
        ? sql`effective_price DESC`
        : options.sort === 'newest'
          ? sql`p.created_at DESC`
          : sql`score DESC, p.sold_count DESC`;

  const result = await db.execute(sql`
    SELECT ${CARD_SQL}, ${score} AS score, count(*) OVER() AS total_count
    FROM (
      SELECT p.*,
        CASE WHEN (
          p.promo_price IS NOT NULL AND p.promo_price > 0 AND p.promo_price < p.price
          AND (p.promo_starts_at IS NULL OR p.promo_starts_at <= now())
          AND (p.promo_ends_at IS NULL OR p.promo_ends_at >= now())
        ) THEN p.promo_price ELSE p.price END AS effective_price,
        (
          p.promo_price IS NOT NULL AND p.promo_price > 0 AND p.promo_price < p.price
          AND (p.promo_starts_at IS NULL OR p.promo_starts_at <= now())
          AND (p.promo_ends_at IS NULL OR p.promo_ends_at >= now())
        ) AS on_promo
      FROM products p
    ) p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN LATERAL (
      SELECT url, alt, width, height FROM product_images
      WHERE product_id = p.id ORDER BY position ASC, created_at ASC LIMIT 1
    ) pi ON true
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `);

  const rows = result.rows as Record<string, unknown>[];
  const total = rows[0] ? Number(rows[0].total_count) : 0;
  const exact = rows.some((r) => Number(r.score) >= 300);

  return {
    items: rows.map((row) => {
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
        discountPercent: row.on_promo && price > 0 ? Math.round(((price - effectivePrice) / price) * 100) : 0,
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
        score: Math.round(Number(row.score) * 100) / 100,
      };
    }),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    query,
    usedFuzzy: fuzzyCapable && !exact,
  };
}

export type Suggestion = {
  kind: 'product' | 'category' | 'brand';
  label: string;
  href: string;
  imageUrl?: string | null;
  price?: string | null;
};

/** Suggestions affichées pendant la saisie (produits, catégories, marques). */
export async function suggest(rawQuery: string, limit = 8): Promise<Suggestion[]> {
  const query = normalizeText(rawQuery);
  if (query.length < 2) return [];

  const like = `%${query}%`;
  const prefix = `${query}%`;

  // Type-ahead : « differentiel 40 » ou « poignee bronze » doivent déjà proposer
  // des résultats pendant la frappe. On exige que chaque mot saisi (2 lettres et
  // plus) apparaisse dans le texte de recherche, sans imposer qu'ils se suivent.
  const tokens = query.split(' ').filter((word) => word.length >= 2);
  const productMatch =
    tokens.length > 1
      ? sql`(${sql.join(
          tokens.map((word) => sql`(p.search_text LIKE ${`%${word}%`} OR lower(p.sku) LIKE ${`%${word}%`})`),
          sql` AND `,
        )})`
      : sql`(p.search_text LIKE ${like} OR lower(p.sku) LIKE ${like} OR similarity(p.search_text, ${query}) > 0.25)`;

  const rows = await db.execute(sql`
    (
      SELECT 'product' AS kind, p.name AS label, '/produit/' || p.slug AS href,
             (SELECT url FROM product_images WHERE product_id = p.id ORDER BY position LIMIT 1) AS image_url,
             p.price::text AS price,
             CASE
               WHEN lower(p.name) LIKE ${prefix} THEN 1
               WHEN lower(p.sku) LIKE ${prefix} THEN 2
               ELSE 3
             END AS rank
      FROM products p
      WHERE p.is_active = true AND p.is_archived = false
        AND ${productMatch}
      ORDER BY rank ASC, p.sold_count DESC
      LIMIT ${limit}
    )
    UNION ALL
    (
      SELECT 'category', c.name, '/categorie/' || c.slug, c.image_url, NULL,
             CASE WHEN lower(c.name) LIKE ${prefix} THEN 1 ELSE 3 END
      FROM categories c
      WHERE c.is_active = true AND (lower(c.name) LIKE ${like} OR similarity(lower(c.name), ${query}) > 0.3)
      LIMIT 4
    )
    UNION ALL
    (
      SELECT 'brand', b.name, '/catalogue?brand=' || b.slug, b.logo_url, NULL,
             CASE WHEN lower(b.name) LIKE ${prefix} THEN 1 ELSE 3 END
      FROM brands b
      WHERE b.is_active = true AND (lower(b.name) LIKE ${like} OR similarity(lower(b.name), ${query}) > 0.35)
      LIMIT 4
    )
    ORDER BY rank ASC
    LIMIT ${limit}
  `);

  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    kind: r.kind as Suggestion['kind'],
    label: String(r.label),
    href: String(r.href),
    imageUrl: (r.image_url as string | null) ?? null,
    price: (r.price as string | null) ?? null,
  }));
}
