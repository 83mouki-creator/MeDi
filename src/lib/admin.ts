import { sql } from 'drizzle-orm';
import { db } from '../db';
import { toFcfa } from './utils';

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
