import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db } from '../db';
import { productStickers, products, stickers, type StickerIcon, type StickerTone } from '../db/schema';

/**
 * Stickers produit — accès aux données (serveur uniquement).
 *
 * Règles portées par ce module (et vérifiées par les tests) :
 *  • au plus **deux stickers** par produit (contrainte aussi posée en base) ;
 *  • un sticker n'est visible que s'il est actif **et** dans sa fenêtre de dates ;
 *  • la boutique publique ne reçoit que les stickers visibles, jamais la fiche
 *    technique complète (dates, identifiants internes).
 *
 * Les constantes d'affichage (teintes, symboles, limite, libellés) vivent dans
 * `@/lib/sticker-constants`, sans dépendance à la base : les composants clients
 * peuvent les importer sans embarquer PostgreSQL dans le navigateur.
 */

export {
  MAX_STICKERS_PER_PRODUCT,
  STICKER_ICONS,
  STICKER_ICON_LABELS,
  STICKER_TONES,
  STICKER_TONE_CLASSES,
  STICKER_TONE_LABELS,
  isStickerLive,
  type StickerRecord,
  type StickerView,
} from './sticker-constants';

import { MAX_STICKERS_PER_PRODUCT, isStickerLive, type StickerRecord, type StickerView } from './sticker-constants';

const LIVE_CONDITION: SQL = sql`(
  ps_sticker.is_active = true
  AND (ps_sticker.starts_at IS NULL OR ps_sticker.starts_at <= now())
  AND (ps_sticker.ends_at IS NULL OR ps_sticker.ends_at >= now())
)`;

/**
 * Stickers visibles pour une liste de produits, en une seule requête.
 * Retourne `Map<productId, StickerView[]>` (0 à 2 entrées par produit).
 */
export async function stickersForProducts(productIds: string[], now = new Date()): Promise<Map<string, StickerView[]>> {
  const result = new Map<string, StickerView[]>();
  if (productIds.length === 0) return result;

  const rows = await db.execute(sql`
    SELECT ps.product_id, ps.position, s.id, s.label, s.detail, s.tone::text AS tone, s.icon::text AS icon,
      s.is_active, s.starts_at, s.ends_at
    FROM product_stickers ps
    JOIN stickers s ON s.id = ps.sticker_id
    WHERE ps.product_id IN (${sql.join(productIds.map((id) => sql`${id}`), sql`, `)})
    ORDER BY ps.position ASC, s.created_at ASC
  `);

  for (const row of rows.rows as Record<string, unknown>[]) {
    const live = isStickerLive(
      {
        isActive: Boolean(row.is_active),
        startsAt: (row.starts_at as string | null) ?? null,
        endsAt: (row.ends_at as string | null) ?? null,
      },
      now,
    );
    if (!live) continue;
    const productId = String(row.product_id);
    const list = result.get(productId) ?? [];
    if (list.length >= MAX_STICKERS_PER_PRODUCT) continue;
    list.push({
      id: String(row.id),
      label: String(row.label),
      detail: (row.detail as string | null) ?? null,
      tone: (row.tone as StickerTone) ?? 'GOLD',
      icon: (row.icon as StickerIcon) ?? 'none',
      position: Number(row.position),
    });
    result.set(productId, list);
  }
  return result;
}

/** Stickers visibles d'un seul produit. */
export async function stickersForProduct(productId: string, now = new Date()): Promise<StickerView[]> {
  const map = await stickersForProducts([productId], now);
  return map.get(productId) ?? [];
}

/**
 * Stickers d'un produit pour l'administration : toutes les affectations, y
 * compris celles dont la fenêtre est terminée (le propriétaire doit pouvoir les
 * corriger).
 */
export async function allStickersOfProduct(productId: string) {
  const rows = await db
    .select({
      stickerId: productStickers.stickerId,
      position: productStickers.position,
      label: stickers.label,
      detail: stickers.detail,
      tone: stickers.tone,
      icon: stickers.icon,
      startsAt: stickers.startsAt,
      endsAt: stickers.endsAt,
      isActive: stickers.isActive,
    })
    .from(productStickers)
    .innerJoin(stickers, eq(stickers.id, productStickers.stickerId))
    .where(eq(productStickers.productId, productId))
    .orderBy(asc(productStickers.position));
  return rows;
}

