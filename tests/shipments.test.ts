import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { orders, shipments } from '@/db/schema';
import { createOrder, confirmPayment, getOrderDetails } from '@/lib/orders';
import { recordShipment, updateShipmentStatus, shipmentForOrder, customerTrackingLink, ordersToDispatch, shipmentCounts, ShipmentError } from '@/lib/shipments';
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

/** Commande hors Daloa, payée : exactement la file d'attente de l'écran Expéditions. */
async function paidCarrierOrder() {
  const product = await createProduct({ name: 'Perceuse à percussion', price: '45000', stock: 10 });
  const result = await createOrder({
    input: input({
      items: [{ productId: product.id, quantity: 1 }],
      deliveryMethod: 'CARRIER',
      zoneId: zones.carrierZone.id,
      city: 'Abidjan',
      commune: 'Cocody',
      addressLine: 'Rue des Jardins',
      paymentMethod: 'WAVE',
    }),
  });

  const owner = await createUser({ email: `owner-${result.order.id}@example.ci`, role: 'OWNER' });
  await confirmPayment({
    paymentId: result.paymentId,
    actor: owner as SessionUser,
    source: 'MANUAL_REVIEW',
  });

  return { order: result.order, owner };
}

describe('Expédition Colis Express', () => {
  it('enregistre le code de suivi, passe la commande en « expédiée » et la sort de la file d’attente', async () => {
    const { order, owner } = await paidCarrierOrder();

    const before = await ordersToDispatch();
    expect(before.map((row) => row.id)).toContain(order.id);

    const result = await recordShipment({
      orderId: order.id,
      rawTrackingNumber: 'cli-ab12cd',
      actor: { id: owner.id, email: owner.email, role: owner.role },
    });

    expect(result.code).toBe('CLI-AB12CD');
    expect(result.url).toContain('/suivi.html?code=CLI-AB12CD');

    const after = await ordersToDispatch();
    expect(after.map((row) => row.id)).not.toContain(order.id);

    const details = await getOrderDetails(order.id);
    expect(details?.order.status).toBe('SHIPPED');
    expect(details?.order.trackingNumber).toBe('CLI-AB12CD');
    expect(details?.order.carrier).toBe('Colis Express');
    expect(details?.shipments[0]?.status).toBe('DISPATCHED');
    expect(details?.shipments[0]?.destinationCity).toBe('Abidjan');

    // Le suivi est journalisé en clair pour l'équipe et pour le client.
    const note = details?.history.find((entry) => entry.toStatus === 'SHIPPED');
    expect(note?.note).toContain('CLI-AB12CD');
  });

  it('refuse un code invalide, un doublon et une commande non payée', async () => {
    const { order, owner } = await paidCarrierOrder();
    const actor = { id: owner.id, email: owner.email, role: owner.role };

    await expect(recordShipment({ orderId: order.id, rawTrackingNumber: 'n’importe quoi', actor })).rejects.toThrow(ShipmentError);
    await expect(recordShipment({ orderId: order.id, rawTrackingNumber: 'CLI-AB12C', actor })).rejects.toThrow(ShipmentError);

    await recordShipment({ orderId: order.id, rawTrackingNumber: 'CLI-ZZ99YY', actor });

    // Le même code ne peut pas servir deux fois : le client suivrait le mauvais colis.
    const other = await createProduct({ name: 'Marteau', price: '8000', stock: 4 });
    const second = await createOrder({
      input: input({
        items: [{ productId: other.id, quantity: 1 }],
        deliveryMethod: 'CARRIER',
        zoneId: zones.carrierZone.id,
        city: 'Bouaké',
        addressLine: 'Quartier Air France',
        paymentMethod: 'WAVE',
      }),
    });
    await confirmPayment({ paymentId: second.paymentId, actor: owner as SessionUser, source: 'MANUAL_REVIEW' });
    await expect(recordShipment({ orderId: second.order.id, rawTrackingNumber: 'CLI-ZZ99YY', actor })).rejects.toThrow(/déjà utilisé/);
  });

  it('n’expédie jamais une commande dont le paiement n’est pas confirmé', async () => {
    const product = await createProduct({ price: '15000', stock: 3 });
    const { order } = await createOrder({
      input: input({
        items: [{ productId: product.id, quantity: 1 }],
        deliveryMethod: 'CARRIER',
        zoneId: zones.carrierZone.id,
        city: 'San-Pédro',
        addressLine: 'Cité portuaire',
        paymentMethod: 'WAVE',
      }),
    });
    const owner = await createUser({ email: `owner-${order.id}@example.ci`, role: 'OWNER' });

    await expect(
      recordShipment({ orderId: order.id, rawTrackingNumber: 'CLI-AA11BB', actor: { id: owner.id, email: owner.email, role: owner.role } }),
    ).rejects.toThrow(/paiement/i);
  });

  it('fait suivre le statut de la commande quand le client retire son colis', async () => {
    const { order, owner } = await paidCarrierOrder();
    const actor = { id: owner.id, email: owner.email, role: owner.role };
    await recordShipment({ orderId: order.id, rawTrackingNumber: 'CLI-QQ77RR', actor });

    const shipment = await shipmentForOrder(order.id);
    expect(shipment).not.toBeNull();

    await updateShipmentStatus({ shipmentId: shipment!.id, status: 'ARRIVED', actor });
    let details = await getOrderDetails(order.id);
    // « Arrivé en agence » n'est pas une livraison : la commande reste expédiée.
    expect(details?.order.status).toBe('SHIPPED');

    await updateShipmentStatus({ shipmentId: shipment!.id, status: 'DELIVERED', actor });
    details = await getOrderDetails(order.id);
    expect(details?.order.status).toBe('DELIVERED');
    expect(details?.order.deliveredAt).not.toBeNull();
  });

  it('expose toujours un lien de suivi au client et compte les colis en cours', async () => {
    const { order, owner } = await paidCarrierOrder();
    await recordShipment({ orderId: order.id, rawTrackingNumber: 'CLI-MM33NN', actor: { id: owner.id, email: owner.email, role: owner.role } });

    const shipment = await shipmentForOrder(order.id);
    const link = customerTrackingLink(shipment!);
    expect(link).toContain('code=CLI-MM33NN');

    const counts = await shipmentCounts();
    expect(counts.DISPATCHED).toBe(1);
    expect(counts.toShip).toBe(0);

    const [row] = await db.select().from(shipments).where(eq(shipments.orderId, order.id));
    expect(row?.trackingUrl).toContain('suivi.html');

    // La commande garde son code de suivi, même lu par un autre écran.
    const [stored] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(stored?.trackingNumber).toBe('CLI-MM33NN');
  });
});
