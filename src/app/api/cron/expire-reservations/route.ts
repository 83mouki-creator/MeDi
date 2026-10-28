import { NextResponse } from 'next/server';
import { expireReservations } from '@/lib/orders';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Tâche planifiée : libère les réservations de stock expirées (paiement non reçu
 * dans le délai configuré).
 *
 * Protection : en-tête `Authorization: Bearer $CRON_SECRET`. Sur Vercel, ajoutez
 * cet en-tête dans vercel.json ; sans secret configuré, la route refuse l'appel.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization');
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  const result = await expireReservations(100);
  return NextResponse.json({
    ok: true,
    expired: result.expired,
    durationMs: Date.now() - started,
    at: new Date().toISOString(),
  });
}
