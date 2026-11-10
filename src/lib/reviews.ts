import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  orderReviews,
  orderItems,
  orders,
  productReviews,
  products,
  reviewStatusEnum,
  type OrderReview,
  type ProductReview,
} from '../db/schema';
import { newId } from './utils';
import { normalizeIvorianPhone } from './staff-access';
import type { SessionUser } from './auth';
import {
  clampRating,
  emptyRatingSummary,
  publicAuthorName,
  summarizeRatings,
  validateReviewInput,
  type OrderReviewContext,
  type PublicProductReview,
  type RatingSummary,
  type ReviewableItem,
  type ReviewStatus,
} from './review-shared';

/**
 * Avis clients — produits et livraison.
 *
 * Trois idées tiennent tout le module :
 *
 * 1. **Pas d'achat, pas d'avis.** Un avis n'existe que sur une commande
 *    `DELIVERED` et, pour un article, que s'il figure dans cette commande. Le
 *    client retrouve ses formulaires en ouvrant son suivi avec son numéro de
 *    commande : pas de compte à créer, pas de preuve à fournir.
 *
 * 2. **Rien n'est public sans relecture.** Un avis naît `PENDING`. Il n'entre
 *    dans la moyenne d'une fiche produit qu'une fois `PUBLISHED` par l'équipe :
 *    sur une boutique ivoirienne à faible volume, un seul message injurieux
 *    affiché en page d'accueil coûte plus cher que deux jours de modération.
 *
 * 3. **Le client peut corriger.** Tant qu'il n'est pas publié, il peut réécrire
 *    son avis ; une fois publié, une nouvelle version repasse en relecture.
 *
 * Les helpers purs (moyennes, validation, nom publié) vivent dans
 * `src/lib/review-shared.ts` : ce fichier-ci ouvre une connexion PostgreSQL et
 * ne doit jamais être importé par un composant client.
 */

export { clampRating, emptyRatingSummary, publicAuthorName, summarizeRatings, validateReviewInput };
export type { OrderReviewContext, PublicProductReview, RatingSummary, ReviewStatus };

// L'énumération PostgreSQL reste la source de vérité côté serveur ; on vérifie
// ici qu'elle n'a pas divergé du miroir utilisé par l'interface.
export const REVIEW_STATUSES: readonly ReviewStatus[] = reviewStatusEnum.enumValues;

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: 'À relire',
  PUBLISHED: 'Publié',
  HIDDEN: 'Masqué',
};

export class ReviewError extends Error {
  constructor(
    message: string,
    public code: 'NOT_DELIVERED' | 'NOT_IN_ORDER' | 'ALREADY_REVIEWED' | 'INVALID' | 'NOT_FOUND',
  ) {
    super(message);
  }
}

// ─────────────────────────────── Lecture côté boutique ───────────────────────────────

/** Avis publiés d'un article, du plus utile au plus ancien. */
export async function publishedReviewsForProduct(productId: string, limit = 20): Promise<PublicProductReview[]> {
  const rows = await db
    .select({
      id: productReviews.id,
      authorName: productReviews.authorName,
      rating: productReviews.rating,
      title: productReviews.title,
      comment: productReviews.comment,
      createdAt: productReviews.createdAt,
      reply: productReviews.reply,
      repliedAt: productReviews.repliedAt,
    })
    .from(productReviews)
    .where(and(eq(productReviews.productId, productId), eq(productReviews.status, 'PUBLISHED')))
    .orderBy(desc(productReviews.createdAt))
    .limit(limit);
  return rows;
}

/** Note moyenne d'un article (uniquement les avis publiés). */
export async function productRatingSummary(productId: string): Promise<RatingSummary> {
  const rows = await db
    .select({ rating: productReviews.rating })
    .from(productReviews)
    .where(and(eq(productReviews.productId, productId), eq(productReviews.status, 'PUBLISHED')));
  return summarizeRatings(rows.map((row) => row.rating));
}

/**
 * Notes de plusieurs articles en une requête (rails, résultats de recherche).
 * Les articles sans avis sont absents de la Map : l'appelant affiche alors
 * simplement rien, ce qui est le cas le plus fréquent au démarrage.
 */
