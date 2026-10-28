'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { deliveryZones, storeSettings } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { newId } from '@/lib/utils';

export type SettingsState = { error?: string; success?: string };

function optional(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

/** Réglages de la boutique : coordonnées, horaires, Wave, paiement à la livraison. */
export async function saveSettingsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  let actor;
  try {
    actor = await requirePermission('settings.write');
  } catch {
    return { error: 'Action réservée aux administrateurs.' };
  }

  const phone = optional(formData.get('phone'));
  const whatsapp = optional(formData.get('whatsapp'));
  const email = optional(formData.get('email'));
  const waveNumber = optional(formData.get('waveNumber'));
  const codMax = Number(formData.get('codMaxAmount') ?? 0);
  const lowStock = Number(formData.get('lowStockThreshold') ?? 5);
  const reservation = Number(formData.get('reservationMinutes') ?? 120);

  if (phone && !/^\+?[\d\s().-]{8,20}$/.test(phone)) return { error: 'Numéro de téléphone invalide.' };
  if (whatsapp && !/^\+?[\d\s().-]{8,20}$/.test(whatsapp)) return { error: 'Numéro WhatsApp invalide.' };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Adresse e-mail invalide.' };
  if (!Number.isFinite(codMax) || codMax < 0) return { error: 'Plafond de paiement à la livraison invalide.' };
  if (!Number.isFinite(lowStock) || lowStock < 0) return { error: 'Seuil de stock faible invalide.' };
  if (!Number.isFinite(reservation) || reservation < 15) return { error: 'Durée de réservation minimale : 15 minutes.' };

  const values = {
    storeName: String(formData.get('storeName') ?? 'MeDi').trim() || 'MeDi',
    tagline: optional(formData.get('tagline')),
    phone,
    whatsapp,
    email,
    addressLine: optional(formData.get('addressLine')),
    city: String(formData.get('city') ?? 'Daloa').trim() || 'Daloa',
    openingHours: optional(formData.get('openingHours')),
    waveNumber,
    waveMerchantName: optional(formData.get('waveMerchantName')),
    allowCod: formData.get('allowCod') === 'on',
    codMaxAmount: String(Math.max(0, Math.round(codMax))),
    allowPickup: formData.get('allowPickup') === 'on',
    allowLocalDelivery: formData.get('allowLocalDelivery') === 'on',
    lowStockThreshold: Math.round(lowStock),
    reservationMinutes: Math.round(reservation),
    freeDeliveryAbove: formData.get('freeDeliveryAbove') ? String(Math.max(0, Math.round(Number(formData.get('freeDeliveryAbove'))))) : null,
    facebookUrl: optional(formData.get('facebookUrl')),
    instagramUrl: optional(formData.get('instagramUrl')),
    legalNotice: optional(formData.get('legalNotice')),
    returnPolicy: optional(formData.get('returnPolicy')),
    updatedAt: new Date(),
  };

  await db.insert(storeSettings).values({ id: 1, ...values }).onConflictDoUpdate({ target: storeSettings.id, set: values });
  await audit(actor, { action: 'settings.updated', entity: 'store_settings', entityId: '1', metadata: { allowCod: values.allowCod } });

  revalidatePath('/');
  revalidatePath('/admin/parametres');
  revalidatePath('/livraison');
  return { success: 'Réglages enregistrés.' };
}

export async function saveZoneAction(formData: FormData) {
  const actor = await requirePermission('settings.write').catch(() => null);
  if (!actor) redirect('/admin/livraison');

  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  const fee = Number(formData.get('fee') ?? 0);
  const freeAbove = formData.get('freeAbove') ? Number(formData.get('freeAbove')) : null;

  if (name.length < 2 || city.length < 2) redirect('/admin/livraison?erreur=champs');
  if (!Number.isFinite(fee) || fee < 0) redirect('/admin/livraison?erreur=frais');

  const values = {
    name,
    city,
    isLocal: formData.get('isLocal') === 'on',
    isPickup: formData.get('isPickup') === 'on',
    fee: String(Math.round(fee)),
    freeAbove: freeAbove === null ? null : String(Math.round(freeAbove)),
    estimatedDelay: optional(formData.get('estimatedDelay')),
    isActive: formData.get('isActive') === 'on',
    sortOrder: Number(formData.get('sortOrder') ?? 0) || 0,
    updatedAt: new Date(),
  };

  if (id) {
    await db.update(deliveryZones).set(values).where(eq(deliveryZones.id, id));
    await audit(actor, { action: 'delivery_zone.updated', entity: 'delivery_zone', entityId: id, metadata: { fee: values.fee } });
  } else {
    const newIdValue = newId('zone_');
    await db.insert(deliveryZones).values({ id: newIdValue, ...values });
    await audit(actor, { action: 'delivery_zone.created', entity: 'delivery_zone', entityId: newIdValue, metadata: { fee: values.fee } });
  }

  revalidatePath('/admin/livraison');
  revalidatePath('/commande');
  redirect('/admin/livraison');
}

export async function deleteZoneAction(formData: FormData) {
  const actor = await requirePermission('settings.write').catch(() => null);
  if (!actor) redirect('/admin/livraison');
  const id = String(formData.get('id') ?? '');
  // Désactivation plutôt que suppression : les commandes historiques y font référence.
  await db.update(deliveryZones).set({ isActive: false, updatedAt: new Date() }).where(eq(deliveryZones.id, id));
  await audit(actor, { action: 'delivery_zone.disabled', entity: 'delivery_zone', entityId: id });
  redirect('/admin/livraison');
}
