import { eq } from 'drizzle-orm';
import { db } from '../db';
import { orders, payments } from '../db/schema';
import { env } from './env';
import { createCheckoutSession, WaveError, waveStatus } from './wave';
import { toFcfa } from './utils';

/**
 * Crée une session de paiement Wave pour une commande existante.
 * Le montant provient TOUJOURS de la base (jamais du navigateur).
 * En cas d'échec, on ne bloque pas la commande : le client bascule sur les
 * instructions de paiement manuel, vérifiées ensuite par un administrateur.
 */
export async function startWaveCheckout(orderId: string): Promise<
  | { ok: true; url: string; sessionId: string }
  | { ok: false; reason: string }
> {
  const status = waveStatus();
  if (!status.checkoutAvailable) {
    return { ok: false, reason: status.reason };
  }

  const orderRows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = orderRows[0];
  if (!order) return { ok: false, reason: 'Commande introuvable.' };
  if (order.paymentStatus === 'PAID') return { ok: false, reason: 'Commande déjà payée.' };

  const paymentRows = await db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1);
  const payment = paymentRows[0];
  if (!payment) return { ok: false, reason: 'Paiement introuvable.' };

  const baseUrl = env.appUrl.replace(/\/$/, '');
  const query = `?t=${encodeURIComponent(order.accessToken)}`;

  try {
    const session = await createCheckoutSession({
      amount: toFcfa(order.total),
      clientReference: payment.clientReference,
      successUrl: `${baseUrl}/commande/${order.number}${query}&wave=success`,
      errorUrl: `${baseUrl}/commande/${order.number}${query}&wave=error`,
    });

    await db
      .update(payments)
      .set({
        providerSessionId: session.id,
        launchUrl: session.wave_launch_url,
        expiresAt: session.when_expires ? new Date(session.when_expires) : payment.expiresAt,
        rawPayload: { source: 'checkout_session', session_id: session.id, checkout_status: session.checkout_status },
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    return { ok: true, url: session.wave_launch_url, sessionId: session.id };
  } catch (error) {
    const message = error instanceof WaveError ? error.message : 'Service Wave indisponible.';
    console.error('[wave] création de session impossible', message);
    await db
      .update(payments)
      .set({ failureReason: `Création de session impossible : ${message}`, updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
    return { ok: false, reason: message };
  }
}