export async function productRatingSummaries(productIds: readonly string[]): Promise<Map<string, RatingSummary>> {
  const result = new Map<string, RatingSummary>();
  if (productIds.length === 0) return result;

  const rows = await db
    .select({ productId: productReviews.productId, rating: productReviews.rating })
    .from(productReviews)
    .where(and(eq(productReviews.status, 'PUBLISHED'), inArray(productReviews.productId, [...productIds])));

  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const list = grouped.get(row.productId) ?? [];
    list.push(row.rating);
    grouped.set(row.productId, list);
  }
  for (const [productId, ratings] of grouped) result.set(productId, summarizeRatings(ratings));
  return result;
}

/** Avis livraison publiés (page d'accueil, page /livraison). */
export async function publishedDeliveryReviews(limit = 6): Promise<OrderReview[]> {
  return db
    .select()
    .from(orderReviews)
    .where(eq(orderReviews.status, 'PUBLISHED'))
    .orderBy(desc(orderReviews.createdAt))
    .limit(limit);
}

/** Note moyenne du service de livraison — c'est la promesse que la boutique met en avant. */
export async function deliveryRatingSummary(): Promise<RatingSummary> {
  const rows = await db.select({ rating: orderReviews.rating }).from(orderReviews).where(eq(orderReviews.status, 'PUBLISHED'));
  return summarizeRatings(rows.map((row) => row.rating));
}

// ─────────────────────────────── Côté client : ce qu'il reste à noter ───────────────────────────────

/**
 * Ce que le client peut noter sur une commande donnée.
 *
 * La fonction ne prend pas de décision d'accès : elle reçoit un `orderId` dont
 * l'appelant a déjà vérifié qu'il appartient au client (compte connecté ou
 * jeton de suivi). Elle indique seulement ce qui est ouvert à l'avis.
 */
export async function reviewContextForOrder(orderId: string): Promise<OrderReviewContext | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;

  const [items, reviews, delivery] = await Promise.all([
    db
      .select({
        productId: orderItems.productId,
        name: orderItems.nameSnapshot,
        imageUrl: orderItems.imageSnapshot,
        slug: products.slug,
      })
      .from(orderItems)
      .leftJoin(products, eq(products.id, orderItems.productId))
      .where(eq(orderItems.orderId, orderId)),
    db.select().from(productReviews).where(eq(productReviews.orderId, orderId)),
    db.select().from(orderReviews).where(eq(orderReviews.orderId, orderId)).limit(1),
  ]);

  const byProduct = new Map(reviews.map((review) => [review.productId, review]));
  const delivered = order.status === 'DELIVERED';

  const reviewableItems: ReviewableItem[] = items
    .filter((item) => Boolean(item.productId))
    .map((item) => {
      const review = byProduct.get(item.productId as string);
      return {
        productId: item.productId as string,
        name: item.name,
        imageUrl: item.imageUrl,
        slug: item.slug,
        review: review
          ? {
              id: review.id,
              rating: review.rating,
              comment: review.comment,
              status: review.status,
              createdAt: review.createdAt,
            }
          : null,
      };
    });

  const deliveryReview = delivery[0]
    ? {
        id: delivery[0].id,
        rating: delivery[0].rating,
        comment: delivery[0].comment,
        onTime: delivery[0].onTime,
        status: delivery[0].status,
      }
    : null;

  // `pending` ne sert qu'à l'affichage : la boutique met le bloc en avant tant
  // qu'il manque une note, puis n'en parle plus.
  const pending =
    delivered && (reviewableItems.some((item) => !item.review) || !deliveryReview);

  return {
    orderId: order.id,
    orderNumber: order.number,
    delivered,
    deliveredAt: order.deliveredAt,
    items: reviewableItems,
    deliveryReview,
    pending,
  };
}

// ─────────────────────────────── Dépôt d'un avis ───────────────────────────────

/** Contexte minimal pour retrouver l'auteur d'un avis sans compte. */
async function orderBelongsTo(params: { orderId: string; orderNumber?: string; token?: string | null }) {
  const [order] = await db.select().from(orders).where(eq(orders.id, params.orderId)).limit(1);
  if (!order) throw new ReviewError('Commande introuvable.', 'NOT_FOUND');
  if (order.number !== params.orderNumber) throw new ReviewError('Commande introuvable.', 'NOT_FOUND');
  if (params.token && order.accessToken !== params.token) throw new ReviewError('Commande introuvable.', 'NOT_FOUND');
  if (order.status !== 'DELIVERED') {
    throw new ReviewError(
      'Vous pourrez donner votre avis dès que la commande sera livrée.',
      'NOT_DELIVERED',
    );
  }
  return order;
}

