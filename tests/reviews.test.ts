import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { orderReviews, productReviews, users } from '@/db/schema';
import { confirmPayment, createOrder, transitionOrder } from '@/lib/orders';
import {
  clampRating,
  deliveryRatingSummary,
  emptyRatingSummary,
  moderateReview,
  pendingReviewCount,
  productRatingSummary,
  publicAuthorName,
  publishedReviewsForProduct,
  reviewContextForOrder,
  REVIEW_STATUS_LABELS,
  ReviewError,
  submitDeliveryReview,
  submitProductReview,
  summarizeRatings,
  validateReviewInput,
} from '@/lib/reviews';
import type { CheckoutInput } from '@/lib/validation';
import type { SessionUser } from '@/lib/auth';
import { resetDb, createProduct, createUser, checkoutInput } from './helpers';

let zones: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  zones = await resetDb();
});

function input(overrides: Record<string, unknown>): CheckoutInput {
  return checkoutInput(overrides) as unknown as CheckoutInput;
}

/**
 * Commande livrée : le seul état depuis lequel un avis est possible.
 * Deux articles pour vérifier que chaque avis reste bien rattaché au sien.
 */
async function deliveredOrder(options: { deliver?: boolean } = {}) {
  const drill = await createProduct({ name: 'Perceuse à percussion 800 W', price: '45000', stock: 10 });
  const gloves = await createProduct({ name: 'Gants de manutention', price: '3500', stock: 30 });

  const result = await createOrder({
    input: input({
      items: [
        { productId: drill.id, quantity: 1 },
        { productId: gloves.id, quantity: 2 },
      ],
      deliveryMethod: 'LOCAL_DELIVERY',
      zoneId: zones.localZone.id,
      city: 'Daloa',
      addressLine: 'Quartier Tazibouo',
      paymentMethod: 'WAVE',
    }),
  });

  const owner = await createUser({ email: `owner-${result.order.id}@example.ci`, role: 'OWNER' });
  await confirmPayment({ paymentId: result.paymentId, actor: owner as SessionUser, source: 'MANUAL_REVIEW' });

  if (options.deliver !== false) {
    // Parcours réel : préparée, prête, expédiée, livrée.
    for (const status of ['PREPARING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED'] as const) {
      await transitionOrder({
        orderId: result.order.id,
        to: status,
        actor: owner as SessionUser,
        actorLabel: owner.email,
      });
    }
  }

  return { order: result.order, owner, drill, gloves };
}

describe('avis clients — règles de calcul', () => {
  it('borne la note entre 1 et 5 étoiles', () => {
    expect(clampRating(0)).toBe(0);
    expect(clampRating(3)).toBe(3);
    expect(clampRating(9)).toBe(5);
    expect(clampRating('4')).toBe(4);
    expect(clampRating('abc')).toBe(0);
  });

  it('calcule une moyenne au dixième et la répartition par nombre d’étoiles', () => {
    const summary = summarizeRatings([5, 4, 4, 1]);
    expect(summary.count).toBe(4);
    expect(summary.average).toBe(3.5);
    expect(summary.distribution[5]).toBe(1);
    expect(summary.distribution[4]).toBe(2);
    expect(summary.distribution[1]).toBe(1);
  });

  it('renvoie un résumé vide sans avis', () => {
    expect(summarizeRatings([])).toEqual(emptyRatingSummary());
  });

  it('exige une explication pour une note très basse, pas pour une bonne note', () => {
    expect(validateReviewInput({ rating: 5 }).ok).toBe(true);
    expect(validateReviewInput({ rating: 1, comment: '' }).ok).toBe(false);
    expect(validateReviewInput({ rating: 2, comment: 'bof' }).ok).toBe(false);
    expect(validateReviewInput({ rating: 1, comment: 'La perceuse est arrivée cassée, emballage abîmé.' }).ok).toBe(true);
    expect(validateReviewInput({ rating: 0 }).ok).toBe(false);
  });

  it('n’expose jamais le nom complet du client', () => {
    expect(publicAuthorName('Awa', 'Koné')).toBe('Awa K.');
    expect(publicAuthorName('Awa', null)).toBe('Awa');
    expect(publicAuthorName(null, 'Koné')).toBe('Client K.');
    expect(publicAuthorName(null, null)).toBe('Client Perokado');
  });

  it('a un libellé français pour chaque statut', () => {
    expect(REVIEW_STATUS_LABELS.PENDING).toBe('À relire');
    expect(REVIEW_STATUS_LABELS.PUBLISHED).toBe('Publié');
    expect(REVIEW_STATUS_LABELS.HIDDEN).toBe('Masqué');
  });
});

