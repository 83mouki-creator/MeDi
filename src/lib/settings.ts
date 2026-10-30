import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { storeSettings, type StoreSetting } from '../db/schema';
import { env } from './env';
import { parseCoordinates, type GeoPoint } from './geo';

/**
 * Réglages de la boutique. Les informations commerciales (téléphone, adresse,
 * horaires, numéro Wave) ne sont jamais inventées : elles restent `null` tant
 * que le propriétaire ne les a pas saisies dans /admin/parametres.
 */
export type PublicSettings = {
  storeName: string;
  tagline: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  addressLine: string | null;
  city: string;
  country: string;
  openingHours: string | null;
  waveNumber: string | null;
  waveMerchantName: string | null;
  waveMode: string;
  allowCod: boolean;
  codMaxAmount: number;
  allowPickup: boolean;
  allowLocalDelivery: boolean;
  lowStockThreshold: number;
  reservationMinutes: number;
  freeDeliveryAbove: number | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  legalNotice: string | null;
  returnPolicy: string | null;
  /** Coordonnées exactes de la boutique — `null` tant qu'elles ne sont pas fournies. */
  geo: GeoPoint | null;
  /** Valeur brute saisie dans l'admin, pour réafficher le formulaire tel quel. */
  latitudeInput: string | null;
  longitudeInput: string | null;
  // booléens de configuration (pas des données commerciales)
  waveAutoConfigured: boolean;
  storageConfigured: boolean;
  visionProvider: string;
};

const FALLBACK: StoreSetting = {
  id: 1,
  storeName: 'MeDi',
  tagline: null,
  phone: null,
  whatsapp: null,
  email: null,
  addressLine: null,
  city: 'Daloa',
  country: "Côte d'Ivoire",
  openingHours: null,
  waveNumber: null,
  waveMerchantName: null,
  waveMode: 'MANUAL',
  allowCod: false,
  codMaxAmount: '0',
  allowPickup: true,
  allowLocalDelivery: true,
  lowStockThreshold: 5,
  reservationMinutes: 120,
  freeDeliveryAbove: null,
  facebookUrl: null,
  instagramUrl: null,
  legalNotice: null,
  returnPolicy: null,
  latitude: null,
  longitude: null,
  updatedAt: new Date(),
};

export const getStoreSettings = cache(async (): Promise<PublicSettings> => {
  let row: StoreSetting | undefined;
  try {
    const rows = await db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1);
    row = rows[0];
  } catch (error) {
    // La table peut ne pas encore exister (première installation) : on ne casse
    // pas le rendu pour autant, les pages affichent « information à compléter ».
    console.error('[settings] lecture impossible', error);
  }

  const s = row ?? FALLBACK;
  const coordinates = parseCoordinates({ latitude: s.latitude, longitude: s.longitude });
  return {
    storeName: s.storeName,
    tagline: s.tagline,
    phone: s.phone,
    whatsapp: s.whatsapp,
    email: s.email,
    addressLine: s.addressLine,
    city: s.city,
    country: s.country,
    openingHours: s.openingHours,
    waveNumber: s.waveNumber ?? env.wave.merchantNumber ?? null,
    waveMerchantName: s.waveMerchantName ?? null,
    waveMode: env.wave.mode === 'AUTO' && env.wave.enabled ? 'AUTO' : s.waveMode,
    allowCod: s.allowCod,
    codMaxAmount: Number(s.codMaxAmount ?? 0),
    allowPickup: s.allowPickup,
    allowLocalDelivery: s.allowLocalDelivery,
    lowStockThreshold: s.lowStockThreshold,
    reservationMinutes: s.reservationMinutes,
    freeDeliveryAbove: s.freeDeliveryAbove === null ? null : Number(s.freeDeliveryAbove),
    facebookUrl: s.facebookUrl,
    instagramUrl: s.instagramUrl,
    legalNotice: s.legalNotice,
    returnPolicy: s.returnPolicy,
    geo: coordinates.status === 'ok' ? coordinates.point : null,
    latitudeInput: s.latitude,
    longitudeInput: s.longitude,
    waveAutoConfigured: env.wave.mode === 'AUTO' && env.wave.enabled,
    storageConfigured: env.storage.configured,
    visionProvider: env.vision.provider,
  };
});

/** Lien WhatsApp prêt à l'emploi si le numéro officiel est renseigné. */
export function whatsappLink(settings: PublicSettings, message = 'Bonjour MeDi, je souhaite des informations sur un produit.') {
  if (!settings.whatsapp) return null;
  const number = settings.whatsapp.replace(/[^\d]/g, '');
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
