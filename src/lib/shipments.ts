/**
 * Expéditions — lecture et écriture, côté base.
 *
 * Tout ce qui touche au transport passe par ici : l'écran `/admin/expeditions`,
 * la fiche commande et le suivi client lisent les mêmes lignes, donc ils ne
 * peuvent pas se contredire.
 */
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { orderStatusHistory, orders, shipments } from '@/db/schema';
import { newId } from '@/lib/utils';
import {
  COLIS_EXPRESS_CARRIER,
  COLIS_EXPRESS_LABEL,
  fetchProviderStatus,
  normaliseTrackingCode,
  shipmentStatusFromProvider,
  trackingUrl,
} from '@/lib/colis-express';
import type { OrderStatus } from '@/lib/order-status';

export type ShipmentStatus = 'PENDING' | 'DISPATCHED' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERED' | 'RETURNED';

/** Une expédition, avec la commande et le client qu'elle concerne. */
export type ShipmentRow = {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  city: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: ShipmentStatus;
  providerStatus: string | null;
  providerCheckedAt: Date | null;
  fee: string;
  dispatchedAt: Date | null;
  deliveredAt: Date | null;
  notes: string | null;
  createdAt: Date;
};

/**
 * Commandes à expédier : payées, hors Daloa, et pas encore remises à un
 * transporteur. C'est la file de travail de l'écran Expéditions — rien de plus,
 * rien de moins.
 */
export async function ordersToDispatch(limit = 40) {
  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      customerFirstName: orders.customerFirstName,
      customerLastName: orders.customerLastName,
      phone: orders.phone,
      city: orders.city,
      commune: orders.commune,
      addressLine: orders.addressLine,
      total: orders.total,
      shippingFee: orders.shippingFee,
      createdAt: orders.createdAt,
      deliveryMethod: orders.deliveryMethod,
    })
    .from(orders)
    .where(
      and(
        eq(orders.deliveryMethod, 'CARRIER'),
        eq(orders.paymentStatus, 'PAID'),
        inArray(orders.status, ['PAYMENT_CONFIRMED', 'PREPARING', 'READY_TO_SHIP']),
        isNull(orders.trackingNumber),
      ),
    )
    .orderBy(orders.createdAt)
    .limit(limit);
  return rows;
}

/**
 * Expéditions en cours : celles qui ne sont pas encore arrivées chez le client.
 * Les plus récemment mises à jour d'abord, parce que ce sont elles qui bougent.
 */
export async function listShipments(options: { status?: ShipmentStatus | 'all'; limit?: number } = {}) {
  const { status = 'all', limit = 200 } = options;
  const rows = await db
    .select({
      id: shipments.id,
      orderId: shipments.orderId,
      orderNumber: orders.number,
      customerFirstName: orders.customerFirstName,
      customerLastName: orders.customerLastName,
      phone: orders.phone,
      city: orders.city,
      carrier: shipments.carrier,
      trackingNumber: shipments.trackingNumber,
      trackingUrl: shipments.trackingUrl,
      status: shipments.status,
      providerStatus: shipments.providerStatus,
      providerCheckedAt: shipments.providerCheckedAt,
      fee: shipments.fee,
      dispatchedAt: shipments.dispatchedAt,
      deliveredAt: shipments.deliveredAt,
      notes: shipments.notes,
      createdAt: shipments.createdAt,
    })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(status === 'all' ? undefined : eq(shipments.status, status))
    .orderBy(desc(shipments.createdAt))
    .limit(limit);

  return rows.map<ShipmentRow>((row) => ({
    ...row,
    customerName: `${row.customerFirstName} ${row.customerLastName}`.trim(),
  }));
}

/** Compteurs de l'écran Expéditions (une seule requête). */
export async function shipmentCounts() {
  const rows = await db
    .select({ status: shipments.status, total: sql<number>`count(*)::int` })
    .from(shipments)
    .groupBy(shipments.status);

  const counts: Record<ShipmentStatus, number> = { PENDING: 0, DISPATCHED: 0, IN_TRANSIT: 0, ARRIVED: 0, DELIVERED: 0, RETURNED: 0 };
  for (const row of rows) counts[row.status as ShipmentStatus] = Number(row.total);

  const [toShip] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.deliveryMethod, 'CARRIER'),
        eq(orders.paymentStatus, 'PAID'),
        inArray(orders.status, ['PAYMENT_CONFIRMED', 'PREPARING', 'READY_TO_SHIP']),
        isNull(orders.trackingNumber),
      ),
    );

  return { ...counts, toShip: Number(toShip?.total ?? 0) };
}

export class ShipmentError extends Error {}

/**
 * Enregistre l'expédition d'une commande avec son code Colis Express.
 *
 * Le code est vérifié (`CLI-XXXXXX`) : un code approximatif ne mène à aucun
 * colis chez le transporteur, et le client s'en apercevrait avant nous.
 * Si `carrier` vaut `COLIS_EXPRESS`, l'expédition est marquée comme telle et le
 * lien de suivi public est calculé une fois pour toutes.
 */
