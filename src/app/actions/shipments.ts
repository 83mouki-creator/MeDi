'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { requirePermission, clientIpFrom } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { recordShipment, syncShipment, updateShipmentStatus, ShipmentError, type ShipmentStatus } from '@/lib/shipments';

export type ShipmentActionState = { error?: string; success?: string };

const SHIPMENT_STATUSES: ShipmentStatus[] = ['PENDING', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'RETURNED'];

/**
 * Déclarer l'expédition d'une commande chez Colis Express.
 *
 * Réservé au personnel qui gère les livraisons. Le code de suivi n'est pas
 * généré ici : il est attribué par le transporteur, et c'est ce code que le
 * client utilisera pour suivre son colis.
 */
export async function addShipmentAction(_prev: ShipmentActionState, formData: FormData): Promise<ShipmentActionState> {
  let actor;
  try {
    actor = await requirePermission('delivery.manage');
  } catch {
    return { error: 'Action non autorisée pour votre rôle.' };
  }

  const orderId = String(formData.get('orderId') ?? '');
  const trackingNumber = String(formData.get('trackingNumber') ?? '').trim();
  const carrier = String(formData.get('carrier') ?? '').trim() || null;
  const feeRaw = String(formData.get('fee') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const fee = feeRaw ? Number(feeRaw) : undefined;

  if (!orderId) return { error: 'Commande introuvable.' };
  if (!trackingNumber) return { error: 'Saisissez le code de suivi donné par Colis Express.' };

  const ip = clientIpFrom(await headers());

  try {
    const result = await recordShipment({
      orderId,
      rawTrackingNumber: trackingNumber,
      carrier,
      fee: Number.isFinite(fee) ? fee : undefined,
      notes,
      actor,
      ip,
    });

    await audit(actor, {
      action: 'shipment.recorded',
      entity: 'order',
      entityId: orderId,
      metadata: { trackingNumber: result.code, carrier },
      ip,
    });

    revalidatePath('/admin/expeditions');
    revalidatePath(`/admin/commandes/${orderId}`);
    revalidatePath('/admin/commandes');
    return { success: `Colis expédié. Le client peut suivre ${result.code}.` };
  } catch (error) {
    if (error instanceof ShipmentError) return { error: error.message };
    console.error('[expeditions] enregistrement', error);
    return { error: 'Expédition impossible pour le moment.' };
  }
}

/** Faire avancer une expédition à la main (le transporteur prévient par WhatsApp). */
export async function updateShipmentStatusAction(_prev: ShipmentActionState, formData: FormData): Promise<ShipmentActionState> {
  let actor;
  try {
    actor = await requirePermission('delivery.manage');
  } catch {
    return { error: 'Action non autorisée pour votre rôle.' };
  }

  const shipmentId = String(formData.get('shipmentId') ?? '');
  const status = String(formData.get('status') ?? '') as ShipmentStatus;
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!shipmentId || !SHIPMENT_STATUSES.includes(status)) return { error: 'Requête invalide.' };

  try {
    await updateShipmentStatus({ shipmentId, status, note, actor });
    revalidatePath('/admin/expeditions');
    return { success: 'Statut de l’expédition mis à jour.' };
  } catch (error) {
    if (error instanceof ShipmentError) return { error: error.message };
    console.error('[expeditions] statut', error);
    return { error: 'Mise à jour impossible.' };
  }
}

/**
 * Demander à Colis Express le dernier statut du colis.
 *
 * Sans API configurée, l'action le dit clairement (« le lien de suivi reste la
 * source ») au lieu de laisser croire à une synchronisation.
 */
export async function syncShipmentAction(_prev: ShipmentActionState, formData: FormData): Promise<ShipmentActionState> {
  try {
    const actor = await requirePermission('delivery.manage');
    const shipmentId = String(formData.get('shipmentId') ?? '');
    if (!shipmentId) return { error: 'Requête invalide.' };

    const result = await syncShipment(shipmentId);

    if (!result.configured) {
      await audit(actor, {
        action: 'shipment.sync_unavailable',
        entity: 'shipment',
        entityId: shipmentId,
        metadata: {},
        ip: clientIpFrom(await headers()),
      }).catch(() => undefined);
      return {
        error:
          'La synchronisation automatique n’est pas configurée (COLIS_EXPRESS_API_BASE). Ouvrez le lien de suivi ci-contre pour voir où en est le colis.',
      };
    }

    if (result.error) return { error: result.error };

    revalidatePath('/admin/expeditions');
    return { success: result.label ? `Colis Express : ${result.label}` : 'Colis Express n’a pas renvoyé de statut.' };
  } catch {
    return { error: 'Action non autorisée pour votre rôle.' };
  }
}
