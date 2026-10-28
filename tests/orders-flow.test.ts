import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { orders, payments } from '@/db/schema';
import {
  createOrder,
  confirmPayment,
  ensureOrderAccess,
  expireReservations,
  getOrderDetails,
  rejectPayment,
  submitPaymentReference,
  transitionOrder,
} from '@/lib/orders';
import type { CheckoutInput } from '@/lib/validation';
import type { SessionUser } from '@/lib/auth';
import { resetDb, createProduct, createUser, productState, checkoutInput } from './helpers';

let zones: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  zones = await resetDb();
});

function input(overrides: Record<string, unknown>): CheckoutInput {
  return checkoutInput(overrides) as unknown as CheckoutInput;
}

function adminActor(user: { id: string; email: string; role: string; firstName: string | null; lastName: string | null; phone: string | null }): SessionUser {
  return user as SessionUser;
}

async function orderForCarrier(paymentMethod: 'WAVE' | 'CASH_ON_DELIVERY' = 'WAVE') {
  const product = await createProduct({ name: 'Tôle bac 0,40 mm', price: '12000', stock: 20 });
  const result = await createOrder({
    input: input({
      items: [{ productId: product.id, quantity: 2 }],
      deliveryMethod: 'CARRIER',
      zoneId: zones.carrierZone.id,
      city: 'Abidjan',
      commune: 'Cocody',
      addressLine: 'Rue des Jardins, immeuble B',
      carrier: 'Transporteur test',
      paymentMethod,
    }),
  });
  return { product, order: result.order, paymentId: result.paymentId };
}

