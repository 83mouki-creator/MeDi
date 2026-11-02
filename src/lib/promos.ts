import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { products, promoCampaignProducts, promoCampaigns, type PromoCampaign } from '../db/schema';
import { audit } from './audit';
import type { SessionUser } from './auth';
import { newId, toFcfa } from './utils';

/**
 * Promotions manuelles décidées par la boutique.
 *
 * Une campagne est un lot de produits remisés à la main (« −20 % sur
 * l'outillage jusqu'à dimanche »). Elle écrit directement dans les colonnes
 * `products.promo_price` / `promo_starts_at` / `promo_ends_at` : la vitrine,
 * les fiches produit, le panier et le calcul du prix appliquent donc la
 * promotion immédiatement, sans code parallèle. À l'arrêt, le prix d'avant
 * campagne (conservé dans `promo_campaign_products.base_price`) est rétabli.
 */

export type PromoCampaignType = 'PERCENT' | 'FIXED';

export type PromoInput = {
  name: string;
  bannerText?: string | null;
  type: PromoCampaignType;
  /** Pourcentage (1–90) ou montant FCFA selon `type`. */
  value: number;
  startsAt: Date;
  endsAt: Date;
  productIds: string[];
};

export class PromoError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = 'PromoError';
    this.field = field;
  }
}

/** Prix promotionnel d'un produit, jamais inférieur à 1 FCFA. */
export function computePromoPrice(price: number, type: PromoCampaignType, value: number): number {
  if (type === 'PERCENT') {
    const discounted = Math.round(price * (1 - value / 100));
    return Math.max(1, discounted);
  }
  return Math.max(1, Math.round(price - value));
}

export type CampaignRow = PromoCampaign & {
  productCount: number;
  status: 'ACTIVE' | 'SCHEDULED' | 'ENDED' | 'STOPPED';
};

function statusOf(row: PromoCampaign, now = new Date()): CampaignRow['status'] {
  if (!row.isActive) return 'STOPPED';
  if (row.startsAt > now) return 'SCHEDULED';
  if (row.endsAt < now) return 'ENDED';
  return 'ACTIVE';
}

export async function listPromoCampaigns(limit = 40): Promise<CampaignRow[]> {
  const rows = await db.select().from(promoCampaigns).orderBy(desc(promoCampaigns.startsAt)).limit(limit);
  if (rows.length === 0) return [];
  const counts = await db
    .select({ campaignId: promoCampaignProducts.campaignId, n: sql<number>`count(*)::int` })
    .from(promoCampaignProducts)
    .where(inArray(promoCampaignProducts.campaignId, rows.map((row) => row.id)))
    .groupBy(promoCampaignProducts.campaignId);
  const byId = new Map(counts.map((count) => [count.campaignId, Number(count.n)]));
  return rows.map((row) => ({ ...row, productCount: byId.get(row.id) ?? 0, status: statusOf(row) }));
}

/**
 * Campagne à afficher en bandeau sur la boutique : la plus récente dont la
 * fenêtre est ouverte et qui porte un texte de bandeau.
 */
