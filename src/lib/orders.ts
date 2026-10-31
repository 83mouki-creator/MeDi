import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  orders,
  orderItems,
  orderStatusHistory,
  inventoryMovements,
  payments,
  products,
  shipments,
  brands,
  categories,
  users,
  orderStatusEnum,
  type Order,
} from '../db/schema';
import { newId, parsePage, sanitizeSearch, toFcfa } from './utils';
import { computeAvailability, computePricing } from './pricing';
import { quoteDelivery, type DeliveryMethod, type PaymentMethod } from './delivery';
import { getStoreSettings } from './settings';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from './order-status';
import { canTransition, type OrderStatus } from './order-status';
import type { CheckoutInput } from './validation';
import { audit } from './audit';
import type { SessionUser } from './auth';
import { env } from './env';

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class OrderError extends Error {
  constructor(
    message: string,
    public code:
      | 'STOCK'
      | 'PAYMENT_METHOD'
      | 'DELIVERY_METHOD'
      | 'ZONE'
      | 'EMPTY_CART'
      | 'TRANSITION'
      | 'PREPAYMENT_REQUIRED'
      | 'NOT_FOUND'
      | 'FORBIDDEN'
      | 'IDEMPOTENT',
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

async function nextOrderNumber(tx: Tx) {
  const res = await tx.execute(sql`SELECT nextval('order_number_seq')::int AS n`);
  const n = Number((res.rows[0] as { n: number }).n);
  return `MED-${new Date().getFullYear()}-${String(n).padStart(5, '0')}`;
}

// ─────────────────────────────── Création de commande ───────────────────────────────

export type CreateOrderResult = {
  order: Order;
  paymentId: string;
  paymentMethod: PaymentMethod;
  prepaymentRequired: boolean;
};

/**
 * Crée une commande. Tous les montants sont recalculés à partir de la base :
 * prix catalogue + promotions actives + frais de livraison de la zone.
 * Le stock est réservé de façon atomique (aucune survente possible).
 */
export async function createOrder(params: {
  input: CheckoutInput;
  userId?: string | null;
  actor?: SessionUser | null;
  ip?: string | null;
}): Promise<CreateOrderResult> {
  const { input } = params;
  if (!input.items.length) throw new OrderError('Votre panier est vide.', 'EMPTY_CART');

  const settings = await getStoreSettings();

  const ids = [...new Set(input.items.map((i) => i.productId))].sort();
  const productRows = await db
    .select({
      id: products.id,
      sku: products.sku,
      slug: products.slug,
      name: products.name,
      price: products.price,
      promoPrice: products.promoPrice,
      promoStartsAt: products.promoStartsAt,
      promoEndsAt: products.promoEndsAt,
      stock: products.stock,
      reserved: products.reserved,
      lowStockThreshold: products.lowStockThreshold,
      allowPreorder: products.allowPreorder,
      isActive: products.isActive,
      isArchived: products.isArchived,
      brandName: brands.name,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(inArray(products.id, ids));

  const byId = new Map(productRows.map((p) => [p.id, p]));

  // 1. Calcul serveur des lignes et du sous-total
  type Line = {
    productId: string;
    sku: string;
    name: string;
    unitPrice: number;
    quantity: number;
    available: number;
    allowPreorder: boolean;
    reserveQty: number;
  };
  const lines: Line[] = [];

  for (const item of input.items) {
    const product = byId.get(item.productId);
    if (!product || !product.isActive || product.isArchived) {
      throw new OrderError('Un produit de votre panier n’est plus disponible.', 'STOCK', {
        productId: item.productId,
      });
    }
    const availability = computeAvailability(product, settings.lowStockThreshold);
    if (!availability.canOrder) {
      throw new OrderError(`« ${product.name} » est épuisé.`, 'STOCK', { productId: product.id, available: 0 });
    }
    if (availability.state !== 'PREORDER' && item.quantity > availability.available) {
      throw new OrderError(
        `Stock insuffisant pour « ${product.name} » : ${availability.available} unité(s) disponible(s).`,
        'STOCK',
        { productId: product.id, available: availability.available },
      );
    }
    const pricing = computePricing(product);
    lines.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      unitPrice: pricing.price,
      quantity: item.quantity,
      available: availability.available,
      allowPreorder: product.allowPreorder,
      reserveQty: Math.min(item.quantity, availability.available),
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  // 2. Frais de livraison et moyens de paiement autorisés (calcul serveur)
  const quote = await quoteDelivery({
    method: input.deliveryMethod as DeliveryMethod,
    zoneId: input.zoneId ?? null,
    subtotal,
    settings,
  });

  if (quote.errors.length > 0) {
    throw new OrderError(quote.errors[0]!, input.deliveryMethod === 'PICKUP' ? 'DELIVERY_METHOD' : 'ZONE', {
      errors: quote.errors,
    });
  }
  if (!quote.availableMethods.includes(input.paymentMethod as PaymentMethod)) {
    throw new OrderError(
      quote.prepaymentRequired
        ? 'Hors de Daloa, le prépaiement intégral par Wave est obligatoire avant expédition.'
        : 'Ce moyen de paiement n’est pas disponible pour cette livraison.',
      quote.prepaymentRequired ? 'PREPAYMENT_REQUIRED' : 'PAYMENT_METHOD',
      { availableMethods: quote.availableMethods },
    );
  }

  const shippingFee = quote.fee;
  const discount = 0;
  const total = subtotal + shippingFee - discount;
  const reservationMinutes = settings.reservationMinutes;
  const accessToken = newId('tok_');

  // 3. Transaction : réservation atomique du stock + écritures
  const result = await db.transaction(async (tx) => {
    const number = await nextOrderNumber(tx);
    const orderId = newId('ord_');

    // Verrouille les produits dans un ordre stable (évite les interblocages).
    for (const line of lines) {
      if (line.reserveQty <= 0) continue;
      const locked = await tx.execute(sql`
        SELECT id, stock, reserved FROM products WHERE id = ${line.productId} FOR UPDATE
      `);
      const row = locked.rows[0] as { id: string; stock: number; reserved: number } | undefined;
      if (!row) throw new OrderError('Produit introuvable.', 'STOCK');
      const available = row.stock - row.reserved;
      if (!line.allowPreorder && available < line.reserveQty) {
        throw new OrderError(`Stock insuffisant pour « ${line.name} ».`, 'STOCK', {
          productId: line.productId,
          available: Math.max(0, available),
        });
      }
      const toReserve = Math.min(line.reserveQty, Math.max(0, available));
      if (toReserve > 0) {
        await tx.execute(sql`
          UPDATE products SET reserved = reserved + ${toReserve}, updated_at = now()
          WHERE id = ${line.productId}
        `);
      }
      line.reserveQty = toReserve;
    }

    const initialStatus: OrderStatus =
      input.paymentMethod === 'WAVE' ? 'AWAITING_PAYMENT' : 'PENDING_CONFIRMATION';

    const [order] = await tx
      .insert(orders)
      .values({
        id: orderId,
        number,
        userId: params.userId ?? null,
        customerFirstName: input.firstName,
        customerLastName: input.lastName,
        phone: input.phone,
        email: input.email || null,
        deliveryMethod: input.deliveryMethod,
        zoneId: quote.zone?.id ?? null,
        city: quote.zone?.city ?? input.city,
        commune: input.commune || null,
        addressLine: input.addressLine || null,
        landmark: input.landmark || null,
        carrier: input.carrier || null,
        shippingFee: String(shippingFee),
        subtotal: String(subtotal),
        discount: String(discount),
        total: String(total),
        paymentMethod: input.paymentMethod,
        paymentStatus: 'UNPAID',
        status: initialStatus,
        reservationExpiresAt: new Date(Date.now() + reservationMinutes * 60 * 1000),
        customerNote: input.customerNote || null,
        accessToken,
      })
      .returning();

    for (const line of lines) {
      await tx.insert(orderItems).values({
        id: newId('oit_'),
        orderId,
        productId: line.productId,
        skuSnapshot: line.sku,
        nameSnapshot: line.name,
        imageSnapshot: null,
        unitPrice: String(line.unitPrice),
        quantity: line.quantity,
        lineTotal: String(line.unitPrice * line.quantity),
      });

      if (line.reserveQty > 0) {
        const stateRows = await tx.execute(sql`
          SELECT stock, reserved FROM products WHERE id = ${line.productId}
        `);
        const state = stateRows.rows[0] as { stock: number; reserved: number };
        await tx.insert(inventoryMovements).values({
          id: newId('mov_'),
          productId: line.productId,
          type: 'RESERVATION',
          quantity: -line.reserveQty,
          stockAfter: state.stock,
          reservedAfter: state.reserved,
          orderId,
          reason: `Réservation commande ${number}`,
        });
      }
    }

    await tx.insert(orderStatusHistory).values({
      id: newId('osh_'),
      orderId,
      fromStatus: null,
      toStatus: initialStatus,
      note: 'Commande créée par le client',
      actorId: params.userId ?? null,
      actorLabel: params.userId ? 'Client' : 'Visiteur',
    });

    const paymentId = newId('pay_');
    await tx.insert(payments).values({
      id: paymentId,
      orderId,
      provider: input.paymentMethod === 'WAVE' ? 'WAVE' : 'CASH',
      status: input.paymentMethod === 'WAVE' ? 'PENDING' : 'PENDING',
      amount: String(total),
      currency: 'XOF',
      clientReference: `MED-${number}-${newId('')}`,
      expiresAt: new Date(Date.now() + reservationMinutes * 60 * 1000),
      rawPayload: { method: input.paymentMethod },
    });

    return { order: order!, paymentId };
  });

  await audit(params.actor ?? null, {
    action: 'order.created',
    entity: 'order',
    entityId: result.order.id,
    metadata: {
      number: result.order.number,
      total,
      paymentMethod: input.paymentMethod,
      deliveryMethod: input.deliveryMethod,
      prepaymentRequired: quote.prepaymentRequired,
    },
    ip: params.ip,
  });

  return {
    order: result.order,
    paymentId: result.paymentId,
    paymentMethod: input.paymentMethod as PaymentMethod,
    prepaymentRequired: quote.prepaymentRequired,
  };
}

// ─────────────────────────────── Stock : réservation / libération ───────────────────────────────

/**
 * Décrémente définitivement le stock d'une commande payée.
 * Idempotent : la bascule `stock_committed` est atomique, un double appel ne
 * peut pas retirer le stock deux fois.
 */
export async function commitStockForOrder(tx: Tx, orderId: string, actorLabel: string) {
  const flag = await tx.execute(sql`
    UPDATE orders SET stock_committed = true, updated_at = now()
    WHERE id = ${orderId} AND stock_committed = false
    RETURNING id
  `);
  if (flag.rows.length === 0) return { committed: false };

  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  for (const item of items) {
    if (!item.productId) continue;
    const reservedRows = await tx.execute(sql`
      SELECT coalesce(sum(-m.quantity), 0)::int AS reserved_qty
      FROM inventory_movements m
      WHERE m.order_id = ${orderId} AND m.product_id = ${item.productId} AND m.type = 'RESERVATION'
    `);
    const reservedQty = Number((reservedRows.rows[0] as { reserved_qty: number }).reserved_qty);

    const stateRows = await tx.execute(sql`
      SELECT stock, reserved FROM products WHERE id = ${item.productId} FOR UPDATE
    `);
    const state = stateRows.rows[0] as { stock: number; reserved: number } | undefined;
    if (!state) continue;

    const decrement = Math.min(reservedQty, state.stock, state.reserved);
    const newStock = state.stock - decrement;
    const newReserved = state.reserved - decrement;

    await tx.execute(sql`
      UPDATE products SET stock = ${newStock}, reserved = ${newReserved},
        sold_count = sold_count + ${item.quantity}, updated_at = now()
      WHERE id = ${item.productId}
    `);

    await tx.insert(inventoryMovements).values({
      id: newId('mov_'),
      productId: item.productId,
      type: 'SALE',
      quantity: -decrement,
      stockAfter: newStock,
      reservedAfter: newReserved,
      orderId,
      reason: `Vente confirmée (${actorLabel})`,
    });
  }

  return { committed: true };
}

/** Libère la réservation (annulation, expiration, échec de paiement). Idempotent. */
export async function releaseStockForOrder(tx: Tx, orderId: string, reason: string) {
  const current = await tx.select({ stockCommitted: orders.stockCommitted }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!current[0]) return { released: false };
  if (current[0].stockCommitted) return { released: false };

  const pending = await tx.execute(sql`
    SELECT m.product_id, sum(-m.quantity)::int AS qty
    FROM inventory_movements m
    WHERE m.order_id = ${orderId} AND m.type = 'RESERVATION'
    GROUP BY m.product_id
  `);
  const released = await tx.execute(sql`
    SELECT m.product_id, sum(-m.quantity)::int AS qty
    FROM inventory_movements m
    WHERE m.order_id = ${orderId} AND m.type = 'RELEASE'
    GROUP BY m.product_id
  `);
  const releasedMap = new Map(
    (released.rows as { product_id: string; qty: number }[]).map((r) => [r.product_id, Number(r.qty)]),
  );

  let didRelease = false;
  for (const row of pending.rows as { product_id: string; qty: number }[]) {
    const reservedQty = Number(row.qty);
    const already = releasedMap.get(row.product_id) ?? 0;
    const toRelease = reservedQty - already;
    if (toRelease <= 0) continue;

    const stateRows = await tx.execute(sql`
      SELECT stock, reserved FROM products WHERE id = ${row.product_id} FOR UPDATE
    `);
    const state = stateRows.rows[0] as { stock: number; reserved: number } | undefined;
    if (!state) continue;

    const newReserved = Math.max(0, state.reserved - toRelease);
    await tx.execute(sql`
      UPDATE products SET reserved = ${newReserved}, updated_at = now() WHERE id = ${row.product_id}
    `);
    await tx.insert(inventoryMovements).values({
      id: newId('mov_'),
      productId: row.product_id,
      type: 'RELEASE',
      quantity: toRelease,
      stockAfter: state.stock,
      reservedAfter: newReserved,
      orderId,
      reason,
    });
    didRelease = true;
  }
  return { released: didRelease };
}

// ─────────────────────────────── Transitions de statut ───────────────────────────────

export async function transitionOrder(params: {
  orderId: string;
  to: OrderStatus;
  actor: SessionUser | null;
  actorLabel?: string;
  note?: string;
  ip?: string | null;
}): Promise<{ order: Order; changed: boolean }> {
  const { orderId, to, actor } = params;

  const result = await db.transaction(async (tx) => {
    const rows = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
    const order = rows[0];
    if (!order) throw new OrderError('Commande introuvable.', 'NOT_FOUND');

    if (order.status === to) return { order, changed: false };

    // Règle absolue, vérifiée avant tout autre contrôle : aucune expédition et
    // aucun statut « prête à expédier » avant paiement effectif pour un envoi
    // hors Daloa. (Un message explicite prime sur « transition invalide ».)
    if ((to === 'SHIPPED' || to === 'READY_TO_SHIP') && order.deliveryMethod === 'CARRIER' && order.paymentStatus !== 'PAID') {
      throw new OrderError(
        'Impossible d’expédier une commande hors Daloa dont le paiement n’est pas confirmé.',
        'PREPAYMENT_REQUIRED',
      );
    }
    if (to === 'SHIPPED' && order.paymentStatus !== 'PAID' && order.paymentMethod !== 'CASH_ON_DELIVERY') {
      throw new OrderError('Cette commande doit être payée avant expédition.', 'PREPAYMENT_REQUIRED');
    }

    if (!canTransition(order.status, to)) {
      throw new OrderError(
        `Transition refusée : ${order.status} → ${to}.`,
        'TRANSITION',
        { from: order.status, to },
      );
    }

    if (to === 'CANCELLED') {
      if (order.status === 'SHIPPED' || order.status === 'OUT_FOR_DELIVERY' || order.status === 'DELIVERED') {
        throw new OrderError('Une commande déjà expédiée ne peut pas être annulée. Utilisez un remboursement.', 'TRANSITION');
      }
      await releaseStockForOrder(tx, orderId, 'Annulation de la commande');
    }

    if (to === 'REFUNDED' && !order.stockCommitted) {
      throw new OrderError('Aucun paiement encaissé : cette commande ne peut pas être remboursée.', 'TRANSITION');
    }

    const patch: Partial<typeof orders.$inferInsert> = { status: to, updatedAt: new Date() };
    if (to === 'SHIPPED') patch.shippedAt = new Date();
    if (to === 'DELIVERED') {
      patch.deliveredAt = new Date();
      patch.paymentStatus = 'PAID';
    }
    if (to === 'CANCELLED') patch.cancelledAt = new Date();
    if (to === 'PAYMENT_CONFIRMED') patch.paymentStatus = 'PAID';

    const [updated] = await tx.update(orders).set(patch).where(eq(orders.id, orderId)).returning();

    await tx.insert(orderStatusHistory).values({
      id: newId('osh_'),
      orderId,
      fromStatus: order.status,
      toStatus: to,
      note: params.note ?? null,
      actorId: actor?.id ?? null,
      actorLabel: params.actorLabel ?? (actor ? `${actor.email} (${actor.role})` : 'Système'),
    });

    return { order: updated!, changed: true };
  });

  if (result.changed) {
    await audit(actor, {
      action: 'order.status_changed',
      entity: 'order',
      entityId: orderId,
      metadata: { to, note: params.note },
      ip: params.ip,
    });
  }

  return result;
}

// ─────────────────────────────── Lectures ───────────────────────────────

export async function getOrderByNumber(number: string) {
  const rows = await db.select().from(orders).where(eq(orders.number, number)).limit(1);
  return rows[0] ?? null;
}

export async function getOrderDetails(orderId: string) {
  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = rows[0];
  if (!order) return null;

  const [items, history, paymentRows, shipmentRows] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, orderId)).orderBy(asc(orderStatusHistory.createdAt)),
    db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.createdAt)),
    db.select().from(shipments).where(eq(shipments.orderId, orderId)).orderBy(desc(shipments.createdAt)),
  ]);

  return { order, items, history, payments: paymentRows, shipments: shipmentRows };
}