export async function submitProductReview(params: {
  orderId: string;
  orderNumber: string;
  token?: string | null;
  productId: string;
  rating: number;
  comment?: string | null;
  title?: string | null;
  authorName?: string | null;
  userId?: string | null;
}): Promise<{ id: string; status: ReviewStatus }> {
  const order = await orderBelongsTo({ orderId: params.orderId, orderNumber: params.orderNumber, token: params.token });

  const valid = validateReviewInput({ rating: params.rating, comment: params.comment });
  if (!valid.ok) throw new ReviewError(valid.message, 'INVALID');

  const [line] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, order.id), eq(orderItems.productId, params.productId)))
    .limit(1);
  if (!line) throw new ReviewError('Cet article ne figure pas dans cette commande.', 'NOT_IN_ORDER');

  const existing = await db
    .select({ id: productReviews.id })
    .from(productReviews)
    .where(and(eq(productReviews.orderId, order.id), eq(productReviews.productId, params.productId)))
    .limit(1);

  const phone = normalizeIvorianPhone(order.phone);
  const authorName =
    (params.authorName ?? '').trim().slice(0, 60) ||
    publicAuthorName(order.customerFirstName, order.customerLastName);
  const title = (params.title ?? '').trim().slice(0, 120) || null;

  if (existing[0]) {
    // Réécriture : on repart en relecture pour que l'équipe voie la nouvelle version.
    await db
      .update(productReviews)
      .set({
        rating: valid.rating,
        comment: valid.comment,
        title,
        authorName,
        status: 'PENDING',
        updatedAt: new Date(),
      })
      .where(eq(productReviews.id, existing[0].id));
    return { id: existing[0].id, status: 'PENDING' };
  }

  const id = newId('rev_');
  await db.insert(productReviews).values({
    id,
    productId: params.productId,
    orderId: order.id,
    orderItemId: line.id,
    userId: order.userId ?? params.userId ?? null,
    phoneNormalized: phone.ok ? phone.canonical : null,
    authorName,
    rating: valid.rating,
    title,
    comment: valid.comment,
    status: 'PENDING',
  });
  return { id, status: 'PENDING' };
}

export async function submitDeliveryReview(params: {
  orderId: string;
  orderNumber: string;
  token?: string | null;
  rating: number;
  comment?: string | null;
  onTime?: boolean | null;
}): Promise<{ id: string; status: ReviewStatus }> {
  const order = await orderBelongsTo({ orderId: params.orderId, orderNumber: params.orderNumber, token: params.token });

  const valid = validateReviewInput({ rating: params.rating, comment: params.comment });
  if (!valid.ok) throw new ReviewError(valid.message, 'INVALID');

  const phone = normalizeIvorianPhone(order.phone);
  const existing = await db
    .select({ id: orderReviews.id })
    .from(orderReviews)
    .where(eq(orderReviews.orderId, order.id))
    .limit(1);

  const values = {
    rating: valid.rating,
    comment: valid.comment,
    onTime: params.onTime ?? null,
    authorName: publicAuthorName(order.customerFirstName, order.customerLastName),
    status: 'PENDING' as ReviewStatus,
  };

  if (existing[0]) {
    await db
      .update(orderReviews)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(orderReviews.id, existing[0].id));
    return { id: existing[0].id, status: 'PENDING' };
  }

  const id = newId('orev_');
  await db.insert(orderReviews).values({
    id,
    orderId: order.id,
    userId: order.userId ?? null,
    phoneNormalized: phone.ok ? phone.canonical : null,
    ...values,
  });
  return { id, status: 'PENDING' };
}

// ─────────────────────────────── Modération (administration) ───────────────────────────────