describe('avis clients — dépôt après livraison', () => {
  it('refuse un avis tant que la commande n’est pas livrée', async () => {
    const { order, drill } = await deliveredOrder({ deliver: false });

    await expect(
      submitProductReview({
        orderId: order.id,
        orderNumber: order.number,
        token: order.accessToken,
        productId: drill.id,
        rating: 5,
      }),
    ).rejects.toThrow(ReviewError);

    const context = await reviewContextForOrder(order.id);
    expect(context?.delivered).toBe(false);
    expect(context?.pending).toBe(false);
    expect(context?.items).toHaveLength(2);
    expect(context?.items.every((item) => item.review === null)).toBe(true);
  });

  it('enregistre un avis vérifié, en attente de relecture, sans publier la note', async () => {
    const { order, drill } = await deliveredOrder();

    const result = await submitProductReview({
      orderId: order.id,
      orderNumber: order.number,
      token: order.accessToken,
      productId: drill.id,
      rating: 4,
      title: 'Conforme à la photo',
      comment: 'Perceuse reçue en deux jours à Daloa, fonctionne très bien.',
    });

    expect(result.status).toBe('PENDING');

    const [row] = await db.select().from(productReviews).where(eq(productReviews.id, result.id));
    expect(row.rating).toBe(4);
    expect(row.authorName).toBe('Awa K.');
    expect(row.phoneNormalized).toBe('+2250701020304');
    expect(row.status).toBe('PENDING');

    // Un avis non relu n'entre ni dans la moyenne ni dans la liste publique.
    const summary = await productRatingSummary(drill.id);
    expect(summary.count).toBe(0);
    expect(await publishedReviewsForProduct(drill.id)).toHaveLength(0);

    // Le contexte de suivi, lui, montre l'avis au client avec son statut.
    const context = await reviewContextForOrder(order.id);
    const item = context?.items.find((entry) => entry.productId === drill.id);
    expect(item?.review?.status).toBe('PENDING');
    expect(item?.review?.rating).toBe(4);
  });

  it('refuse un article qui n’est pas dans la commande', async () => {
    const { order } = await deliveredOrder();
    const other = await createProduct({ name: 'Article jamais commandé' });

    await expect(
      submitProductReview({
        orderId: order.id,
        orderNumber: order.number,
        token: order.accessToken,
        productId: other.id,
        rating: 5,
      }),
    ).rejects.toMatchObject({ code: 'NOT_IN_ORDER' });
  });

  it('refuse un mauvais jeton de suivi (l’avis reste rattaché à un achat réel)', async () => {
    const { order, drill } = await deliveredOrder();

    await expect(
      submitProductReview({
        orderId: order.id,
        orderNumber: order.number,
        token: 'jeton-inventé',
        productId: drill.id,
        rating: 5,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('ne permet qu’un seul avis par article : le second le corrige', async () => {
    const { order, drill } = await deliveredOrder();

    const first = await submitProductReview({
      orderId: order.id,
      orderNumber: order.number,
      token: order.accessToken,
      productId: drill.id,
      rating: 2,
      comment: 'La perceuse chauffe beaucoup après dix minutes.',
    });

    // L'équipe publie, le client change d'avis : la nouvelle version repasse en relecture.
    await moderateReview({ kind: 'product', id: first.id, status: 'PUBLISHED' });

    const second = await submitProductReview({
      orderId: order.id,
      orderNumber: order.number,
      token: order.accessToken,
      productId: drill.id,
      rating: 5,
      comment: 'Après réglage du mandrin, elle fonctionne parfaitement.',
    });

    expect(second.id).toBe(first.id);

    const rows = await db.select().from(productReviews).where(eq(productReviews.orderId, order.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe(5);
    expect(rows[0].status).toBe('PENDING');
  });

  it('évalue aussi la livraison, une fois par commande', async () => {
    const { order } = await deliveredOrder();

    const first = await submitDeliveryReview({
      orderId: order.id,
      orderNumber: order.number,
      token: order.accessToken,
      rating: 5,
      comment: 'Le livreur a appelé avant de passer.',
      onTime: true,
    });
    expect(first.status).toBe('PENDING');

    const second = await submitDeliveryReview({
      orderId: order.id,
      orderNumber: order.number,
      token: order.accessToken,
      rating: 3,
      comment: 'Deux jours de retard sur la promesse.',
      onTime: false,
    });
    expect(second.id).toBe(first.id);

    const rows = await db.select().from(orderReviews).where(eq(orderReviews.orderId, order.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe(3);
    expect(rows[0].onTime).toBe(false);

    const context = await reviewContextForOrder(order.id);
    expect(context?.deliveryReview?.rating).toBe(3);
  });

  it('compte ce qu’il reste à noter, puis plus rien une fois tout déposé', async () => {
    const { order, drill, gloves } = await deliveredOrder();

    const before = await reviewContextForOrder(order.id);
    expect(before?.pending).toBe(true);

    await submitDeliveryReview({
      orderId: order.id,
      orderNumber: order.number,
      token: order.accessToken,
      rating: 5,
    });
    await submitProductReview({
      orderId: order.id,
      orderNumber: order.number,
      token: order.accessToken,
      productId: drill.id,
      rating: 5,
    });
    await submitProductReview({
      orderId: order.id,
      orderNumber: order.number,
      token: order.accessToken,
      productId: gloves.id,
      rating: 4,
    });

    const after = await reviewContextForOrder(order.id);
    expect(after?.pending).toBe(false);
    expect(after?.items.filter((item) => item.review)).toHaveLength(2);
    expect(after?.deliveryReview).not.toBeNull();
  });
});

describe('avis clients — publication et moyennes', () => {
  it('fait entrer l’avis publié dans la moyenne et les données structurées', async () => {
    const { order, drill } = await deliveredOrder();
    const review = await submitProductReview({
      orderId: order.id,
      orderNumber: order.number,
      token: order.accessToken,
      productId: drill.id,
      rating: 4,
      comment: 'Bon rapport qualité-prix pour un chantier.',
    });

    expect(await pendingReviewCount()).toBe(1);
    await moderateReview({ kind: 'product', id: review.id, status: 'PUBLISHED' });
    expect(await pendingReviewCount()).toBe(0);

    const summary = await productRatingSummary(drill.id);
    expect(summary.count).toBe(1);
    expect(summary.average).toBe(4);

    const list = await publishedReviewsForProduct(drill.id);
    expect(list).toHaveLength(1);
    expect(list[0].authorName).toBe('Awa K.');
  });

  it('un avis masqué disparaît de la boutique mais reste en base', async () => {
    const { order, drill } = await deliveredOrder();
    const review = await submitProductReview({
      orderId: order.id,
      orderNumber: order.number,
      token: order.accessToken,
      productId: drill.id,
      rating: 1,
      comment: 'Message injurieux que la boutique ne souhaite pas afficher.',
    });

    await moderateReview({ kind: 'product', id: review.id, status: 'PUBLISHED' });
    await moderateReview({ kind: 'product', id: review.id, status: 'HIDDEN' });

    expect(await publishedReviewsForProduct(drill.id)).toHaveLength(0);
    expect((await productRatingSummary(drill.id)).count).toBe(0);

    const [row] = await db.select().from(productReviews).where(eq(productReviews.id, review.id));
    expect(row.status).toBe('HIDDEN');
    // Toujours présent : le client ne peut pas redéposer le même avis.
    expect(row.comment).toContain('injurieux');
  });

  it('publie la réponse de la boutique avec l’avis', async () => {
    const { order, drill, owner } = await deliveredOrder();
    const review = await submitProductReview({
      orderId: order.id,
      orderNumber: order.number,
      token: order.accessToken,
      productId: drill.id,
      rating: 3,
      comment: 'La boîte était ouverte à la réception.',
    });

    await moderateReview({
      kind: 'product',
      id: review.id,
      status: 'PUBLISHED',
      reply: 'Merci pour ce retour : nous vérifions l’emballage avec le transporteur.',
      actor: {
        id: owner.id,
        email: owner.email,
        role: owner.role,
        firstName: owner.firstName,
        lastName: owner.lastName,
        phone: owner.phone,
        staffTask: owner.staffTask,
      },
    });

    const [row] = await db.select().from(productReviews).where(eq(productReviews.id, review.id));
    expect(row.reply).toContain('emballage');
    expect(row.repliedBy).toBe(owner.id);
    expect(row.repliedAt).not.toBeNull();
  });

  it('moyenne les notes de livraison publiées seulement', async () => {
    const first = await deliveredOrder();
    const second = await deliveredOrder();

    const a = await submitDeliveryReview({
      orderId: first.order.id,
      orderNumber: first.order.number,
      token: first.order.accessToken,
      rating: 5,
    });
    await submitDeliveryReview({
      orderId: second.order.id,
      orderNumber: second.order.number,
      token: second.order.accessToken,
      rating: 1,
      comment: 'Colis arrivé trois jours après la date annoncée.',
    });

    // Une seule note publiée : la moyenne ne mélange pas relecture et public.
    await moderateReview({ kind: 'delivery', id: a.id, status: 'PUBLISHED' });
    const summary = await deliveryRatingSummary();
    expect(summary.count).toBe(1);
    expect(summary.average).toBe(5);
  });

  it('rattache l’avis au compte client quand la commande en a un', async () => {
    const customer = await createUser({ email: 'cliente@example.ci' });
    const product = await createProduct({ name: 'Marteau de charpentier', price: '8000', stock: 5 });
    const result = await createOrder({
      userId: customer.id,
      input: input({
        items: [{ productId: product.id, quantity: 1 }],
        zoneId: zones.localZone.id,
        city: 'Daloa',
        paymentMethod: 'WAVE',
      }),
    });
    const owner = await createUser({ email: `owner-${result.order.id}@example.ci`, role: 'OWNER' });
    await confirmPayment({ paymentId: result.paymentId, actor: owner as SessionUser, source: 'MANUAL_REVIEW' });
    for (const status of ['PREPARING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED'] as const) {
      await transitionOrder({ orderId: result.order.id, to: status, actor: owner as SessionUser, actorLabel: owner.email });
    }

    const review = await submitProductReview({
      orderId: result.order.id,
      orderNumber: result.order.number,
      token: result.order.accessToken,
      productId: product.id,
      rating: 5,
    });

    const [row] = await db.select().from(productReviews).where(eq(productReviews.id, review.id));
    expect(row.userId).toBe(customer.id);

    // Supprimer le compte ne supprime pas l'avis : la commande reste la preuve.
    await db.delete(users).where(eq(users.id, customer.id));
    const [afterDelete] = await db.select().from(productReviews).where(eq(productReviews.id, review.id));
    expect(afterDelete.userId).toBeNull();
    expect(afterDelete.rating).toBe(5);
  });
});