export type OrderDetails = NonNullable<Awaited<ReturnType<typeof getOrderDetails>>>;

/** Date valide (AAAA-MM-JJ ou ISO) sinon null — évite toute erreur SQL. */
function safeDate(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function listOrders(filters: {
  q?: string;
  status?: string;
  paymentStatus?: string;
  city?: string;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
}) {
  const conditions = [sql`1 = 1`];
  const search = sanitizeSearch(filters.q);
  if (search) {
    const like = `%${search.toLowerCase()}%`;
    conditions.push(sql`(lower(o.number) LIKE ${like} OR lower(o.phone) LIKE ${like}
      OR lower(o.customer_first_name || ' ' || o.customer_last_name) LIKE ${like})`);
  }
  // Les statuts sont des énumérations PostgreSQL : une valeur inconnue (URL
  // modifiée à la main, lien obsolète) doit être ignorée, jamais provoquer une
  // erreur serveur.
  if (filters.status && Object.hasOwn(ORDER_STATUS_LABELS, filters.status)) {
    conditions.push(sql`o.status = ${filters.status}`);
  }
  if (filters.paymentStatus && Object.hasOwn(PAYMENT_STATUS_LABELS, filters.paymentStatus)) {
    conditions.push(sql`o.payment_status = ${filters.paymentStatus}`);
  }
  if (filters.city) conditions.push(sql`lower(o.city) = ${filters.city.toLowerCase()}`);
  const from = safeDate(filters.from);
  const to = safeDate(filters.to);
  if (from) conditions.push(sql`o.created_at >= ${from}`);
  if (to) conditions.push(sql`o.created_at <= ${to}`);

  const page = parsePage(filters.page ?? 1);
  const perPage = Math.min(100, Math.max(1, filters.perPage ?? 20));
  const where = sql.join(conditions, sql` AND `);

  const rows = await db.execute(sql`
    SELECT o.*, count(*) OVER() AS total_count
    FROM orders o
    WHERE ${where}
    ORDER BY o.created_at DESC
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `);

  const list = rows.rows as Record<string, unknown>[];
  return {
    orders: list,
    total: list[0] ? Number(list[0].total_count) : 0,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil((list[0] ? Number(list[0].total_count) : 0) / perPage)),
  };
}

