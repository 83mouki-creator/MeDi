import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import { cashSessions, type CashSession } from '../db/schema';
import { audit } from './audit';
import type { SessionUser } from './auth';
import { newId, toFcfa } from './utils';

/**
 * Ouverture et fermeture de caisse.
 *
 * Le principe est celui d'un cahier de caisse : en début de journée on compte
 * le fond de caisse et on l'inscrit ; en fin de journée on compte l'argent
 * réellement présent. La différence avec ce que le système attend (fond +
 * espèces encaissées) est enregistrée telle quelle — c'est l'écart de caisse.
 *
 * Une seule caisse peut être ouverte à la fois : deux caissiers qui se
 * relaient partagent la même session.
 */

export class CashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CashError';
  }
}

export async function getOpenCashSession(): Promise<CashSession | null> {
  const rows = await db
    .select()
    .from(cashSessions)
    .where(isNull(cashSessions.closedAt))
    .orderBy(desc(cashSessions.openedAt))
    .limit(1);
  return rows[0] ?? null;
}

export type CashTotals = {
  cashOrderCount: number;
  cashTotal: number;
  waveTotal: number;
  orderCount: number;
};

/**
 * Encaissements de la session : les espèces sont comptées telles quelles ;
 * Wave est suivi à part car il ne passe pas par le tiroir-caisse.
 */
export async function cashTotals(session: Pick<CashSession, 'openedAt' | 'closedAt'>): Promise<CashTotals> {
  const from = session.openedAt;
  const to = session.closedAt ?? new Date();
  const result = await db.execute(sql`
    SELECT
      coalesce(sum(CASE WHEN o.payment_method IN ('CASH_IN_STORE','CASH_ON_DELIVERY') THEN p.amount ELSE 0 END), 0)::numeric AS cash_total,
      count(DISTINCT CASE WHEN o.payment_method IN ('CASH_IN_STORE','CASH_ON_DELIVERY') THEN o.id END)::int AS cash_orders,
      coalesce(sum(CASE WHEN o.payment_method = 'WAVE' THEN p.amount ELSE 0 END), 0)::numeric AS wave_total,
      count(DISTINCT p.order_id)::int AS order_count
    FROM payments p
    INNER JOIN orders o ON o.id = p.order_id
    WHERE p.status = 'CONFIRMED'
      AND p.confirmed_at IS NOT NULL
      AND p.confirmed_at >= ${from}
      AND p.confirmed_at <= ${to}
      AND o.status NOT IN ('CANCELLED','REFUNDED')
  `);
  const row = (result.rows[0] ?? {}) as Record<string, string | number>;
  return {
    cashOrderCount: Number(row.cash_orders ?? 0),
    cashTotal: toFcfa(row.cash_total ?? 0),
    waveTotal: toFcfa(row.wave_total ?? 0),
    orderCount: Number(row.order_count ?? 0),
  };
}

export async function openCashSession(params: {
  openingFloat: number;
  note?: string | null;
  actor: SessionUser | null;
}) {
  const open = await getOpenCashSession();
  if (open) throw new CashError('La caisse est déjà ouverte. Fermez-la avant d’en ouvrir une nouvelle.');
  if (!Number.isFinite(params.openingFloat) || params.openingFloat < 0) {
    throw new CashError('Indiquez un fond de caisse valide (0 ou plus).');
  }

  const id = newId('csh_');
  await db.insert(cashSessions).values({
    id,
    openedByUserId: params.actor?.id ?? null,
    openingFloat: String(Math.round(params.openingFloat)),
    note: params.note?.trim() || null,
  });

  await audit(params.actor, {
    action: 'cash.opened',
    entity: 'cash_session',
    entityId: id,
    metadata: { openingFloat: Math.round(params.openingFloat) },
  });

  return { id };
}

export async function closeCashSession(params: {
  sessionId: string;
  countedCash: number;
  note?: string | null;
  actor: SessionUser | null;
}) {
  const rows = await db.select().from(cashSessions).where(eq(cashSessions.id, params.sessionId)).limit(1);
  const session = rows[0];
  if (!session) throw new CashError('Session de caisse introuvable.');
  if (session.closedAt) throw new CashError('Cette caisse est déjà fermée.');
  if (!Number.isFinite(params.countedCash) || params.countedCash < 0) {
    throw new CashError('Indiquez le montant compté en caisse.');
  }

  const closeAt = new Date();
  const totals = await cashTotals({ openedAt: session.openedAt, closedAt: closeAt });
  const opening = toFcfa(session.openingFloat);
  const expected = opening + totals.cashTotal;
  const counted = Math.round(params.countedCash);
  const difference = counted - expected;

  await db
    .update(cashSessions)
    .set({
      closedByUserId: params.actor?.id ?? null,
      closedAt: closeAt,
      countedCash: String(counted),
      expectedCash: String(expected),
      difference: String(difference),
      cashOrderCount: totals.cashOrderCount,
      cashTotal: String(totals.cashTotal),
      note: params.note?.trim() || session.note,
    })
    .where(and(eq(cashSessions.id, params.sessionId), isNull(cashSessions.closedAt)));

  await audit(params.actor, {
    action: 'cash.closed',
    entity: 'cash_session',
    entityId: params.sessionId,
    metadata: { counted, expected, difference, cashOrders: totals.cashOrderCount },
  });

  return { expected, counted, difference, cashTotal: totals.cashTotal, cashOrderCount: totals.cashOrderCount };
}

export type CashSessionRow = CashSession & { totals?: CashTotals };

export async function listCashSessions(limit = 20): Promise<CashSessionRow[]> {
  return db.select().from(cashSessions).orderBy(desc(cashSessions.openedAt)).limit(limit);
}

/** Résumé lisible d'une session fermée (écart en FCFA, positif = excédent). */
export function cashDifferenceLabel(difference: number) {
  if (difference === 0) return 'Caisse juste';
  return difference > 0 ? `Excédent de ${difference} FCFA` : `Manque de ${Math.abs(difference)} FCFA`;
}