export async function recordShipment(params: {
  orderId: string;
  rawTrackingNumber: string;
  carrier?: string | null;
  fee?: number;
  notes?: string | null;
  actor: { id: string; email: string; role: string };
  ip?: string | null;
}) {
  const code = normaliseTrackingCode(params.rawTrackingNumber);
  if (!code) throw new ShipmentError('Code de suivi invalide : il doit ressembler à CLI-AB12CD.');

  const [order] = await db.select().from(orders).where(eq(orders.id, params.orderId)).limit(1);
  if (!order) throw new ShipmentError('Commande introuvable.');
  if (order.deliveryMethod !== 'CARRIER') {
    throw new ShipmentError('Cette commande se livre à Daloa : elle ne passe pas par un transporteur.');
  }
  if (order.paymentStatus !== 'PAID') {
    throw new ShipmentError('Le paiement n’est pas confirmé : on n’expédie pas avant d’avoir reçu l’argent.');
  }

  const duplicate = await db
    .select({ id: shipments.id, orderId: shipments.orderId, orderNumber: orders.number })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(eq(shipments.trackingNumber, code))
    .limit(1);
  if (duplicate[0] && duplicate[0].orderId !== params.orderId) {
    throw new ShipmentError(`Ce code de suivi est déjà utilisé par la commande ${duplicate[0].orderNumber}.`);
  }

  const carrier = params.carrier?.trim() || COLIS_EXPRESS_CARRIER;

  await db.transaction(async (tx) => {
    await tx.insert(shipments).values({
      id: newId('shp_'),
      orderId: params.orderId,
      carrier,
      trackingNumber: code,
      trackingUrl: trackingUrl(code),
      fee: String(params.fee ?? Number(order.shippingFee ?? 0)),
      status: 'DISPATCHED',
      destinationCity: order.city,
      dispatchedAt: new Date(),
      notes: params.notes ?? null,
    });

    await tx
      .update(orders)
      .set({
        carrier: carrier === COLIS_EXPRESS_CARRIER ? COLIS_EXPRESS_LABEL : carrier,
        trackingNumber: code,
        status: 'SHIPPED',
        shippedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, params.orderId));

    await tx.insert(orderStatusHistory).values({
      id: newId('osh_'),
      orderId: params.orderId,
      fromStatus: order.status,
      toStatus: 'SHIPPED' satisfies OrderStatus,
      note: `Colis remis au transporteur (${carrier === COLIS_EXPRESS_CARRIER ? COLIS_EXPRESS_LABEL : carrier}) — suivi ${code}.`,
      actorId: params.actor.id,
      actorLabel: `${params.actor.email} (${params.actor.role})`,
    });
  });

  return { code, url: trackingUrl(code) };
}

/**
 * Met à jour le statut d'une expédition à la main.
 *
 * Utile quand le transporteur prévient par WhatsApp plutôt que par une API, ce
 * qui est le cas courant. Le statut de la commande suit : « arrivé » et
 * « retiré » ne veulent pas dire la même chose pour le client.
 */
export async function updateShipmentStatus(params: {
  shipmentId: string;
  status: ShipmentStatus;
  note?: string | null;
  actor: { id: string; email: string; role: string };
}) {
  const [shipment] = await db.select().from(shipments).where(eq(shipments.id, params.shipmentId)).limit(1);
  if (!shipment) throw new ShipmentError('Expédition introuvable.');

  const now = new Date();
  const delivered = params.status === 'DELIVERED';

  await db.transaction(async (tx) => {
    await tx
      .update(shipments)
      .set({
        status: params.status,
        deliveredAt: delivered ? now : shipment.deliveredAt,
        notes: params.note ?? shipment.notes,
        updatedAt: now,
      })
      .where(eq(shipments.id, params.shipmentId));

    if (delivered) {
      await tx
        .update(orders)
        .set({ status: 'DELIVERED', deliveredAt: now, updatedAt: now })
        .where(and(eq(orders.id, shipment.orderId), inArray(orders.status, ['SHIPPED', 'OUT_FOR_DELIVERY'])));
    }
  });
}

/**
 * Interroge Colis Express pour une expédition et enregistre ce qu'il répond.
 *
 * Sans API configurée, la fonction ne fait rien et le dit : l'écran affiche
 * alors le lien de suivi, sans prétendre avoir synchronisé quoi que ce soit.
 */
export async function syncShipment(shipmentId: string): Promise<{ configured: boolean; label: string | null; error: string | null }> {
  const [shipment] = await db.select().from(shipments).where(eq(shipments.id, shipmentId)).limit(1);
  if (!shipment?.trackingNumber) return { configured: false, label: null, error: 'Aucun code de suivi.' };

  const result = await fetchProviderStatus(shipment.trackingNumber);
  if (!result.configured) return { configured: false, label: null, error: null };
  if (result.error) return { configured: true, label: null, error: result.error };

  const label = result.label;
  if (label) {
    await db
      .update(shipments)
      .set({
        providerStatus: label,
        providerCheckedAt: new Date(),
        status: shipmentStatusFromProvider(label),
        updatedAt: new Date(),
      })
      .where(eq(shipments.id, shipmentId));
  } else {
    await db.update(shipments).set({ providerCheckedAt: new Date() }).where(eq(shipments.id, shipmentId));
  }

  return { configured: true, label, error: null };
}

/** Expédition d'une commande, pour la fiche commande et le suivi client. */
export async function shipmentForOrder(orderId: string) {
  const [row] = await db
    .select()
    .from(shipments)
    .where(eq(shipments.orderId, orderId))
    .orderBy(desc(shipments.createdAt))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    trackingUrl: row.trackingUrl ?? (row.trackingNumber ? trackingUrl(row.trackingNumber) : null),
  };
}

/**
 * Lien de suivi à afficher au client.
 *
 * Le client n'a pas besoin de savoir quel prestataire a été choisi pour que le
 * bouton marche : si le transporteur est Colis Express et que le code est
 * valide, on renvoie directement sa page de suivi.
 */
export function customerTrackingLink(shipment: { carrier: string | null; trackingNumber: string | null; trackingUrl: string | null }) {
  if (shipment.trackingUrl) return shipment.trackingUrl;
  if (shipment.carrier === COLIS_EXPRESS_CARRIER && shipment.trackingNumber) return trackingUrl(shipment.trackingNumber);
  return null;
}
