import { desc, eq, and, gte, sql } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs, searchEvents } from '../db/schema';
import { newId, parsePage, sanitizeSearch } from './utils';
import type { SessionUser } from './auth';

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
