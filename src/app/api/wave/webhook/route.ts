import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { payments, webhookEvents } from '@/db/schema';
import { env } from '@/lib/env';
import { parseWaveEvent, verifyWaveWebhook, retrieveCheckoutSession } from '@/lib/wave';
import { confirmPayment } from '@/lib/orders';
import { newId, toFcfa } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Notification serveur Wave (webhook).
 *
 * Sécurité :
 *  - signature HMAC-SHA256 vérifiée avec WAVE_WEBHOOK_SECRET (anti-rejeu 5 min) ;
 *  - idempotence par identifiant d'événement (contrainte unique en base) ;
 *  - le montant reçu est re-vérifié auprès de l'API Wave avant toute confirmation ;
 *  - la confirmation elle-même est idempotente (verrou + statut).
 *
 * Sans secret configuré, l'endpoint refuse tout traitement : aucune confirmation
 * ne peut être déclenchée par un appel non authentifié.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('wave-signature');

  if (!env.wave.webhookSecret) {
    console.error('[wave/webhook] WAVE_WEBHOOK_SECRET absent : notification refusée');
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 });
  }

  const verification = verifyWaveWebhook(rawBody, signature, env.wave.webhookSecret);
  if (!verification.valid) {
    console.warn('[wave/webhook] signature invalide', verification.reason);
    return NextResponse.json({ error: 'invalid_signature', reason: verification.reason }, { status: 401 });
  }

  const event = parseWaveEvent(rawBody);
  if (!event) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  // Idempotence : un événement déjà traité est acquitté sans retraitement.
  const inserted = await db
    .insert(webhookEvents)
    .values({
      id: newId('whk_'),
      provider: 'wave',
      eventId: event.id,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });

  if (inserted.length === 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const sessionId = event.data?.id ?? null;
    const clientReference = event.data?.client_reference ?? null;

    if (!sessionId && !clientReference) {
      await markProcessed(event.id, 'aucune référence de session');
      return NextResponse.json({ received: true });
    }

    const paymentRows = await db
      .select()
      .from(payments)
      .where(sessionId ? eq(payments.providerSessionId, sessionId) : eq(payments.clientReference, clientReference!))
      .limit(1);

    const payment = paymentRows[0];
    if (!payment) {
      await markProcessed(event.id, 'paiement inconnu');
      return NextResponse.json({ received: true });
    }

    if (payment.status === 'CONFIRMED') {
      await markProcessed(event.id, 'déjà confirmé');
      return NextResponse.json({ received: true, alreadyConfirmed: true });
    }

    // Vérification indépendante auprès de l'API Wave (ne jamais se fier au seul corps reçu).
    let verifiedAmount = toFcfa(payment.amount);
    if (sessionId && env.wave.apiKey) {
      const session = await retrieveCheckoutSession(sessionId);
      if (session.payment_status !== 'succeeded' || session.checkout_status !== 'complete') {
        await markProcessed(event.id, `statut Wave non confirmé : ${session.payment_status}`);
        return NextResponse.json({ received: true, status: session.payment_status });
      }
      verifiedAmount = toFcfa(session.amount);
    }

    if (verifiedAmount !== toFcfa(payment.amount)) {
      await markProcessed(event.id, `montant incohérent : attendu ${payment.amount}, reçu ${verifiedAmount}`);
      console.error('[wave/webhook] montant incohérent', { paymentId: payment.id, expected: payment.amount, received: verifiedAmount });
      return NextResponse.json({ received: true, error: 'amount_mismatch' });
    }

    await confirmPayment({
      paymentId: payment.id,
      actor: null,
      providerTransactionId: event.data?.transaction_id ?? null,
      note: `Confirmation automatique Wave (événement ${event.id}, ${event.type})`,
      source: 'WAVE_WEBHOOK',
    });

    await markProcessed(event.id, null);
    return NextResponse.json({ received: true, confirmed: true });
  } catch (error) {
    console.error('[wave/webhook] traitement impossible', error);
    await db
      .update(webhookEvents)
      .set({ error: error instanceof Error ? error.message.slice(0, 300) : 'erreur inconnue' })
      .where(eq(webhookEvents.provider, 'wave'))
      .catch(() => undefined);
    // 500 → Wave réessaiera la notification.
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }
}

async function markProcessed(eventId: string, note: string | null) {
  await db.execute(sql`
    UPDATE webhook_events SET processed_at = now(), error = ${note}
    WHERE provider = 'wave' AND event_id = ${eventId}
  `);
}
