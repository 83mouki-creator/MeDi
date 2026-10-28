import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db';
import { deliveryZones, type DeliveryZone } from '../db/schema';
import { toFcfa } from './utils';
import type { PublicSettings } from './settings';

export type DeliveryMethod = 'PICKUP' | 'LOCAL_DELIVERY' | 'CARRIER';
export type PaymentMethod = 'WAVE' | 'CASH_ON_DELIVERY' | 'CASH_IN_STORE';

export type DeliveryQuote = {
  zone: DeliveryZone | null;
  method: DeliveryMethod;
  /** true si la destination est Daloa et sa zone locale */
  isLocal: boolean;
  fee: number;
  /** prépaiement obligatoire (hors Daloa) */
  prepaymentRequired: boolean;
  availableMethods: PaymentMethod[];
  errors: string[];
};

export async function listZones(activeOnly = true) {
  const where = activeOnly ? eq(deliveryZones.isActive, true) : undefined;
  return db.select().from(deliveryZones).where(where).orderBy(asc(deliveryZones.sortOrder), asc(deliveryZones.name));
}

export function zoneIsLocal(zone: DeliveryZone): boolean {
  return zone.isLocal;
}

/**
 * Calcule les frais de livraison et les moyens de paiement autorisés.
 * Aucun barème n'est inventé : les frais viennent exclusivement de `delivery_zones`
 * (configurés par l'administrateur).
 */
export async function quoteDelivery(params: {
  method: DeliveryMethod;
  zoneId?: string | null;
  subtotal: number;
  settings: PublicSettings;
}): Promise<DeliveryQuote> {
  const { method, subtotal, settings } = params;
  const errors: string[] = [];

  let zone: DeliveryZone | null = null;
  if (params.zoneId) {
    const rows = await db.select().from(deliveryZones).where(eq(deliveryZones.id, params.zoneId)).limit(1);
    zone = rows[0] ?? null;
    if (!zone || !zone.isActive) {
      errors.push('Zone de livraison inconnue ou désactivée.');
      zone = null;
    }
  }

  if (method === 'PICKUP') {
    if (!settings.allowPickup) errors.push("Le retrait en boutique n'est pas disponible actuellement.");
    return {
      zone,
      method,
      isLocal: true,
      fee: 0,
      prepaymentRequired: false,
      availableMethods: buildPaymentMethods({ isLocal: true, method, total: subtotal, settings }),
      errors,
    };
  }

  if (!zone) {
    errors.push('Sélectionnez une zone de livraison.');
    return {
      zone: null,
      method,
      isLocal: false,
      fee: 0,
      prepaymentRequired: true,
      availableMethods: ['WAVE'],
      errors,
    };
  }

  const isLocal = zone.isLocal;

  if (method === 'LOCAL_DELIVERY' && !isLocal) {
    errors.push("La livraison à domicile n'est configurée que pour la zone locale de Daloa.");
  }
  if (method === 'LOCAL_DELIVERY' && !settings.allowLocalDelivery) {
    errors.push("La livraison à domicile n'est pas disponible actuellement.");
  }
  if (method === 'CARRIER' && isLocal) {
    errors.push('Pour Daloa, choisissez le retrait en boutique ou la livraison à domicile.');
  }

  const baseFee = toFcfa(zone.fee);
  const freeAbove = zone.freeAbove !== null ? toFcfa(zone.freeAbove) : settings.freeDeliveryAbove;
  const fee = method === 'LOCAL_DELIVERY' && freeAbove !== null && subtotal >= freeAbove ? 0 : baseFee;

  // Hors de Daloa : prépaiement intégral obligatoire avant expédition.
  const prepaymentRequired = !isLocal;

  return {
    zone,
    method,
    isLocal,
    fee,
    prepaymentRequired,
    availableMethods: buildPaymentMethods({
      isLocal,
      method,
      total: subtotal + fee,
      settings,
    }),
    errors,
  };
}

export function buildPaymentMethods(params: {
  isLocal: boolean;
  method: DeliveryMethod;
  total: number;
  settings: PublicSettings;
}): PaymentMethod[] {
  const { isLocal, method, total, settings } = params;
  const methods: PaymentMethod[] = ['WAVE'];

  if (!isLocal) {
    // Hors Daloa : uniquement le prépaiement.
    return methods;
  }

  if (settings.allowCod && settings.codMaxAmount > 0 && total <= settings.codMaxAmount && method !== 'PICKUP') {
    methods.push('CASH_ON_DELIVERY');
  }
  if (method === 'PICKUP') {
    methods.push('CASH_IN_STORE');
  }
  return methods;
}

export const deliveryMethodLabels: Record<DeliveryMethod, string> = {
  PICKUP: 'Retrait en boutique (Daloa)',
  LOCAL_DELIVERY: 'Livraison à domicile (Daloa)',
  CARRIER: 'Expédition par transporteur (hors Daloa)',
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  WAVE: 'Wave (paiement mobile)',
  CASH_ON_DELIVERY: 'Paiement à la livraison',
  CASH_IN_STORE: 'Paiement en boutique au retrait',
};

export function isMethodAvailable(
  quote: { availableMethods: PaymentMethod[] },
  method: PaymentMethod,
): boolean {
  return quote.availableMethods.includes(method);
}

export async function findZoneByCity(city: string) {
  const rows = await db
    .select()
    .from(deliveryZones)
    .where(and(eq(deliveryZones.isActive, true), eq(deliveryZones.city, city)))
    .limit(1);
  return rows[0] ?? null;
}