export async function getActiveBanner(now = new Date()) {
  const rows = await db
    .select()
    .from(promoCampaigns)
    .where(
      and(
        eq(promoCampaigns.isActive, true),
        sql`${promoCampaigns.startsAt} <= ${now}`,
        sql`${promoCampaigns.endsAt} >= ${now}`,
        sql`${promoCampaigns.bannerText} IS NOT NULL`,
        sql`length(trim(${promoCampaigns.bannerText})) > 0`,
      ),
    )
    .orderBy(desc(promoCampaigns.startsAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    text: (row.bannerText ?? '').trim(),
    endsAt: row.endsAt,
  };
}

export async function createPromoCampaign(params: PromoInput & { actor: SessionUser | null }) {
  const { name, type, value, startsAt, endsAt, productIds, actor } = params;

  if (!name.trim() || name.trim().length < 3) throw new PromoError('Donnez un nom à l’opération.', 'name');
  if (!Number.isFinite(value) || value <= 0) throw new PromoError('Indiquez une remise supérieure à zéro.', 'value');
  if (type === 'PERCENT' && value > 90) throw new PromoError('La remise ne peut pas dépasser 90 %.', 'value');
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new PromoError('Vérifiez les dates de l’opération.', 'dates');
  }
  if (endsAt <= startsAt) throw new PromoError('La fin doit être après le début.', 'dates');
  if (productIds.length === 0) throw new PromoError('Choisissez au moins un produit.', 'products');

  const selected = await db
    .select({ id: products.id, price: products.price, name: products.name })
    .from(products)
    .where(inArray(products.id, productIds));
  if (selected.length === 0) throw new PromoError('Ces produits sont introuvables.', 'products');

  const campaignId = newId('prc_');

  await db.transaction(async (tx) => {
    await tx.insert(promoCampaigns).values({
      id: campaignId,
      name: name.trim(),
      bannerText: params.bannerText?.trim() || null,
      type,
      value: String(value),
      startsAt,
      endsAt,
      isActive: true,
      createdByUserId: actor?.id ?? null,
      updatedAt: new Date(),
    });

    for (const product of selected) {
      const base = toFcfa(product.price);
      const promoPrice = computePromoPrice(base, type, value);
      if (promoPrice >= base) continue; // remise nulle : on ne touche pas au prix
      await tx.insert(promoCampaignProducts).values({
        campaignId,
        productId: product.id,
        basePrice: String(base),
        promoPrice: String(promoPrice),
      });
      await tx.execute(sql`
        UPDATE products
        SET promo_price = ${promoPrice},
            promo_starts_at = ${startsAt},
            promo_ends_at = ${endsAt},
            updated_at = now()
        WHERE id = ${product.id}
      `);
    }
  });

  await audit(actor, {
    action: 'promo.created',
    entity: 'promo_campaign',
    entityId: campaignId,
    metadata: { name, type, value, productIds: selected.length, startsAt, endsAt },
  });

  return { id: campaignId, productCount: selected.length };
}

/**
 * Arrête une opération : les produits retrouvent leur prix d'avant campagne.
 * Les prix sont relus dans la base au lieu d'être recalculés, pour ne jamais
 * écraser une remise saisie produit par produit.
 */
export async function stopPromoCampaign(campaignId: string, actor: SessionUser | null) {
  const rows = await db.select().from(promoCampaigns).where(eq(promoCampaigns.id, campaignId)).limit(1);
  const campaign = rows[0];
  if (!campaign) throw new PromoError('Opération introuvable.');
  if (!campaign.isActive) return { alreadyStopped: true };

  const items = await db
    .select()
    .from(promoCampaignProducts)
    .where(eq(promoCampaignProducts.campaignId, campaignId));

  await db.transaction(async (tx) => {
    await tx
      .update(promoCampaigns)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(promoCampaigns.id, campaignId));

    for (const item of items) {
      await tx.execute(sql`
        UPDATE products
        SET promo_price = NULL,
            promo_starts_at = NULL,
            promo_ends_at = NULL,
            updated_at = now()
        WHERE id = ${item.productId}
          AND promo_price = ${item.promoPrice}
      `);
    }
  });

  await audit(actor, {
    action: 'promo.stopped',
    entity: 'promo_campaign',
    entityId: campaignId,
    metadata: { name: campaign.name, products: items.length },
  });

  return { alreadyStopped: false, productCount: items.length };
}

/** Produits proposés dans le formulaire (recherche simple, 200 max). */
export async function promoProductChoices(query = '') {
  const like = `%${query.trim().toLowerCase()}%`;
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      price: products.price,
      promoPrice: products.promoPrice,
      stock: products.stock,
    })
    .from(products)
    .where(
      query.trim()
        ? sql`(lower(${products.name}) LIKE ${like} OR lower(${products.sku}) LIKE ${like})`
        : sql`true`,
    )
    .orderBy(asc(products.name))
    .limit(200);
  return rows.map((row) => ({
    ...row,
    price: toFcfa(row.price),
    promoPrice: row.promoPrice === null ? null : toFcfa(row.promoPrice),
  }));
}

/** Produits d'une campagne, pour l'écran d'administration. */
export async function promoCampaignProducts_(campaignId: string) {
  return db
    .select({
      productId: promoCampaignProducts.productId,
      name: products.name,
      basePrice: promoCampaignProducts.basePrice,
      promoPrice: promoCampaignProducts.promoPrice,
    })
    .from(promoCampaignProducts)
    .innerJoin(products, eq(products.id, promoCampaignProducts.productId))
    .where(eq(promoCampaignProducts.campaignId, campaignId));
}
