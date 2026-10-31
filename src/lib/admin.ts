import { sql } from 'drizzle-orm';
import { db } from '../db';
import { parsePage, sanitizeSearch, toFcfa } from './utils';

/**
 * Indicateurs de l'administration.
 * Définition comptable explicite : le chiffre d'affaires correspond au total des
 * commandes dont le paiement a été effectivement confirmé (payment_status = PAID),
 * hors commandes annulées ou remboursées. Les frais de livraison sont inclus.
 */
export async function getDashboardMetrics() {
  const [revenue, statusCounts, paymentCounts, stockAlerts, topProducts, recentOrders, pendingVerifications] =
    await Promise.all([
      db.execute(sql`
        SELECT
          coalesce(sum(total), 0)::text AS revenue,
          count(*)::int AS paid_orders,
          coalesce(sum(total) FILTER (WHERE created_at >= date_trunc('month', now())), 0)::text AS revenue_month
        FROM orders
        WHERE payment_status = 'PAID' AND status NOT IN ('CANCELLED', 'REFUNDED')
      `),
      db.execute(sql`SELECT status::text AS status, count(*)::int AS count FROM orders GROUP BY status`),
      db.execute(sql`SELECT payment_status::text AS status, count(*)::int AS count FROM orders GROUP BY payment_status`),
      db.execute(sql`
        SELECT id, sku, name, stock, reserved, low_stock_threshold, slug
        FROM products
        WHERE is_active = true AND is_archived = false
          AND (stock - reserved) <= coalesce(low_stock_threshold, 5)
        ORDER BY (stock - reserved) ASC, sold_count DESC
        LIMIT 10
      `),
      db.execute(sql`
        SELECT p.id, p.name, p.sku, p.sold_count, p.price,
          coalesce((SELECT sum(oi.quantity) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                    WHERE oi.product_id = p.id AND o.payment_status = 'PAID' AND o.status NOT IN ('CANCELLED','REFUNDED')), 0)::int AS units_paid
        FROM products p
        WHERE p.sold_count > 0 OR EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.id)
        ORDER BY units_paid DESC, p.sold_count DESC
        LIMIT 8
      `),
      db.execute(sql`
        SELECT id, number, customer_first_name, customer_last_name, phone, city, total, status::text, payment_status::text, created_at
        FROM orders ORDER BY created_at DESC LIMIT 8
      `),
      db.execute(sql`SELECT count(*)::int AS count FROM payments WHERE status IN ('AWAITING_VERIFICATION', 'PENDING')`),
    ]);

  const revenueRow = (revenue.rows as Record<string, unknown>[])[0] ?? {};
  const counts = (statusCounts.rows as { status: string; count: number }[]).reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row.count;
    return acc;
  }, {});
  const payCounts = (paymentCounts.rows as { status: string; count: number }[]).reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row.count;
    return acc;
  }, {});

  const lowStock = (stockAlerts.rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    sku: String(row.sku),
    name: String(row.name),
    slug: String(row.slug),
    stock: Number(row.stock),
    reserved: Number(row.reserved),
    available: Number(row.stock) - Number(row.reserved),
    threshold: row.low_stock_threshold === null ? 5 : Number(row.low_stock_threshold),
  }));

  return {
    revenue: toFcfa(revenueRow.revenue as string),
    revenueMonth: toFcfa(revenueRow.revenue_month as string),
    paidOrders: Number(revenueRow.paid_orders ?? 0),
    counts,
    payCounts,
    lowStock,
    outOfStock: lowStock.filter((p) => p.available <= 0).length,
    topProducts: (topProducts.rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      sku: String(row.sku),
      unitsPaid: Number(row.units_paid),
      soldCount: Number(row.sold_count),
      price: Number(row.price),
    })),
    recentOrders: (recentOrders.rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      number: String(row.number),
      customer: `${row.customer_first_name} ${row.customer_last_name}`,
      phone: String(row.phone),
      city: String(row.city),
      total: toFcfa(row.total as string),
      status: String(row.status),
      paymentStatus: String(row.payment_status),
      createdAt: new Date(row.created_at as string),
    })),
    pendingVerifications: Number(((pendingVerifications.rows as { count: number }[])[0]?.count ?? 0)),
    toShip:
      (counts.PAYMENT_CONFIRMED ?? 0) + (counts.PREPARING ?? 0) + (counts.READY_TO_SHIP ?? 0),
  };
}