export async function listUserOrders(userId: string) {
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(50);
}

// ─────────────────────────────── Paiements ───────────────────────────────

/**
 * Confirmation de paiement — opération sensible et IDEMPOTENTE.
 * - verrouille la ligne de paiement ;
 * - refuse toute double comptabilisation (statut déjà CONFIRMED) ;
 * - commit le stock une seule fois ;
 * - journalise l'identité de l'administrateur.
 */
export async function confirmPayment(params: {
  paymentId: string;
  /** null = confirmation automatique par un webhook Wave vérifié (aucun opérateur humain) */
  actor: SessionUser | null;
  providerTransactionId?: string | null;
  note?: string;
  ip?: string | null;
  source: 'MANUAL_REVIEW' | 'WAVE_WEBHOOK' | 'WAVE_API_CHECK' | 'SYSTEM';
}): Promise<{ alreadyConfirmed: boolean; orderId: string; orderNumber: string }> {
  const { paymentId, actor, source } = params;

  const result = await db.transaction(async (tx) => {
    const paymentRows = await tx.select().from(payments).where(eq(payments.id, paymentId)).for('update');
    const payment = paymentRows[0];
    if (!payment) throw new OrderError('Paiement introuvable.', 'NOT_FOUND');

    if (payment.status === 'CONFIRMED') {
      return { alreadyConfirmed: true, orderId: payment.orderId, orderNumber: '' };
    }
    if (payment.status === 'REFUNDED') {
      throw new OrderError('Ce paiement a été remboursé.', 'TRANSITION');
    }

    const orderRows = await tx.select().from(orders).where(eq(orders.id, payment.orderId)).for('update');
    const order = orderRows[0];
    if (!order) throw new OrderError('Commande introuvable.', 'NOT_FOUND');
    if (order.status === 'CANCELLED') {
      throw new OrderError('La commande est annulée : paiement non applicable.', 'TRANSITION');
    }

    await tx
      .update(payments)
      .set({
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmedById: actor?.id ?? null,
        providerTransactionId: params.providerTransactionId ?? payment.providerTransactionId,
        failureReason: null,
        updatedAt: new Date(),
        rawPayload: { ...(typeof payment.rawPayload === 'object' && payment.rawPayload ? payment.rawPayload : {}), source, note: params.note ?? null },
      })
      .where(eq(payments.id, paymentId));

    await tx
      .update(orders)
      .set({
        paymentStatus: 'PAID',
        status: 'PAYMENT_CONFIRMED',
        reservationExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    await tx.insert(orderStatusHistory).values({
      id: newId('osh_'),
      orderId: order.id,
      fromStatus: order.status,
      toStatus: 'PAYMENT_CONFIRMED',
      note: params.note ?? `Paiement confirmé (${source})`,
      actorId: actor?.id ?? null,
      actorLabel: actor ? `${actor.email} (${actor.role})` : `Système — ${source}`,
    });

    await commitStockForOrder(tx, order.id, actor ? `paiement confirmé par ${actor.email}` : `paiement confirmé (${source})`);

    return { alreadyConfirmed: false, orderId: order.id, orderNumber: order.number };
  });

  if (!result.alreadyConfirmed) {
    await audit(actor, {
      action: 'payment.confirmed',
      entity: 'payment',
      entityId: paymentId,
      metadata: { source, orderId: result.orderId, transactionRef: params.providerTransactionId ?? null, automated: !actor },
      ip: params.ip,
    });
  }

  return result;
}

export async function rejectPayment(params: {
  paymentId: string;
  actor: SessionUser;
  reason: string;
  ip?: string | null;
}) {
  await db.transaction(async (tx) => {
    const paymentRows = await tx.select().from(payments).where(eq(payments.id, params.paymentId)).for('update');
    const payment = paymentRows[0];
    if (!payment) throw new OrderError('Paiement introuvable.', 'NOT_FOUND');
    if (payment.status === 'CONFIRMED') {
      throw new OrderError('Paiement déjà confirmé : rejet impossible.', 'TRANSITION');
    }

    await tx
      .update(payments)
      .set({ status: 'FAILED', failureReason: params.reason, updatedAt: new Date() })
      .where(eq(payments.id, params.paymentId));

    const orderRows = await tx.select().from(orders).where(eq(orders.id, payment.orderId)).limit(1);
    const order = orderRows[0];
    if (!order) return;

    await tx
      .update(orders)
      .set({ paymentStatus: 'FAILED', status: 'AWAITING_PAYMENT', updatedAt: new Date() })
      .where(eq(orders.id, order.id));

    // La réservation de stock est conservée : le client peut soumettre une
    // nouvelle référence. Si elle n'arrive pas avant l'expiration, la tâche
    // `expireReservations` annule la commande et remet les articles en vente.
    await tx.insert(orderStatusHistory).values({
      id: newId('osh_'),
      orderId: order.id,
      fromStatus: order.status,
      toStatus: 'AWAITING_PAYMENT',
      note: `Paiement refusé : ${params.reason}`,
      actorId: params.actor.id,
      actorLabel: `${params.actor.email} (${params.actor.role})`,
    });
  });

  await audit(params.actor, {
    action: 'payment.rejected',
    entity: 'payment',
    entityId: params.paymentId,
    metadata: { reason: params.reason },
    ip: params.ip,
  });
}

/** Le client déclare une référence de transaction Wave (jusqu'à preuve administrateur). */
export async function submitPaymentReference(params: {
  orderId: string;
  reference: string;
  expectedAccessToken?: string;
  userId?: string | null;
}) {
  const reference = params.reference.trim();
  if (reference.length < 4) throw new OrderError('Référence de transaction trop courte.', 'NOT_FOUND');

  const rows = await db.select().from(orders).where(eq(orders.id, params.orderId)).limit(1);
  const order = rows[0];
  if (!order) throw new OrderError('Commande introuvable.', 'NOT_FOUND');
  if (params.userId && order.userId && order.userId !== params.userId) throw new OrderError('Accès refusé.', 'FORBIDDEN');
  if (params.expectedAccessToken && order.accessToken !== params.expectedAccessToken) {
    throw new OrderError('Accès refusé.', 'FORBIDDEN');
  }
  if (order.paymentStatus === 'PAID') throw new OrderError('Cette commande est déjà payée.', 'IDEMPOTENT');

  await db.transaction(async (tx) => {
    const paymentRows = await tx.select().from(payments).where(eq(payments.orderId, order.id)).for('update');
    const payment = paymentRows[0];
    if (!payment) throw new OrderError('Paiement introuvable.', 'NOT_FOUND');
    if (payment.status === 'CONFIRMED') return;

    await tx
      .update(payments)
      .set({ status: 'AWAITING_VERIFICATION', customerReference: reference, updatedAt: new Date() })
      .where(eq(payments.id, payment.id));

    await tx
      .update(orders)
      .set({
        paymentStatus: 'AWAITING_VERIFICATION',
        status: 'AWAITING_PAYMENT_VERIFICATION',
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    await tx.insert(orderStatusHistory).values({
      id: newId('osh_'),
      orderId: order.id,
      fromStatus: order.status,
      toStatus: 'AWAITING_PAYMENT_VERIFICATION',
      note: `Référence de transaction déclarée par le client : ${reference}`,
      actorLabel: 'Client',
    });
  });

  return { ok: true };
}

/**
 * Libère les réservations expirées (paiement non intervenu dans le délai).
 * À appeler périodiquement (cron Vercel) et avant les lectures d'administration.
 */
export async function expireReservations(limit = 50) {
  const rows = await db
    .select({ id: orders.id, number: orders.number })
    .from(orders)
    .where(
      and(
        sql`${orders.reservationExpiresAt} IS NOT NULL`,
        sql`${orders.reservationExpiresAt} < now()`,
        // Tout statut de paiement non encaissé (y compris une référence refusée)
        // doit pouvoir expirer : sinon le stock resterait bloqué indéfiniment.
        inArray(orders.paymentStatus, ['UNPAID', 'FAILED', 'AWAITING_VERIFICATION']),
        inArray(orders.status, ['PENDING_CONFIRMATION', 'AWAITING_PAYMENT', 'AWAITING_PAYMENT_VERIFICATION']),
      ),
    )
    .limit(limit);

  let expired = 0;
  for (const row of rows) {
    try {
      await db.transaction(async (tx) => {
        const locked = await tx.select().from(orders).where(eq(orders.id, row.id)).for('update');
        const order = locked[0];
        if (!order || order.paymentStatus === 'PAID') return;
        await releaseStockForOrder(tx, order.id, 'Réservation expirée');
        await tx
          .update(orders)
          .set({ status: 'CANCELLED', cancelledAt: new Date(), paymentStatus: 'FAILED', updatedAt: new Date() })
          .where(eq(orders.id, order.id));
        await tx.insert(orderStatusHistory).values({
          id: newId('osh_'),
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'CANCELLED',
          note: 'Commande annulée automatiquement : paiement non reçu dans le délai imparti.',
          actorLabel: 'Système',
        });
      });
      expired += 1;
    } catch (error) {
      console.error('[orders] expiration impossible', row.number, error);
    }
  }
  return { expired };
}

export async function addShipmentInfo(params: {
  orderId: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  fee?: number;
  notes?: string | null;
}) {
  await db.insert(shipments).values({
    id: newId('shp_'),
    orderId: params.orderId,
    carrier: params.carrier ?? null,
    trackingNumber: params.trackingNumber ?? null,
    fee: String(params.fee ?? 0),
    status: 'DISPATCHED',
    dispatchedAt: new Date(),
    notes: params.notes ?? null,
  });

  await db
    .update(orders)
    .set({
      carrier: params.carrier ?? undefined,
      trackingNumber: params.trackingNumber ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, params.orderId));
}

export async function ensureOrderAccess(order: Order, userId: string | null, token?: string | null) {
  if (userId && order.userId === userId) return true;
  if (token && order.accessToken === token) return true;
  return false;
}

export async function orderStatusCounts() {
  const rows = await db
    .select({ status: orders.status, count: sql<number>`count(*)::int` })
    .from(orders)
    .groupBy(orders.status);
  return rows;
}

export async function findPendingPayments() {
  return db
    .select({
      payment: payments,
      order: {
        id: orders.id,
        number: orders.number,
        total: orders.total,
        customerFirstName: orders.customerFirstName,
        customerLastName: orders.customerLastName,
        phone: orders.phone,
        city: orders.city,
        createdAt: orders.createdAt,
      },
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(inArray(payments.status, ['AWAITING_VERIFICATION', 'PENDING']))
    .orderBy(desc(payments.createdAt))
    .limit(50);
}

export async function getOrderForTracking(number: string, token?: string | null) {
  const order = await getOrderByNumber(number);
  if (!order) return null;
  if (token && order.accessToken !== token) return null;
  return getOrderDetails(order.id);
}

export function orderTotals(order: { subtotal: string; shippingFee: string; discount: string; total: string; paymentMethod: string }) {
  return {
    subtotal: toFcfa(order.subtotal),
    shippingFee: toFcfa(order.shippingFee),
    discount: toFcfa(order.discount),
    total: toFcfa(order.total),
    prepaid: order.paymentMethod === 'WAVE',
  };
}

export type { OrderStatus };
export { orderStatusEnum, users, orderItems };
export const orderStatusValues = orderStatusEnum.enumValues;
export const waveAutoEnabled = env.wave.mode === 'AUTO' && env.wave.enabled;
