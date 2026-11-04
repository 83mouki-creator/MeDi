/**
 * Configuration commerciale de la boutique.
 *
 *   npm run config:store            # remplit uniquement les champs encore vides
 *   npm run config:store -- --force # réapplique toutes les valeurs ci-dessous
 *
 * Ces valeurs ont été COMMUNIQUÉES PAR LE PROPRIÉTAIRE de la boutique :
 *   • horaires      : lundi – samedi 7h30 – 18h00, dimanche fermé
 *   • WhatsApp      : +225 07 08 90 48 91
 *   • numéro Wave   : le numéro WhatsApp ci-dessus (solution provisoire)
 *   • adresse exacte : 6°53'04.4"N 6°26'50.9"W (relevé Google Maps)
 *   • retrait       : 48 h maximum après confirmation
 *   • hors Daloa    : 7 jours maximum selon la ville, transport convenu sur WhatsApp
 *
 * Le barème de livraison a été ARRÊTÉ PAR LE PRESTATAIRE à la demande du
 * propriétaire ; il est entièrement modifiable dans /admin/livraison. Aucun
 * montant n'est calculé ailleurs : le tunnel de commande lit ces lignes.
 *
 * Daloa : le client choisit son QUARTIER, et le quartier détermine la zone donc le
 * tarif. Chaque zone locale porte donc la liste de ses quartiers.
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, pool } from '../src/db';
import { deliveryZones, storeSettings } from '../src/db/schema';
import { neighbourhoodsForBand } from '../src/lib/daloa';
import { STORE_COORDINATES, STORE_GPS_DMS } from '../src/lib/store-location';

const FORCE = process.argv.includes('--force');

const PHONE_DISPLAY = '+225 07 08 90 48 91';
const WHATSAPP = '+2250708904891'; // format international, sans espaces (liens wa.me)

type ZoneSeed = {
  id: string;
  name: string;
  city: string;
  isLocal: boolean;
  isPickup: boolean;
  fee: number;
  delay: string;
  order: number;
  /** Quartiers desservis (Daloa uniquement). */
  neighbourhoods?: string[];
};

/**
 * Barème de livraison.
 * Daloa : retrait gratuit, livraison à domicile 1 000 FCFA, périphérie 2 000 FCFA.
 * Hors Daloa : le site n'ajoute AUCUN frais de transport — le prix se convient sur
 * WhatsApp, et les articles se règlent avant l'expédition (7 jours maximum).
 */
const ZONES: ZoneSeed[] = [
  {
    id: 'zone_medi_pickup',
    name: 'Retrait en boutique — Daloa',
    city: 'Daloa',
    isLocal: true,
    isPickup: true,
    fee: 0,
    delay: 'Retrait sous 48 h maximum, pendant les heures d’ouverture',
    order: 0,
  },
  {
    id: 'zone_medi_daloa_centre',
    name: 'Daloa — livraison à domicile (centre)',
    city: 'Daloa',
    isLocal: true,
    isPickup: false,
    fee: 1_000,
    delay: 'Le jour même ou le lendemain, aux heures d’ouverture',
    order: 1,
    neighbourhoods: neighbourhoodsForBand('CENTRE'),
  },
  {
    id: 'zone_medi_daloa_peripherie',
    name: 'Daloa — livraison à domicile (périphérie)',
    city: 'Daloa',
    isLocal: true,
    isPickup: false,
    fee: 2_000,
    delay: 'Sous 48 h, aux heures d’ouverture',
    order: 2,
    neighbourhoods: neighbourhoodsForBand('PERIPHERIE'),
  },
  {
    id: 'zone_medi_abidjan',
    name: 'Abidjan — expédition',
    city: 'Abidjan',
    isLocal: false,
    isPickup: false,
    fee: 0,
    delay: '7 jours maximum, transport à convenir sur WhatsApp',
    order: 3,
  },
  {
    id: 'zone_medi_yamoussoukro',
    name: 'Yamoussoukro — expédition',
    city: 'Yamoussoukro',
    isLocal: false,
    isPickup: false,
    fee: 0,
    delay: '7 jours maximum, transport à convenir sur WhatsApp',
    order: 4,
  },
  {
    id: 'zone_medi_bouake',
    name: 'Bouaké — expédition',
    city: 'Bouaké',
    isLocal: false,
    isPickup: false,
    fee: 0,
    delay: '7 jours maximum, transport à convenir sur WhatsApp',
    order: 5,
  },
  {
    id: 'zone_medi_sanpedro',
    name: 'San-Pédro — expédition',
    city: 'San-Pédro',
    isLocal: false,
    isPickup: false,
    fee: 0,
    delay: '7 jours maximum, transport à convenir sur WhatsApp',
    order: 6,
  },
  {
    id: 'zone_medi_autre',
    name: 'Autre ville — Côte d’Ivoire',
    city: 'Autre ville',
    isLocal: false,
    isPickup: false,
    fee: 0,
    delay: '7 jours maximum, transport à convenir sur WhatsApp',
    order: 7,
  },
];

