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
 *
 * Le barème de livraison a été ARRÊTÉ PAR LE PRESTATAIRE à la demande du
 * propriétaire ; il est entièrement modifiable dans /admin/livraison. Aucun
 * montant n'est calculé ailleurs : le tunnel de commande lit ces lignes.
 *
 * L'adresse de la boutique n'a pas été communiquée : elle reste vide, et le site
 * affiche « à compléter » plutôt qu'une adresse inventée.
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, pool } from '../src/db';
import { deliveryZones, storeSettings } from '../src/db/schema';

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
};

/**
 * Barème de livraison.
 * Daloa : retrait gratuit, livraison à domicile 1 000 FCFA, périphérie 2 000 FCFA.
 * Hors Daloa : expédition en prépaiement, tarif indicatif par ville desservie.
 */
const ZONES: ZoneSeed[] = [
  {
    id: 'zone_pickup_daloa',
    name: 'Retrait en boutique — Daloa',
    city: 'Daloa',
    isLocal: true,
    isPickup: true,
    fee: 0,
    delay: 'Pendant les horaires d’ouverture (lun–sam 7h30–18h)',
    order: 0,
  },
  {
    id: 'zone_daloa_centre',
    name: 'Daloa — livraison à domicile (centre)',
    city: 'Daloa',
    isLocal: true,
    isPickup: false,
    fee: 1_000,
    delay: 'Sous 24 h ouvrées',
    order: 1,
  },
  {
    id: 'zone_daloa_peripherie',
    name: 'Daloa — livraison à domicile (périphérie)',
    city: 'Daloa',
    isLocal: true,
    isPickup: false,
    fee: 2_000,
    delay: 'Sous 48 h ouvrées',
    order: 2,
  },
  {
    id: 'zone_abidjan',
    name: 'Abidjan — expédition',
    city: 'Abidjan',
    isLocal: false,
    isPickup: false,
    fee: 4_000,
    delay: '2 à 4 jours par car, après paiement confirmé',
    order: 3,
  },
  {
    id: 'zone_yamoussoukro',
    name: 'Yamoussoukro — expédition',
    city: 'Yamoussoukro',
    isLocal: false,
    isPickup: false,
    fee: 3_000,
    delay: '2 à 3 jours par car, après paiement confirmé',
    order: 4,
  },
  {
    id: 'zone_bouake',
    name: 'Bouaké — expédition',
    city: 'Bouaké',
    isLocal: false,
    isPickup: false,
    fee: 4_000,
    delay: '2 à 4 jours par car, après paiement confirmé',
    order: 5,
  },
  {
    id: 'zone_sanpedro',
    name: 'San-Pédro — expédition',
    city: 'San-Pédro',
    isLocal: false,
    isPickup: false,
    fee: 6_000,
    delay: '3 à 5 jours par transporteur, après paiement confirmé',
    order: 6,
  },
  {
    id: 'zone_autre',
    name: 'Autre ville — Côte d’Ivoire',
    city: 'Autre ville',
    isLocal: false,
    isPickup: false,
    fee: 5_000,
    delay: '3 à 5 jours, transporteur confirmé par la boutique',
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
    waveMerchantName: existing?.waveMerchantName ?? 'MeDi',
  };

  if (!existing) {
    await db.insert(storeSettings).values({
      id: 1,
      storeName: 'MeDi',
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
          sortOrder: values.sortOrder,
          isActive: true,
          updatedAt: values.updatedAt,
        })
        .where(eq(deliveryZones.id, zone.id));
      updated += 1;
    }
  }

  // Les anciennes zones de démonstration (« (DÉMO) ») sont désactivées, jamais
  // supprimées : des commandes passées peuvent y faire référence.
  const legacy = await db.select({ id: deliveryZones.id, name: deliveryZones.name }).from(deliveryZones);
  let deactivated = 0;
  for (const zone of legacy) {
    if (zone.name.includes('DÉMO') && ZONES.every((entry) => entry.id !== zone.id)) {
      await db.update(deliveryZones).set({ isActive: false, updatedAt: new Date() }).where(eq(deliveryZones.id, zone.id));
      deactivated += 1;
    }
  }

  console.log(`   zones de livraison : ${created} créée(s), ${updated} mise(s) à jour, ${ZONES.length} au total`);
  if (deactivated > 0) console.log(`   anciennes zones de démonstration désactivées : ${deactivated}`);
  console.log('   adresse de la boutique : non communiquée → laissée vide (affichage « à compléter »)');
  await pool.end();
}

main().catch(async (error) => {
  console.error('Échec de la configuration de la boutique :', error);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
