import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { orderItems, orders } from '../db/schema';
import { sanitizeSearch } from './utils';

/**
 * Bons de livraison.
 *
 * Le livreur part avec un papier : commande, client, quartier, produits et
 * quantités. Le bon est calculé à partir des produits réellement commandés —
 * rien n'est ressaisi. La mise en page est faite pour les petites imprimantes
 * de comptoir (largeur 80 mm / A5) : une page par course, texte lisible.
 */

export const DELIVERY_NOTE_STATUSES = ['PAYMENT_CONFIRMED', 'PREPARING', 'READY_TO_SHIP', 'SHIPPED', 'OUT_FOR_DELIVERY'] as const;

export type DeliveryNoteRow = {
  id: string;
  number: string;
  status: string;
  city: string;
  neighbourhood: string | null;
  customerName: string;
  phone: string;
  createdAt: Date;
  total: string;
  paymentMethod: string;
  paymentStatus: string;
  itemCount: number;
  deliveryMethod: string;
};

/** Commandes à emporter chez le client (payées ou prêtes à partir). */
export async function listDeliveryNotes(params: { q?: string; includeDelivered?: boolean } = {}): Promise<DeliveryNoteRow[]> {
  const search = sanitizeSearch(params.q);
  const statuses = params.includeDelivered
    ? [...DELIVERY_NOTE_STATUSES, 'DELIVERED']
    : [...DELIVERY_NOTE_STATUSES];

  const result = await db.execute(sql`
    SELECT
      o.id, o.number, o.status, o.city, o.commune AS neighbourhood,
      o.customer_first_name || ' ' || o.customer_last_name AS customer_name,
      o.phone, o.created_at, o.total, o.payment_method, o.payment_status,
      o.delivery_method,
      coalesce(sum(oi.quantity), 0)::int AS item_count
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.delivery_method <> 'PICKUP'
      AND o.status = ANY(${sql.raw(`ARRAY[${statuses.map((s) => `'${s}'`).join(',')}]::order_status[]`)})
      ${search ? sql`AND (lower(o.number) LIKE ${`%${search.toLowerCase()}%`} OR lower(o.customer_first_name || ' ' || o.customer_last_name) LIKE ${`%${search.toLowerCase()}%`} OR lower(o.phone) LIKE ${`%${search.toLowerCase()}%`})` : sql``}
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT 60
  `);

  return (result.rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    number: String(row.number),
    status: String(row.status),
    city: String(row.city),
    neighbourhood: row.neighbourhood ? String(row.neighbourhood) : null,
    customerName: String(row.customer_name ?? ''),
    phone: String(row.phone ?? ''),
    createdAt: new Date(row.created_at as string),
    total: String(row.total ?? '0'),
    paymentMethod: String(row.payment_method),
    paymentStatus: String(row.payment_status),
    deliveryMethod: String(row.delivery_method),
    itemCount: Number(row.item_count ?? 0),
  }));
}

export type DeliveryNote = {
  order: {
    id: string;
    number: string;
    createdAt: Date;
    customerName: string;
    phone: string;
    city: string;
    neighbourhood: string | null;
    deliveryMethod: string;
    paymentMethod: string;
    paymentStatus: string;
    total: string;
    shippingFee: string;
    status: string;
  };
  items: { name: string; sku: string; quantity: number; unitPrice: string; lineTotal: string }[];
};

export async function getDeliveryNote(orderId: string): Promise<DeliveryNote | null> {
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), sql`${orders.deliveryMethod} <> 'PICKUP'`))
    .limit(1);
  const order = rows[0];
  if (!order) return null;

  const items = await db
    .select({
      name: orderItems.nameSnapshot,
      sku: orderItems.skuSnapshot,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      lineTotal: orderItems.lineTotal,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(desc(orderItems.id));

  return {
    order: {
      id: order.id,
      number: order.number,
      createdAt: order.createdAt,
      customerName: `${order.customerFirstName} ${order.customerLastName}`.trim(),
      phone: order.phone,
      city: order.city,
      neighbourhood: order.commune ?? null,
      deliveryMethod: order.deliveryMethod,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      total: order.total,
      shippingFee: order.shippingFee,
      status: order.status,
    },
    items,
  };
}