async function main() {
  const existing = (await db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1))[0];

  const target = {
    phone: PHONE_DISPLAY,
    whatsapp: WHATSAPP,
    openingHours: 'Lundi – samedi : 7h30 – 18h00 · Dimanche : fermé',
    waveNumber: PHONE_DISPLAY,
    waveMerchantName: existing?.waveMerchantName ?? 'MeDi Shop',
    // Adresse exacte communiquée par le propriétaire (relevé Google Maps).
    addressLine: `${STORE_GPS_DMS} — Daloa`,
    latitude: String(STORE_COORDINATES.latitude),
    longitude: String(STORE_COORDINATES.longitude),
  };

  if (!existing) {
    await db.insert(storeSettings).values({
      id: 1,
      storeName: 'MeDi Shop',
      city: 'Daloa',
      country: "Côte d'Ivoire",
      waveMode: 'MANUAL',
      allowCod: false,
      allowPickup: true,
      allowLocalDelivery: true,
      lowStockThreshold: 5,
      reservationMinutes: 120,
      ...target,
    });
    console.log('✔ Réglages boutique créés');
  } else {
    const patch: Record<string, string> = {};
    for (const [key, value] of Object.entries(target)) {
      const current = existing[key as keyof typeof existing];
      const isEmpty = current === null || current === undefined || current === '';
      if (FORCE || isEmpty) patch[key] = value;
    }
    if (Object.keys(patch).length > 0) {
      await db
        .update(storeSettings)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(storeSettings.id, 1));
      console.log(`✔ Réglages boutique mis à jour : ${Object.keys(patch).join(', ')}`);
    } else {
      console.log('→ Réglages boutique déjà renseignés (aucune modification)');
    }
  }

  const known = await db.select({ id: deliveryZones.id }).from(deliveryZones);
  const knownIds = new Set(known.map((row) => row.id));
  let created = 0;
  let updated = 0;

  for (const zone of ZONES) {
    const values = {
      id: zone.id,
      name: zone.name,
      city: zone.city,
      isLocal: zone.isLocal,
      isPickup: zone.isPickup,
      fee: String(zone.fee),
      freeAbove: null,
      estimatedDelay: zone.delay,
      neighbourhoods: zone.neighbourhoods ?? [],
      sortOrder: zone.order,
      isActive: true,
      updatedAt: new Date(),
    };

    if (!knownIds.has(zone.id)) {
      await db.insert(deliveryZones).values(values);
      created += 1;
    } else if (FORCE) {
      await db
        .update(deliveryZones)
        .set({
          name: values.name,
          city: values.city,
          isLocal: values.isLocal,
          isPickup: values.isPickup,
          fee: values.fee,
          freeAbove: null,
          estimatedDelay: values.estimatedDelay,
          neighbourhoods: values.neighbourhoods,
          sortOrder: values.sortOrder,
          isActive: true,
          updatedAt: values.updatedAt,
        })
        .where(eq(deliveryZones.id, zone.id));
      updated += 1;
    }
  }

  // Zones historiques (seed de démonstration) : désactivées, jamais supprimées,
  // car des commandes passées peuvent y faire référence. Liste explicite pour ne
  // jamais toucher aux zones créées plus tard par le propriétaire.
  const LEGACY_ZONE_IDS = [
    'zone_pickup_daloa',
    'zone_daloa_domicile',
    'zone_daloa_centre',
    'zone_daloa_peripherie',
    'zone_abidjan',
    'zone_yamoussoukro',
    'zone_bouake',
    'zone_sanpedro',
    'zone_autre',
  ];
  let deactivated = 0;
  for (const id of LEGACY_ZONE_IDS) {
    const rows = await db.select({ isActive: deliveryZones.isActive }).from(deliveryZones).where(eq(deliveryZones.id, id)).limit(1);
    if (!rows[0] || !rows[0].isActive) continue;
    await db.update(deliveryZones).set({ isActive: false, updatedAt: new Date() }).where(eq(deliveryZones.id, id));
    deactivated += 1;
  }

  console.log(`   zones de livraison : ${created} créée(s), ${updated} mise(s) à jour, ${ZONES.length} au total`);
  if (deactivated > 0) console.log(`   anciennes zones de démonstration désactivées : ${deactivated}`);
  console.log(`   adresse exacte de la boutique : ${STORE_GPS_DMS} (${STORE_COORDINATES.latitude}, ${STORE_COORDINATES.longitude})`);
  await pool.end();
}

main().catch(async (error) => {
  console.error('Échec de la configuration de la boutique :', error);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