export async function expiringPaymentsCount() {
  const rows = await db.execute(sql`
    SELECT count(*)::int AS count FROM payments WHERE status IN ('AWAITING_VERIFICATION','PENDING')
  `);
  return Number((rows.rows as { count: number }[])[0]?.count ?? 0);
}

export async function getLowStockList(limit = 100) {
  const rows = await db.execute(sql`
    SELECT id, sku, name, stock, reserved, low_stock_threshold, slug
    FROM products
    WHERE is_active = true AND is_archived = false
    ORDER BY (stock - reserved) ASC
    LIMIT ${limit}
  `);
  return (rows.rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    sku: String(row.sku),
    name: String(row.name),
    slug: String(row.slug),
    stock: Number(row.stock),
    reserved: Number(row.reserved),
    available: Number(row.stock) - Number(row.reserved),
    threshold: row.low_stock_threshold === null ? 5 : Number(row.low_stock_threshold),
  }));
}

export type StockFilter = 'all' | 'low' | 'out';

export type StockRow = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  stock: number;
  reserved: number;
  available: number;
  threshold: number;
};

function mapStockRow(row: Record<string, unknown>): StockRow {
  return {
    id: String(row.id),
    sku: String(row.sku),
    name: String(row.name),
    slug: String(row.slug),
    stock: Number(row.stock),
    reserved: Number(row.reserved),
    available: Number(row.stock) - Number(row.reserved),
    threshold: row.low_stock_threshold === null ? 5 : Number(row.low_stock_threshold),
  };
}

/** Compteurs du haut de l'écran Stock : tout le catalogue publié, pas un échantillon. */
export async function getStockCounters(): Promise<{ tracked: number; low: number; out: number }> {
  const rows = await db.execute(sql`
    SELECT
      count(*)::int AS tracked,
      count(*) FILTER (WHERE stock - reserved <= coalesce(low_stock_threshold, 5))::int AS low,
      count(*) FILTER (WHERE stock - reserved <= 0)::int AS out
    FROM products
    WHERE is_active = true AND is_archived = false
  `);
  const row = (rows.rows as { tracked: number; low: number; out: number }[])[0];
  return { tracked: Number(row?.tracked ?? 0), low: Number(row?.low ?? 0), out: Number(row?.out ?? 0) };
}