describe('livraison et moyens de paiement', () => {
  it('retrait en boutique : frais nuls et paiement en espèces autorisé', async () => {
    const product = await createProduct({ price: '10000', stock: 5 });
    const result = await createOrder({
      input: input({
        items: [{ productId: product.id, quantity: 1 }],
        deliveryMethod: 'PICKUP',
        zoneId: zones.pickupZone.id,
        paymentMethod: 'CASH_IN_STORE',
      }),
    });

    expect(Number(result.order.shippingFee)).toBe(0);
    expect(Number(result.order.total)).toBe(10000);
    expect(result.order.status).toBe('PENDING_CONFIRMATION');
    expect(result.prepaymentRequired).toBe(false);
  });

  it('livraison locale : frais de la zone appliqués et paiement à la livraison autorisé sous le plafond', async () => {
    const product = await createProduct({ price: '10000', stock: 5 });
    const result = await createOrder({
      input: input({
        items: [{ productId: product.id, quantity: 1 }],
        deliveryMethod: 'LOCAL_DELIVERY',
        zoneId: zones.localZone.id,
        addressLine: 'Quartier Commerce, près du marché',
        paymentMethod: 'CASH_ON_DELIVERY',
      }),
    });

    expect(Number(result.order.shippingFee)).toBe(2000);
    expect(Number(result.order.total)).toBe(12000);
    expect(result.order.paymentMethod).toBe('CASH_ON_DELIVERY');
  });

  it('refuse le paiement à la livraison au-delà du plafond configuré', async () => {
    const product = await createProduct({ price: '400000', stock: 2 });
    await expect(
      createOrder({
        input: input({
          items: [{ productId: product.id, quantity: 1 }],
          deliveryMethod: 'LOCAL_DELIVERY',
          zoneId: zones.localZone.id,
          addressLine: 'Quartier Commerce, près du marché',
          paymentMethod: 'CASH_ON_DELIVERY',
        }),
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_METHOD' });
  });

  it('hors Daloa : prépaiement obligatoire, paiement à la livraison refusé', async () => {
    await expect(orderForCarrier('CASH_ON_DELIVERY')).rejects.toMatchObject({ code: 'PREPAYMENT_REQUIRED' });
  });

  it('hors Daloa : commande Wave acceptée avec prépaiement requis', async () => {
    const { order } = await orderForCarrier('WAVE');
    expect(order.paymentStatus).toBe('UNPAID');
    expect(order.status).toBe('AWAITING_PAYMENT');
  });

  it('applique la livraison gratuite au-delà du seuil de la zone', async () => {
    const product = await createProduct({ price: '30000', stock: 5 });
    const result = await createOrder({
      input: input({
        items: [{ productId: product.id, quantity: 2 }],
        deliveryMethod: 'LOCAL_DELIVERY',
        zoneId: zones.localFreeZone.id,
        addressLine: 'Quartier Tazibouo, rue 12',
        paymentMethod: 'WAVE',
      }),
    });
    expect(Number(result.order.shippingFee)).toBe(0);
    expect(Number(result.order.total)).toBe(60000);
  });
});

describe('paiement : référence client puis vérification administrateur', () => {
  it('passe la commande en « paiement à vérifier » sans la marquer payée', async () => {
    const { order, paymentId } = await orderForCarrier('WAVE');
    const access = order.accessToken;

    await submitPaymentReference({ orderId: order.id, reference: 'WAVE-TX-123456', expectedAccessToken: access });

    const details = await getOrderDetails(order.id);
    expect(details!.order.status).toBe('AWAITING_PAYMENT_VERIFICATION');
    expect(details!.order.paymentStatus).toBe('AWAITING_VERIFICATION');

    const paymentRows = await db.select().from(payments).where(eq(payments.id, paymentId));
    expect(paymentRows[0]!.status).toBe('AWAITING_VERIFICATION');
    expect(paymentRows[0]!.customerReference).toBe('WAVE-TX-123456');
  });

  it('n’accepte pas une référence fournie avec un jeton d’accès erroné', async () => {
    const { order } = await orderForCarrier('WAVE');
    await expect(
      submitPaymentReference({ orderId: order.id, reference: 'WAVE-TX-999999', expectedAccessToken: 'tok_invalid' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuse la référence envoyée par un autre client connecté', async () => {
    const owner = await createUser();
    const other = await createUser();
    const product = await createProduct({ price: '20000', stock: 4 });
    const created = await createOrder({
      input: input({
        items: [{ productId: product.id, quantity: 1 }],
        deliveryMethod: 'PICKUP',
        paymentMethod: 'WAVE',
      }),
      userId: owner.id,
    });

    await expect(
      submitPaymentReference({ orderId: created.order.id, reference: 'WAVE-TX-000001', userId: other.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('confirme le paiement, décrémente le stock une seule fois et reste idempotent', async () => {
    const { product, order, paymentId } = await orderForCarrier('WAVE');
    const admin = adminActor(await createUser({ role: 'ADMIN' }));

    expect(await productState(product.id)).toMatchObject({ stock: 20, reserved: 2 });

    const first = await confirmPayment({ paymentId, actor: admin, source: 'MANUAL_REVIEW', note: 'Virement Wave vérifié' });
    expect(first.alreadyConfirmed).toBe(false);

    const afterFirst = await productState(product.id);
    expect(afterFirst).toMatchObject({ stock: 18, reserved: 0 });

    const second = await confirmPayment({ paymentId, actor: admin, source: 'MANUAL_REVIEW', note: 'Double clic' });
    expect(second.alreadyConfirmed).toBe(true);

    const afterSecond = await productState(product.id);
    expect(afterSecond).toMatchObject({ stock: 18, reserved: 0 });

    const details = await getOrderDetails(order.id);
    expect(details!.order.paymentStatus).toBe('PAID');
    expect(details!.order.status).toBe('PAYMENT_CONFIRMED');
  });

  it('ne décrémente pas deux fois le stock lors de deux confirmations simultanées', async () => {
    const { product, paymentId } = await orderForCarrier('WAVE');
    const admin = adminActor(await createUser({ role: 'ADMIN' }));

    const results = await Promise.allSettled([
      confirmPayment({ paymentId, actor: admin, source: 'MANUAL_REVIEW' }),
      confirmPayment({ paymentId, actor: admin, source: 'MANUAL_REVIEW' }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    expect(await productState(product.id)).toMatchObject({ stock: 18, reserved: 0 });
  });

  it('rejette un paiement non justifié : commande renvoyée en attente de paiement, puis annulée à expiration', async () => {
    const { product, order, paymentId } = await orderForCarrier('WAVE');
    const admin = adminActor(await createUser({ role: 'ADMIN' }));

    await rejectPayment({ paymentId, actor: admin, reason: 'Aucun encaissement sur le compte marchand' });

    const details = await getOrderDetails(order.id);
    expect(details!.order.paymentStatus).toBe('FAILED');
    expect(details!.order.status).toBe('AWAITING_PAYMENT');
    // Le stock reste réservé le temps que le client fournisse une nouvelle référence.
    expect(await productState(product.id)).toMatchObject({ stock: 20, reserved: 2 });

    await db.update(orders).set({ reservationExpiresAt: new Date(Date.now() - 1000) }).where(eq(orders.id, order.id));
    await expireReservations(10);
    expect(await productState(product.id)).toMatchObject({ stock: 20, reserved: 0 });
  });
});

describe('expédition : jamais avant paiement', () => {
  it('interdit « prête à expédier » pour une commande hors Daloa non payée', async () => {
    const { order } = await orderForCarrier('WAVE');
    const admin = adminActor(await createUser({ role: 'ADMIN' }));

    await expect(
      transitionOrder({ orderId: order.id, to: 'READY_TO_SHIP', actor: admin }),
    ).rejects.toMatchObject({ code: 'PREPAYMENT_REQUIRED' });
  });

  it('autorise la préparation puis l’expédition après confirmation du paiement', async () => {
    const { order, paymentId } = await orderForCarrier('WAVE');
    const admin = adminActor(await createUser({ role: 'ADMIN' }));

    await confirmPayment({ paymentId, actor: admin, source: 'MANUAL_REVIEW' });

    await transitionOrder({ orderId: order.id, to: 'PREPARING', actor: admin });
    const ready = await transitionOrder({ orderId: order.id, to: 'READY_TO_SHIP', actor: admin });
    expect(ready.order.status).toBe('READY_TO_SHIP');

    const shipped = await transitionOrder({ orderId: order.id, to: 'SHIPPED', actor: admin });
    expect(shipped.order.status).toBe('SHIPPED');
    expect(shipped.order.shippedAt).not.toBeNull();

    const details = await getOrderDetails(order.id);
    const history = details!.history.map((h) => h.toStatus);
    expect(history).toContain('PAYMENT_CONFIRMED');
    expect(history).toContain('SHIPPED');
  });

  it('refuse une transition non prévue par le cycle de vie', async () => {
    const product = await createProduct({ price: '5000', stock: 3 });
    const { order } = await createOrder({
      input: input({
        items: [{ productId: product.id, quantity: 1 }],
        deliveryMethod: 'PICKUP',
        paymentMethod: 'CASH_IN_STORE',
      }),
    });
    const admin = adminActor(await createUser({ role: 'ADMIN' }));
    await expect(transitionOrder({ orderId: order.id, to: 'DELIVERED', actor: admin })).rejects.toMatchObject({
      code: 'TRANSITION',
    });
  });

  it('annule une commande non payée et libère le stock réservé', async () => {
    const { product, order } = await orderForCarrier('WAVE');
    const admin = adminActor(await createUser({ role: 'ADMIN' }));

    await transitionOrder({ orderId: order.id, to: 'CANCELLED', actor: admin, note: 'Client injoignable' });

    const details = await getOrderDetails(order.id);
    expect(details!.order.status).toBe('CANCELLED');
    expect(await productState(product.id)).toMatchObject({ stock: 20, reserved: 0 });
  });

  it('annule automatiquement les réservations expirées', async () => {
    const { product, order } = await orderForCarrier('WAVE');

    await db
      .update(orders)
      .set({ reservationExpiresAt: new Date(Date.now() - 60_000) })
      .where(eq(orders.id, order.id));

    const result = await expireReservations(10);
    expect(result.expired).toBeGreaterThanOrEqual(1);

    const details = await getOrderDetails(order.id);
    expect(details!.order.status).toBe('CANCELLED');
    expect(await productState(product.id)).toMatchObject({ stock: 20, reserved: 0 });
  });
});

describe('isolation des commandes entre clients', () => {
  it('autorise le propriétaire, le porteur du jeton et refuse un tiers', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const product = await createProduct({ price: '8000', stock: 4 });
    const { order } = await createOrder({
      input: input({
        items: [{ productId: product.id, quantity: 1 }],
        deliveryMethod: 'PICKUP',
        paymentMethod: 'CASH_IN_STORE',
      }),
      userId: owner.id,
    });
    const details = await getOrderDetails(order.id);
    const orderRow = details!.order;

    expect(await ensureOrderAccess(orderRow, owner.id, null)).toBe(true);
    expect(await ensureOrderAccess(orderRow, null, order.accessToken)).toBe(true);
    expect(await ensureOrderAccess(orderRow, stranger.id, null)).toBe(false);
    expect(await ensureOrderAccess(orderRow, null, 'tok_forged')).toBe(false);
    expect(await ensureOrderAccess(orderRow, null, null)).toBe(false);
  });
});
