'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { orders, payments } from '@/db/schema';
import { requirePermission, clientIpFrom } from '@/lib/auth';
import { transitionOrder, confirmPayment, rejectPayment, addShipmentInfo, OrderError } from '@/lib/orders';
import { audit } from '@/lib/audit';
import { reviewPaymentSchema } from '@/lib/validation';
import type { OrderStatus } from '@/lib/order-status';

export type AdminActionState = { error?: string; success?: string };

/** Changement de statut d'une commande (rôles commandes/admin/propriétaire). */
export async function transitionOrderAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  let actor;
  try {
    actor = await requirePermission('orders.write');
  } catch {
    return { error: 'Action non autorisée pour votre rôle.' };
  }

  const orderId = String(formData.get('orderId') ?? '');
  const to = String(formData.get('to') ?? '') as OrderStatus;
  const note = String(formData.get('note') ?? '').trim() || undefined;
  const carrier = String(formData.get('carrier') ?? '').trim() || undefined;
  const trackingNumber = String(formData.get('trackingNumber') ?? '').trim() || undefined;
  const ip = clientIpFrom(await headers());

  if (!orderId || !to) return { error: 'Requête invalide.' };

  try {
    await transitionOrder({ orderId, to, actor, note, ip });

    if (to === 'SHIPPED' && (carrier || trackingNumber)) {
      await addShipmentInfo({ orderId, carrier: carrier ?? null, trackingNumber: trackingNumber ?? null });
      await audit(actor, {
        action: 'order.shipment_recorded',
        entity: 'order',
        entityId: orderId,
        metadata: { carrier: carrier ?? null, trackingNumber: trackingNumber ?? null },
        ip,
      });
    }
  } catch (error) {
    if (error instanceof OrderError) return { error: error.message };
    console.error('[admin] transition', error);
    return { error: 'Changement de statut impossible.' };
  }

  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath('/admin/commandes');
  return { success: 'Statut mis à jour.' };
}

/** Confirmation d'un paiement après vérification du crédit réel (rôle admin/propriétaire). */
export async function confirmPaymentAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  let actor;
  try {
    actor = await requirePermission('payments.confirm');
  } catch {
    return { error: 'Seuls les administrateurs peuvent confirmer un paiement.' };
  }

  const parsed = reviewPaymentSchema.safeParse({
    paymentId: String(formData.get('paymentId') ?? ''),
    decision: String(formData.get('decision') ?? 'CONFIRM'),
    note: String(formData.get('note') ?? ''),
  });
  if (!parsed.success) return { error: 'Données invalides.' };

  const ip = clientIpFrom(await headers());
  const transactionReference = String(formData.get('transactionReference') ?? '').trim() || null;

  try {
    if (parsed.data.decision === 'CONFIRM') {
      if (!parsed.data.note || parsed.data.note.length < 3) {
        return { error: 'Indiquez où et comment le paiement a été vérifié (traçabilité obligatoire).' };
      }
      const result = await confirmPayment({
        paymentId: parsed.data.paymentId,
        actor,
        providerTransactionId: transactionReference,
        note: parsed.data.note,
        ip,
        source: 'MANUAL_REVIEW',
      });
      revalidatePath('/admin/paiements');
      return {
        success: result.alreadyConfirmed
          ? 'Ce paiement était déjà confirmé : aucune seconde comptabilisation n’a été effectuée.'
          : 'Paiement confirmé. Le stock a été décrémenté et la commande passe en préparation.',
      };
    }

    await rejectPayment({
      paymentId: parsed.data.paymentId,
      actor,
      reason: parsed.data.note?.trim() || 'Paiement non retrouvé sur le compte marchand',
      ip,
    });
    revalidatePath('/admin/paiements');
    return { success: 'Paiement rejeté. La commande repasse en attente de paiement.' };
  } catch (error) {
    if (error instanceof OrderError) return { error: error.message };
    console.error('[admin] paiement', error);
    return { error: 'Opération impossible.' };
  }
}

export async function saveAdminNoteAction(formData: FormData) {
  const actor = await requirePermission('orders.read').catch(() => null);
  if (!actor) redirect('/admin');
  const orderId = String(formData.get('orderId') ?? '');
  const note = String(formData.get('adminNote') ?? '').slice(0, 2000);
  await db.update(orders).set({ adminNote: note || null, updatedAt: new Date() }).where(eq(orders.id, orderId));
  await audit(actor, { action: 'order.note_updated', entity: 'order', entityId: orderId });
  revalidatePath(`/admin/commandes/${orderId}`);
  redirect(`/admin/commandes/${orderId}`);
}

/** Libère immédiatement une réservation en attente (annulation manuelle). */
export async function cancelOrderAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  let actor;
  try {
    actor = await requirePermission('orders.write');
  } catch {
    return { error: 'Action non autorisée.' };
  }

  const orderId = String(formData.get('orderId') ?? '');
  const note = String(formData.get('note') ?? '').trim() || 'Annulation par la boutique';

  try {
    await transitionOrder({ orderId, to: 'CANCELLED', actor, note });
  } catch (error) {
    if (error instanceof OrderError) return { error: error.message };
    return { error: 'Annulation impossible.' };
  }

  revalidatePath(`/admin/commandes/${orderId}`);
  return { success: 'Commande annulée, réservation de stock libérée.' };
}

/** Marque un paiement comme expiré (session Wave échue) sans toucher au stock déjà engagé. */
export async function expirePaymentAction(formData: FormData) {
  const actor = await requirePermission('payments.confirm').catch(() => null);
  if (!actor) redirect('/admin/paiements');
  const paymentId = String(formData.get('paymentId') ?? '');
  const rows = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!rows[0] || rows[0].status === 'CONFIRMED') redirect('/admin/paiements');

  await db.update(payments).set({ status: 'EXPIRED', updatedAt: new Date() }).where(eq(payments.id, paymentId));
  await audit(actor, { action: 'payment.expired', entity: 'payment', entityId: paymentId });
  redirect('/admin/paiements');
}