/** Liste paginée de TOUS les produits publiés, la plus basse disponibilité d'abord. */
export async function listStockProducts({
  q = '',
  filter = 'all',
  page = 1,
  perPage = 25,
}: {
  q?: string;
  filter?: StockFilter;
  page?: number;
  perPage?: number;
}): Promise<{ items: StockRow[]; total: number; page: number; totalPages: number }> {
  const conditions = [sql`is_active = true AND is_archived = false`];
  const term = sanitizeSearch(q);
  if (term) {
    const like = `%${term.toLowerCase()}%`;
    conditions.push(sql`(lower(name) LIKE ${like} OR lower(sku) LIKE ${like})`);
  }
  if (filter === 'low') conditions.push(sql`(stock - reserved) <= coalesce(low_stock_threshold, 5)`);
  if (filter === 'out') conditions.push(sql`(stock - reserved) <= 0`);

  const where = sql.join(conditions, sql` AND `);
  const safePage = parsePage(page);
  const rows = await db.execute(sql`
    SELECT id, sku, name, slug, stock, reserved, low_stock_threshold, count(*) OVER() AS total_count
    FROM products
    WHERE ${where}
    ORDER BY (stock - reserved) ASC, name ASC
    LIMIT ${perPage} OFFSET ${(safePage - 1) * perPage}
  `);
  const list = rows.rows as Record<string, unknown>[];
  const total = list[0] ? Number(list[0].total_count) : 0;
  return {
    items: list.map(mapStockRow),
    total,
    page: safePage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function salesByDay(days = 14) {
  const rows = await db.execute(sql`
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
      coalesce(sum(o.total) FILTER (WHERE o.payment_status = 'PAID' AND o.status NOT IN ('CANCELLED','REFUNDED')), 0)::text AS revenue,
      count(o.id) FILTER (WHERE o.payment_status = 'PAID' AND o.status NOT IN ('CANCELLED','REFUNDED'))::int AS orders
    FROM generate_series(date_trunc('day', now()) - (${days - 1} || ' days')::interval, date_trunc('day', now()), '1 day') AS d(day)
    LEFT JOIN orders o ON o.created_at >= d.day AND o.created_at < d.day + interval '1 day'
    GROUP BY d.day ORDER BY d.day
  `);
  return (rows.rows as Record<string, unknown>[]).map((row) => ({
    day: String(row.day),
    revenue: toFcfa(row.revenue as string),
    orders: Number(row.orders),
  }));
}

export async function paymentMethodBreakdown() {
  const rows = await db.execute(sql`
    SELECT payment_method::text AS method, count(*)::int AS count, coalesce(sum(total),0)::text AS total
    FROM orders WHERE payment_status = 'PAID' AND status NOT IN ('CANCELLED','REFUNDED')
    GROUP BY payment_method
  `);
  return (rows.rows as Record<string, unknown>[]).map((row) => ({
    method: String(row.method),
    count: Number(row.count),
    total: toFcfa(row.total as string),
  }));
}

export async function deliveryBreakdown() {
  const rows = await db.execute(sql`
    SELECT delivery_method::text AS method, count(*)::int AS count
    FROM orders GROUP BY delivery_method
  `);
  return (rows.rows as Record<string, unknown>[]).map((row) => ({
    method: String(row.method),
    count: Number(row.count),
  }));
}

// ─────────────────────── Demandes reçues via le formulaire de contact ───────────────────────

export const CONTACT_STATUS_LABELS: Record<string, string> = {
  NEW: 'Nouvelle',
  IN_PROGRESS: 'En cours',
  CLOSED: 'Traitée',
};

export type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  orderNumber: string | null;
  status: string;
  replyNote: string | null;
  handledAt: string | null;
  createdAt: string;
};

export async function countContactMessages(): Promise<{ newCount: number; open: number; total: number }> {
  const rows = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE status = 'NEW')::int AS new_count,
      count(*) FILTER (WHERE status <> 'CLOSED')::int AS open,
      count(*)::int AS total
    FROM contact_messages
  `);
  const row = (rows.rows as { new_count: number; open: number; total: number }[])[0];
  return { newCount: Number(row?.new_count ?? 0), open: Number(row?.open ?? 0), total: Number(row?.total ?? 0) };
}

/** Messages du formulaire de contact, les plus récents d'abord. */
export async function listContactMessages({
  status = 'open',
  page = 1,
  perPage = 20,
}: {
  status?: 'open' | 'NEW' | 'IN_PROGRESS' | 'CLOSED' | 'all';
  page?: number;
  perPage?: number;
} = {}): Promise<{ items: ContactMessageRow[]; total: number; page: number; totalPages: number }> {
  const conditions = [sql`1 = 1`];
  if (status === 'open') conditions.push(sql`status <> 'CLOSED'`);
  else if (status !== 'all') conditions.push(sql`status = ${status}`);
  const where = sql.join(conditions, sql` AND `);

  const safePage = parsePage(page);
  const rows = await db.execute(sql`
    SELECT id, name, email, phone, subject, message, order_number, status, reply_note, handled_at, created_at,
      count(*) OVER() AS total_count
    FROM contact_messages
    WHERE ${where}
    ORDER BY created_at DESC
    LIMIT ${perPage} OFFSET ${(safePage - 1) * perPage}
  `);
  const list = rows.rows as Record<string, unknown>[];
  const total = list[0] ? Number(list[0].total_count) : 0;
  return {
    items: list.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      phone: (row.phone as string | null) ?? null,
      subject: String(row.subject),
      message: String(row.message),
      orderNumber: (row.order_number as string | null) ?? null,
      status: String(row.status),
      replyNote: (row.reply_note as string | null) ?? null,
      handledAt: row.handled_at ? new Date(row.handled_at as string).toISOString() : null,
      createdAt: new Date(row.created_at as string).toISOString(),
    })),
    total,
    page: safePage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}