/** Catalogue des stickers, avec le nombre de produits concernés. */
export async function listStickers(activeOnly = false): Promise<StickerRecord[]> {
  const rows = await db.execute(sql`
    SELECT s.id, s.label, s.detail, s.tone::text AS tone, s.icon::text AS icon,
      s.starts_at, s.ends_at, s.is_active,
      (SELECT count(*)::int FROM product_stickers ps WHERE ps.sticker_id = s.id) AS product_count
    FROM stickers s
    ${activeOnly ? sql`WHERE s.is_active = true` : sql``}
    ORDER BY s.is_active DESC, s.created_at DESC
  `);
  return (rows.rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    label: String(row.label),
    detail: (row.detail as string | null) ?? null,
    tone: (row.tone as StickerTone) ?? 'GOLD',
    icon: (row.icon as StickerIcon) ?? 'none',
    startsAt: row.starts_at ? new Date(row.starts_at as string) : null,
    endsAt: row.ends_at ? new Date(row.ends_at as string) : null,
    isActive: Boolean(row.is_active),
    productCount: Number(row.product_count ?? 0),
  }));
}

/**
 * Applique un sticker à une sélection de produits.
 *
 * `mode = 'replace'` remplace les stickers existants ; `mode = 'add'` ajoute en
 * respectant la limite de deux. Retourne le nombre de produits effectivement
 * modifiés et ceux ignorés faute de place.
 */
export async function applyStickerToProducts(params: {
  stickerId: string;
  productIds: string[];
  mode: 'add' | 'replace';
}): Promise<{ applied: number; skipped: number }> {
  const unique = [...new Set(params.productIds.filter(Boolean))];
  if (unique.length === 0) return { applied: 0, skipped: 0 };

  const existing = await db
    .select({ productId: productStickers.productId, stickerId: productStickers.stickerId, position: productStickers.position })
    .from(productStickers)
    .where(inArray(productStickers.productId, unique));

  const byProduct = new Map<string, { stickerId: string; position: number }[]>();
  for (const row of existing) {
    const list = byProduct.get(row.productId) ?? [];
    list.push({ stickerId: row.stickerId, position: row.position });
    byProduct.set(row.productId, list);
  }

  let applied = 0;
  let skipped = 0;
  for (const productId of unique) {
    const current = byProduct.get(productId) ?? [];
    if (current.some((entry) => entry.stickerId === params.stickerId)) {
      applied += 1; // déjà en place : rien à faire
      continue;
    }

    if (params.mode === 'replace') {
      await db.delete(productStickers).where(eq(productStickers.productId, productId));
      await db.insert(productStickers).values({ productId, stickerId: params.stickerId, position: 0 });
      applied += 1;
      continue;
    }

    if (current.length >= MAX_STICKERS_PER_PRODUCT) {
      skipped += 1;
      continue;
    }
    const freePosition = [0, 1].find((position) => !current.some((entry) => entry.position === position)) ?? 0;
    await db.insert(productStickers).values({ productId, stickerId: params.stickerId, position: freePosition });
    applied += 1;
  }

  return { applied, skipped };
}

/** Retire un sticker d'un produit. */
export async function removeStickerFromProduct(productId: string, stickerId: string) {
  await db
    .delete(productStickers)
    .where(and(eq(productStickers.productId, productId), eq(productStickers.stickerId, stickerId)));
}

/**
 * Enregistre l'ordre des stickers d'un produit (case de gauche / de droite).
 * Les identifiants inconnus sont ignorés.
 */
export async function setProductStickers(productId: string, stickerIds: string[]) {
  const cleaned = [...new Set(stickerIds.filter(Boolean))].slice(0, MAX_STICKERS_PER_PRODUCT);
  await db.delete(productStickers).where(eq(productStickers.productId, productId));
  for (const [position, stickerId] of cleaned.entries()) {
    await db.insert(productStickers).values({ productId, stickerId, position });
  }
}

/** Produits d'une sélection rapide (recherche par nom ou référence). */
export async function searchProductIds(query: string, limit = 40) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const like = `%${trimmed.toLowerCase()}%`;
  const rows = await db
    .select({ id: products.id, name: products.name, sku: products.sku })
    .from(products)
    .where(
      and(
        eq(products.isArchived, false),
        sql`(lower(${products.name}) LIKE ${like} OR lower(${products.sku}) LIKE ${like})`,
      ),
    )
    .limit(limit);
  return rows;
}

/** Condition SQL réutilisable : produits portant au moins un sticker visible. */
export function hasLiveStickerCondition(alias = 'p'): SQL {
  return sql`EXISTS (
    SELECT 1 FROM product_stickers ps
    JOIN stickers ps_sticker ON ps_sticker.id = ps.sticker_id
    WHERE ps.product_id = ${sql.raw(alias)}.id AND ${LIVE_CONDITION}
  )`;
}