export async function listProductReviewsForAdmin(filters: { status?: string; page?: number; perPage?: number } = {}) {
  const perPage = Math.min(100, Math.max(5, filters.perPage ?? 25));
  const page = Math.max(1, filters.page ?? 1);
  const status = REVIEW_STATUSES.includes(filters.status as ReviewStatus) ? (filters.status as ReviewStatus) : null;

  const where = status ? eq(productReviews.status, status) : sql`1 = 1`;

  const [rows, counts] = await Promise.all([
    db
      .select({
        review: productReviews,
        productName: products.name,
        productSlug: products.slug,
      })
      .from(productReviews)
      .leftJoin(products, eq(products.id, productReviews.productId))
      .where(where)
      .orderBy(desc(productReviews.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db
      .select({ status: productReviews.status, count: sql<number>`count(*)::int` })
      .from(productReviews)
      .groupBy(productReviews.status),
  ]);

  const byStatus: Record<string, number> = { PENDING: 0, PUBLISHED: 0, HIDDEN: 0 };
  for (const row of counts) byStatus[row.status] = row.count;

  return { rows, byStatus, page, perPage, total: Object.values(byStatus).reduce((a, b) => a + b, 0) };
}

export async function listOrderReviewsForAdmin(filters: { status?: string; page?: number; perPage?: number } = {}) {
  const perPage = Math.min(100, Math.max(5, filters.perPage ?? 25));
  const page = Math.max(1, filters.page ?? 1);
  const status = REVIEW_STATUSES.includes(filters.status as ReviewStatus) ? (filters.status as ReviewStatus) : null;
  const where = status ? eq(orderReviews.status, status) : sql`1 = 1`;

  const [rows, counts] = await Promise.all([
    db
      .select({ review: orderReviews, orderNumber: orders.number, city: orders.city })
      .from(orderReviews)
      .leftJoin(orders, eq(orders.id, orderReviews.orderId))
      .where(where)
      .orderBy(desc(orderReviews.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db
      .select({ status: orderReviews.status, count: sql<number>`count(*)::int` })
      .from(orderReviews)
      .groupBy(orderReviews.status),
  ]);

  const byStatus: Record<string, number> = { PENDING: 0, PUBLISHED: 0, HIDDEN: 0 };
  for (const row of counts) byStatus[row.status] = row.count;
  return { rows, byStatus, page, perPage, total: Object.values(byStatus).reduce((a, b) => a + b, 0) };
}

/** Combien d'avis attendent une relecture (badge de navigation). */
export async function pendingReviewCount(): Promise<number> {
  const [product, delivery] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(productReviews).where(eq(productReviews.status, 'PENDING')),
    db.select({ count: sql<number>`count(*)::int` }).from(orderReviews).where(eq(orderReviews.status, 'PENDING')),
  ]);
  return (product[0]?.count ?? 0) + (delivery[0]?.count ?? 0);
}

export type ReviewModeration = {
  kind: 'product' | 'delivery';
  id: string;
  status: ReviewStatus;
  reply?: string | null;
  actor?: SessionUser | null;
};

/**
 * Publier / masquer un avis, et y répondre.
 *
 * L'action est idempotente : republier un avis déjà publié ne change rien et ne
 * lève pas d'erreur (deux personnes de l'équipe peuvent cliquer en même temps).
 */
export async function moderateReview(params: ReviewModeration): Promise<ProductReview | OrderReview> {
  const table = params.kind === 'product' ? productReviews : orderReviews;
  const reply = params.reply === undefined ? undefined : (params.reply ?? '').trim() || null;

  const patch: Record<string, unknown> = { status: params.status, updatedAt: new Date() };
  if (reply !== undefined) {
    patch.reply = reply;
    patch.repliedAt = reply ? new Date() : null;
    patch.repliedBy = reply ? (params.actor?.id ?? null) : null;
  }

  const [row] = await db.update(table).set(patch).where(eq(table.id, params.id)).returning();
  if (!row) throw new ReviewError('Avis introuvable.', 'NOT_FOUND');
  return row;
}

/** Note moyenne par article, pour le tableau de bord du catalogue. */
export async function topRatedProducts(limit = 5) {
  const rows = await db
    .select({
      productId: productReviews.productId,
      name: products.name,
      slug: products.slug,
      count: sql<number>`count(*)::int`,
      average: sql<number>`round(avg(${productReviews.rating})::numeric, 2)::float8`,
    })
    .from(productReviews)
    .innerJoin(products, eq(products.id, productReviews.productId))
    .where(eq(productReviews.status, 'PUBLISHED'))
    .groupBy(productReviews.productId, products.name, products.slug)
    .having(sql`count(*) >= 1`)
    .orderBy(sql`avg(${productReviews.rating}) DESC`)
    .limit(limit);
  return rows;
}

export type { ProductReview, OrderReview };
