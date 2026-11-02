import { desc, eq, and, gte, inArray, notInArray, or, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  auditLogs,
  brands,
  categories,
  contactMessages,
  deliveryZones,
  orders,
  payments,
  products,
  searchEvents,
  users,
} from '../db/schema';
import { newId, parsePage, sanitizeSearch } from './utils';
import type { SessionUser } from './auth';
import { ACTION_CATEGORIES, actionsForCategory, categoryOf, type ActivityCategoryKey, type ActivityNames } from './activity';

export type AuditInput = {
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

/**
 * Journalise une action sensible. Aucune donnée secrète (mot de passe, jeton,
 * clé API) ne doit être passée dans `metadata`.
 */
export async function audit(actor: SessionUser | null, input: AuditInput) {
  try {
    await db.insert(auditLogs).values({
      id: newId('log_'),
      userId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action: input.action,
      entity: input.entity ?? null,
      entityId: input.entityId ?? null,
      metadata: sanitizeMetadata(input.metadata ?? {}),
      ip: input.ip ?? null,
    });
  } catch (error) {
    // La journalisation ne doit jamais faire échouer l'action métier.
    console.error('[audit] écriture impossible', error);
  }
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const blocked = /password|secret|token|apikey|api_key|authorization/i;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (blocked.test(key)) {
      out[key] = '[masqué]';
    } else if (value instanceof Date) {
      out[key] = value.toISOString();
    } else if (typeof value === 'object' && value !== null) {
      out[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export async function listAuditLogs(rawPage = 1, pageSize = 50, q = '') {
  const page = parsePage(rawPage);
  const offset = (page - 1) * pageSize;
  const term = sanitizeSearch(q);
  // Recherche libre sur l'action, l'opérateur et l'entité concernée.
  const where = term
    ? sql`(${auditLogs.action} ILIKE ${`%${term}%`} OR coalesce(${auditLogs.actorEmail}, '') ILIKE ${`%${term}%`}
        OR coalesce(${auditLogs.entity}, '') ILIKE ${`%${term}%`} OR coalesce(${auditLogs.entityId}, '') ILIKE ${`%${term}%`})`
    : undefined;

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(where),
  ]);
  return { rows, total: countRows[0]?.count ?? 0, page, pageSize };
}

// ─────────────────────────── Journal lisible (humain) ───────────────────────────

export type ActivityRow = typeof auditLogs.$inferSelect & {
  /** Noms lisibles des objets concernés (produit, commande, agent…). */
  names: ActivityNames;
  /** Nom de la personne qui a agi, tel qu'un humain le dirait. */
  actorName: string | null;
};

/**
 * Journal expliqué : on garde les lignes brutes mais on leur ajoute le nom du
 * produit, le numéro de commande, le nom de l'agent… pour que la phrase affichée
 * soit compréhensible sans identifiant technique.
 */
export async function listActivity(
  rawPage = 1,
  pageSize = 30,
  options: { q?: string; category?: ActivityCategoryKey } = {},
) {
  const page = parsePage(rawPage);
  const offset = (page - 1) * pageSize;
  const term = sanitizeSearch(options.q ?? '');

  const filters = [] as ReturnType<typeof sql>[];
  if (term) {
    // Recherche compréhensible : nom de produit, numéro de commande, nom d'agent.
    const [productRows, orderRows, userRows] = await Promise.all([
      db.select({ id: products.id }).from(products).where(sql`${products.name} ILIKE ${`%${term}%`}`).limit(100),
      db.select({ id: orders.id }).from(orders).where(sql`${orders.number} ILIKE ${`%${term}%`}`).limit(100),
      db
        .select({ id: users.id })
        .from(users)
        .where(
          sql`coalesce(${users.firstName}, '') ILIKE ${`%${term}%`} OR coalesce(${users.lastName}, '') ILIKE ${`%${term}%`} OR ${users.email} ILIKE ${`%${term}%`}`,
        )
        .limit(100),
    ]);
    const ids = [...productRows, ...orderRows, ...userRows].map((row) => row.id);

    filters.push(
      sql`(${auditLogs.action} ILIKE ${`%${term}%`}
        OR coalesce(${auditLogs.actorEmail}, '') ILIKE ${`%${term}%`}
        OR coalesce(${auditLogs.entityId}, '') ILIKE ${`%${term}%`}
        OR ${auditLogs.entityId} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `) || sql`NULL`}))`,
    );
  }

  if (options.category) {
    const actions = actionsForCategory(options.category);
    filters.push(
      options.category === 'autre'
        ? notInArray(auditLogs.action, Object.keys(ACTION_CATEGORIES))
        : inArray(auditLogs.action, actions),
    );
  }

  const where = filters.length > 0 ? and(...filters) : undefined;

  const [rows, countRows] = await Promise.all([
    db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(where),
  ]);

  return {
    rows: await enrichActivity(rows),
    total: countRows[0]?.count ?? 0,
    page,
    pageSize,
  };
}

/** Répartition du journal par catégorie (pastilles de filtre). */
export async function activityCountsByCategory(): Promise<Record<ActivityCategoryKey, number>> {
  const rows = await db
    .select({ action: auditLogs.action, count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .groupBy(auditLogs.action);

  const counts = {} as Record<ActivityCategoryKey, number>;
  for (const row of rows) {
    const category = categoryOf(row.action);
    counts[category] = (counts[category] ?? 0) + row.count;
  }
  return counts;
}

function fullName(row: { firstName?: string | null; lastName?: string | null } | undefined): string | null {
  if (!row) return null;
  const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
  return name || null;
}

/**
 * Ajoute les noms lisibles aux lignes du journal (une requête par type d'objet,
 * jamais une requête par ligne).
 */
async function enrichActivity(rows: (typeof auditLogs.$inferSelect)[]): Promise<ActivityRow[]> {
  if (rows.length === 0) return [];

  const idsBy = (entity: string) =>
    [...new Set(rows.filter((row) => row.entity === entity && row.entityId).map((row) => row.entityId!))];

  const productIds = idsBy('product');
  const orderIds = idsBy('order');
  const paymentIds = idsBy('payment');
  const userIds = idsBy('user');
  const categoryIds = idsBy('category');
  const brandIds = idsBy('brand');
  const zoneIds = idsBy('delivery_zone');
  const contactIds = idsBy('contact_message');
  const actorIds = [...new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id)))];

  type Named = { id: string; name: string };
  const none = <T>() => Promise.resolve([] as T[]);

  const [productRows, orderRows, paymentRows, userRows, categoryRows, brandRows, zoneRows, contactRows] = await Promise.all([
    productIds.length ? db.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, productIds)) : none<Named>(),
    orderIds.length ? db.select({ id: orders.id, number: orders.number }).from(orders).where(inArray(orders.id, orderIds)) : none<{ id: string; number: string }>(),
    paymentIds.length
      ? db.select({ id: payments.id, orderId: payments.orderId }).from(payments).where(inArray(payments.id, paymentIds))
      : none<{ id: string; orderId: string }>(),
    userIds.length || actorIds.length
      ? db
          .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
          .from(users)
          .where(inArray(users.id, [...new Set([...userIds, ...actorIds])]))
      : none<{ id: string; firstName: string | null; lastName: string | null; email: string }>(),
    categoryIds.length ? db.select({ id: categories.id, name: categories.name }).from(categories).where(inArray(categories.id, categoryIds)) : none<Named>(),
    brandIds.length ? db.select({ id: brands.id, name: brands.name }).from(brands).where(inArray(brands.id, brandIds)) : none<Named>(),
    zoneIds.length ? db.select({ id: deliveryZones.id, name: deliveryZones.name }).from(deliveryZones).where(inArray(deliveryZones.id, zoneIds)) : none<Named>(),
    contactIds.length
      ? db.select({ id: contactMessages.id, name: contactMessages.name }).from(contactMessages).where(inArray(contactMessages.id, contactIds))
      : none<Named>(),
  ]);

  // Les paiements pointent vers une commande : on récupère son numéro.
  const paymentOrderIds = paymentRows.map((row) => row.orderId);
  const paymentOrders = paymentOrderIds.length
    ? await db.select({ id: orders.id, number: orders.number }).from(orders).where(inArray(orders.id, paymentOrderIds))
    : ([] as { id: string; number: string }[]);

  const productNames = new Map(productRows.map((row) => [row.id, row.name]));
  const orderNumbers = new Map([...orderRows, ...paymentOrders].map((row) => [row.id, row.number]));
  const userNames = new Map(userRows.map((row) => [row.id, fullName(row)]));
  const userEmails = new Map(userRows.map((row) => [row.id, row.email]));
  const categoryNames = new Map(categoryRows.map((row) => [row.id, row.name]));
  const brandNames = new Map(brandRows.map((row) => [row.id, row.name]));
  const zoneNames = new Map(zoneRows.map((row) => [row.id, row.name]));
  const contactNames = new Map(contactRows.map((row) => [row.id, row.name]));
  const paymentOrder = new Map(paymentRows.map((row) => [row.id, row.orderId]));

  const emailToUserId = new Map(userRows.map((row) => [row.email, row.id]));

  return rows.map((row) => {
    const names: ActivityNames = {};
    const entityId = row.entityId;

    if (entityId) {
      if (row.entity === 'product') names.product = productNames.get(entityId);
      if (row.entity === 'order') names.order = orderNumbers.get(entityId);
      if (row.entity === 'payment') names.order = orderNumbers.get(paymentOrder.get(entityId) ?? '');
      if (row.entity === 'user') names.user = userNames.get(entityId) ?? undefined;
      if (row.entity === 'category') names.category = categoryNames.get(entityId);
      if (row.entity === 'brand') names.brand = brandNames.get(entityId);
      if (row.entity === 'delivery_zone') names.zone = zoneNames.get(entityId);
      if (row.entity === 'contact_message') names.contact = contactNames.get(entityId);
    }

    // Commande concernée par un paiement ou une expédition : metadata.orderId.
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const metaOrderId = typeof meta.orderId === 'string' ? meta.orderId : null;
    if (metaOrderId && !names.order) names.order = orderNumbers.get(metaOrderId);

    const actorId = row.userId ?? (row.actorEmail ? emailToUserId.get(row.actorEmail) : undefined);
    const actorName =
      (actorId ? userNames.get(actorId) : null) ??
      (row.actorEmail ? row.actorEmail.split('@')[0].replace(/[._-]+/g, ' ') : null);

    return { ...row, names, actorName: actorName ?? null };
  });
}

export async function auditLogsForEntity(entity: string, entityId: string) {
  return db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.entity, entity), eq(auditLogs.entityId, entityId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);
}

export async function recordSearch(query: string, resultCount: number, kind: 'TEXT' | 'VISUAL', userId?: string | null) {
  const trimmed = sanitizeSearch(query, 200);
  if (!trimmed) return;
  try {
    await db.insert(searchEvents).values({
      id: newId('evt_'),
      query: trimmed,
      resultCount,
      kind,
      userId: userId ?? null,
    });
  } catch (error) {
    console.error('[search] événement non enregistré', error);
  }
}

export async function topSearches(days = 30, limit = 10) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ query: searchEvents.query, count: sql<number>`count(*)::int` })
    .from(searchEvents)
    .where(gte(searchEvents.createdAt, since))
    .groupBy(searchEvents.query)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
  return rows;
}

export async function searchEventsWithoutResults(days = 30, limit = 10) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db
    .select({ query: searchEvents.query, count: sql<number>`count(*)::int` })
    .from(searchEvents)
    .where(and(gte(searchEvents.createdAt, since), eq(searchEvents.resultCount, 0)))
    .groupBy(searchEvents.query)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}
