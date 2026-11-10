import { readFileSync } from 'node:fs';
import path from 'node:path';
import { and, eq, gt, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, contactMessages, deliveryZones, orders, products, productImages, promotions, shipments, storeSettings, users } from '@/db/schema';
import { env } from './env';
import { storageMode } from './storage';
import { computeReadiness, type ReadinessCheck, type ReadinessReport, type ReadinessSnapshot } from './readiness';

/**
 * Assemble le diagnostic « prêt à vendre » avec les données réelles.
 *
 * Tout est lu en base au moment de l'affichage (aucune valeur en dur) : si le
 * propriétaire complète un champ, la page change immédiatement. Les compteurs
 * sont des `count(*)` filtrés, donc ils restent exacts avec 5 000 références.
 */
export async function getReadinessReport(): Promise<{ report: ReadinessReport; snapshot: ReadinessSnapshot }> {
  let database = true;
  let settingsRow: typeof storeSettings.$inferSelect | undefined;

  try {
    const rows = await db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1);
    settingsRow = rows[0];
  } catch (error) {
    database = false;
    console.error('[readiness] réglages illisibles', error);
  }

  const count = async (query: Promise<{ value: number }[]>): Promise<number> => {
    try {
      return Number((await query)[0]?.value ?? 0);
    } catch (error) {
      console.error('[readiness] comptage impossible', error);
      return 0;
    }
  };

  const activeProduct = eq(products.isActive, true);

  const [activeProducts, inStockProducts, withPhoto, zeroPrice, categoryCount, activePromotions] = database
    ? await Promise.all([
        count(db.select({ value: sql<number>`count(*)::int` }).from(products).where(activeProduct)),
        count(
          db
            .select({ value: sql<number>`count(*)::int` })
            .from(products)
            .where(and(activeProduct, sql`${products.stock} > ${products.reserved}`)),
        ),
        count(
          db
            .select({ value: sql<number>`count(distinct ${products.id})::int` })
            .from(products)
            .innerJoin(productImages, eq(productImages.productId, products.id))
            .where(activeProduct),
        ),
        count(
          db
            .select({ value: sql<number>`count(*)::int` })
            .from(products)
            .where(and(activeProduct, sql`${products.price} <= 0`)),
        ),
        count(db.select({ value: sql<number>`count(*)::int` }).from(categories)),
        count(
          db
            .select({ value: sql<number>`count(*)::int` })
            .from(promotions)
            .where(and(eq(promotions.isActive, true), gt(promotions.endsAt, new Date()))),
        ),
      ])
    : [0, 0, 0, 0, 0, 0];

  let managerAccounts = 0;
  let activeStaff = 0;

  if (database) {
    try {
      const staffRows = await db
        .select({ role: users.role, total: sql<number>`count(*)::int` })
        .from(users)
        // Tous les comptes internes : tout sauf les clients de la boutique.
        .where(and(eq(users.isActive, true), ne(users.role, 'CUSTOMER')))
        .groupBy(users.role);

      for (const row of staffRows) {
        if (row.role === 'OWNER' || row.role === 'ADMIN') managerAccounts += Number(row.total);
        else activeStaff += Number(row.total);
      }
    } catch (error) {
      console.error('[readiness] comptes illisibles', error);
    }
  }

  let localZonesWithTariff = 0;
  let nationalZones = 0;

  if (database) {
    try {
      const zones = await db
        .select({ isLocal: deliveryZones.isLocal, isPickup: deliveryZones.isPickup, city: deliveryZones.city, fee: deliveryZones.fee })
        .from(deliveryZones)
        .where(eq(deliveryZones.isActive, true));

      localZonesWithTariff = zones.filter((z) => z.isLocal && !z.isPickup && Number(z.fee) >= 0).length;
      nationalZones = zones.filter((z) => !z.isLocal && !z.isPickup).length;
    } catch (error) {
      console.error('[readiness] zones de livraison illisibles', error);
    }
  }

  // ── Ce qui se passe après la commande ────────────────────────────────────
  let awaitingDispatch = 0;
  let inTransit = 0;
  let unansweredMessages = 0;

  if (database) {
    try {
      const [dispatchRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(orders)
        .where(
          and(
            eq(orders.deliveryMethod, 'CARRIER'),
            eq(orders.paymentStatus, 'PAID'),
            inArray(orders.status, ['PAYMENT_CONFIRMED', 'PREPARING', 'READY_TO_SHIP']),
            isNull(orders.trackingNumber),
          ),
        );
      awaitingDispatch = Number(dispatchRow?.total ?? 0);

      const [transitRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(shipments)
        .where(inArray(shipments.status, ['PENDING', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED']));
      inTransit = Number(transitRow?.total ?? 0);

      const [messagesRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(contactMessages)
        .where(eq(contactMessages.status, 'NEW'));
      unansweredMessages = Number(messagesRow?.total ?? 0);
    } catch (error) {
      console.error('[readiness] activité illisible', error);
    }
  }

  const settings = settingsRow;
  const snapshot: ReadinessSnapshot = {
    settings: {
      phone: settings?.phone ?? null,
      whatsapp: settings?.whatsapp ?? env.wave.merchantNumber ?? null,
      email: settings?.email ?? null,
      addressLine: settings?.addressLine ?? null,

      openingHours: settings?.openingHours ?? null,
      waveNumber: settings?.waveNumber ?? env.wave.merchantNumber ?? null,
      waveMerchantName: settings?.waveMerchantName ?? null,
      legalNotice: settings?.legalNotice ?? null,

      allowLocalDelivery: settings?.allowLocalDelivery ?? true,
      allowCod: settings?.allowCod ?? false,
      tagline: settings?.tagline ?? null,
    },
    catalog: {
      activeProducts,
      inStockProducts,
      withPhoto,
      zeroPrice,
      categories: categoryCount,
      activePromotions,
    },
    delivery: { localZonesWithTariff, nationalZones },
    staff: { managerAccounts, activeStaff },
    operations: {
      awaitingDispatch,
      inTransit,
      carrierSync: env.colisExpress.configured,
      unansweredMessages,
      automations: cronPaths().length,
    },
    infrastructure: {
      database,
      waveAuto: database && (settings?.waveMode ?? env.wave.mode) === 'AUTO' && env.wave.enabled,
      waveManual: Boolean(settings?.waveNumber ?? env.wave.merchantNumber),
      storage: storageMode(),
      // Le personnel peut toujours recevoir ses accès sur WhatsApp : l'e-mail
      // n'est qu'un confort, jamais un blocage.
      email: env.email.configured || env.whatsapp.configured,
      cron: Boolean(process.env.CRON_SECRET),
      appUrlIsHttps: env.appUrl.startsWith('https://'),
    },
  };

  return { report: computeReadiness(snapshot), snapshot };
}

/** Points bloquants, dans l'ordre d'affichage — utilisé par le tableau de bord. */
export function blockingChecks(checks: ReadinessCheck[]): ReadinessCheck[] {
  return checks.filter((check) => check.status === 'blocking');
}

/**
 * Tâches planifiées déclarées dans `vercel.json`.
 *
 * On lit le fichier plutôt que d'inventer une liste : le diagnostic doit refléter
 * le déploiement réel, pas une intention. Un fichier absent (développement) donne
 * zéro tâche, ce qui est exact.
 */
export function cronPaths(): { path: string; schedule: string }[] {
  try {
    const raw = readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8');
    const config = JSON.parse(raw) as { crons?: { path: string; schedule: string }[] };
    return Array.isArray(config.crons) ? config.crons : [];
  } catch {
    return [];
  }
}
