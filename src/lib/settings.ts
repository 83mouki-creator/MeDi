import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { storeSettings, type StoreSetting } from '../db/schema';
import { env } from './env';
import { STORE_NAME, STORE_TAGLINE, STORE_WHATSAPP, STORE_WHATSAPP_DIGITS } from './brand';

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
  /** Compte marchand de l'agrégateur de paiement (mobile money / carte). */
  pspMerchantNumber: string | null;
  pspMerchantLabel: string | null;
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
  // booléens de configuration (pas des données commerciales)
  waveAutoConfigured: boolean;
  storageConfigured: boolean;
  visionProvider: string;
};

const FALLBACK: StoreSetting = {
  id: 1,
  storeName: STORE_NAME,
  tagline: STORE_TAGLINE,
  phone: STORE_WHATSAPP,
  whatsapp: STORE_WHATSAPP,
  email: null,
  addressLine: null,
  city: 'Daloa',
  country: "Côte d'Ivoire",
  openingHours: null,
  waveNumber: STORE_WHATSAPP,
  waveMerchantName: STORE_NAME,
  waveMode: 'MANUAL',
  pspMerchantNumber: STORE_WHATSAPP,
  pspMerchantLabel: 'Wave / compte marchand',
  allowCod: false,
  codMaxAmount: '0',
  /** Le retrait en magasin n'existe plus dans le parcours de vente. */
  allowPickup: false,
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
  return {
    storeName: s.storeName || STORE_NAME,
    // Le slogan fait partie de l'identité : s'il n'est pas saisi, on affiche
    // celui de la marque plutôt qu'un vide.
    tagline: s.tagline?.trim() || STORE_TAGLINE,
    phone: s.phone?.trim() || STORE_WHATSAPP,
    whatsapp: s.whatsapp?.trim() || STORE_WHATSAPP_DIGITS,
    email: s.email,
    addressLine: s.addressLine,
    city: s.city,
    country: s.country,
    openingHours: s.openingHours,
    waveNumber: s.waveNumber ?? env.wave.merchantNumber ?? env.psp.merchantNumber ?? null,
    waveMerchantName: s.waveMerchantName ?? null,
    waveMode: env.wave.mode === 'AUTO' && env.wave.enabled ? 'AUTO' : s.waveMode,
    pspMerchantNumber: s.pspMerchantNumber ?? env.psp.merchantNumber ?? null,
    pspMerchantLabel: s.pspMerchantLabel ?? env.psp.merchantLabel ?? null,
    allowCod: s.allowCod,
    codMaxAmount: Number(s.codMaxAmount ?? 0),
    // Le retrait en magasin est retiré du parcours : quel que soit l'ancien
    // réglage en base, il reste désactivé.
    allowPickup: false,
    allowLocalDelivery: s.allowLocalDelivery,
    lowStockThreshold: s.lowStockThreshold,
    reservationMinutes: s.reservationMinutes,
    freeDeliveryAbove: s.freeDeliveryAbove === null ? null : Number(s.freeDeliveryAbove),
    facebookUrl: s.facebookUrl,
    instagramUrl: s.instagramUrl,
    legalNotice: s.legalNotice,
    returnPolicy: s.returnPolicy,
    waveAutoConfigured: env.wave.mode === 'AUTO' && env.wave.enabled,
    storageConfigured: env.storage.configured,
    visionProvider: env.vision.provider,
  };
});

/**
 * Lien WhatsApp prêt à l'emploi.
 *
 * Le numéro vient de /admin/parametres ; à défaut, celui de la marque
 * (`+225 05 44 01 41 82`) est utilisé, pour que le bouton d'aide fonctionne dès
 * la première installation.
 */
export function whatsappLink(
  settings: Pick<PublicSettings, 'whatsapp'>,
  message = `Bonjour ${STORE_NAME}, je souhaite des informations sur un produit.`,
) {
  const raw = settings.whatsapp?.trim() || STORE_WHATSAPP_DIGITS;
  const number = raw.replace(/[^\d]/g, '');
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
