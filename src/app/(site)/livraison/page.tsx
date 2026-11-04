import type { Metadata } from 'next';
import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { CalendarClock, Info, MessageCircle, Navigation, PackageCheck, Store, TriangleAlert, Truck } from 'lucide-react';
import { db } from '@/db';
import { deliveryZones } from '@/db/schema';
import { getStoreSettings } from '@/lib/settings';
import { formatFCFA, toFcfa } from '@/lib/utils';
import { Alert, Card } from '@/components/ui/primitives';
import { FaqSection } from '@/components/faq-section';
import { faqJsonLd } from '@/lib/faq';
import { DELIVERY_FAQ, DELIVERY_FAQ_FALLBACK_MESSAGE } from '@/lib/delivery-faq';
import { RETURNS_FAQ, RETURNS_FAQ_FALLBACK_MESSAGE } from '@/lib/returns-faq';
import { getSiteI18n } from '@/lib/i18n/site-server';
import { storeLocation, whatsappWithMessage } from '@/lib/store-location';
import { OUTSIDE_DALOA_MAX_DAYS, PICKUP_HOLD_HOURS, FINAL_SALE_NOTICE, STORE_POLICY_VARS } from '@/lib/store-policy';
import { DALOA_NEIGHBOURHOODS, bandFromZoneName, neighbourhoodsForBand } from '@/lib/daloa';
import { PurchaseNotice } from '@/components/purchase-notice';

export const metadata: Metadata = {
  title: 'Livraison à Daloa et dans toute la Côte d’Ivoire',
  description:
    'Retrait en boutique à Daloa sous 48 h, livraison dans votre quartier de Daloa, ou livraison hors Daloa en 7 jours maximum avec transport à convenir sur WhatsApp.',
  alternates: { canonical: '/livraison' },
};

export const dynamic = 'force-dynamic';

export default async function DeliveryPage() {
  const [settings, { t }] = await Promise.all([getStoreSettings(), getSiteI18n()]);

  let zones: (typeof deliveryZones.$inferSelect)[] = [];
  try {
    zones = await db.select().from(deliveryZones).where(eq(deliveryZones.isActive, true)).orderBy(asc(deliveryZones.sortOrder));
  } catch {
    zones = [];
  }

  const local = zones.filter((zone) => zone.isLocal && !zone.isPickup);
  const national = zones.filter((zone) => !zone.isLocal && !zone.isPickup);
  const pickupZone = zones.find((zone) => zone.isPickup) ?? null;
  const faqStructuredData = faqJsonLd(DELIVERY_FAQ, settings, (text) => t(text, STORE_POLICY_VARS));
  const location = storeLocation(settings);
  const transportLink = whatsappWithMessage(
    settings,
    'Bonjour MeDi Shop, je souhaite connaître le prix du transport et le délai pour une livraison hors Daloa.',
  );

  // Quartiers rattachés à chaque zone locale : c'est la liste que voit le client.
  const neighbourhoodRows = DALOA_NEIGHBOURHOODS.map((entry) => {
    const zone = local.find((candidate) => (candidate.neighbourhoods ?? []).includes(entry.name));
    return { name: entry.name, zone: zone ?? null };
  });

  return (
    <div className="container-page max-w-4xl py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }} />
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t('Livraison et retrait')}</h1>
      <p className="mt-2 text-sm text-navy-600">
        {t('MeDi Shop opère depuis {city}. Vous choisissez d’abord où vous voulez être livré : dans un quartier de Daloa, ou ailleurs en Côte d’Ivoire.', {
          city: settings.city,
        })}
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <Store className="size-5 text-accent-600" aria-hidden />
          <h2 className="mt-2 font-bold">{t('Retrait en boutique')}</h2>
          <p className="mt-1 text-sm text-navy-600">
            {settings.allowPickup
              ? t('Gratuit. Votre colis est gardé {hours} h maximum après confirmation de la commande, pendant les heures d’ouverture.', {
                  hours: PICKUP_HOLD_HOURS,
                })
              : t('Temporairement désactivé par la boutique.')}
          </p>
        </Card>
        <Card className="p-4">
          <Truck className="size-5 text-accent-600" aria-hidden />
          <h2 className="mt-2 font-bold">{t('Livraison à Daloa')}</h2>
          <p className="mt-1 text-sm text-navy-600">
            {settings.allowLocalDelivery
              ? t('Vous choisissez votre quartier à la commande. Le prix de la livraison dépend du quartier et s’affiche avant paiement.')
              : t('Temporairement désactivée par la boutique.')}
          </p>
        </Card>
        <Card className="p-4">
          <PackageCheck className="size-5 text-accent-600" aria-hidden />
          <h2 className="mt-2 font-bold">{t('Hors Daloa')}</h2>
          <p className="mt-1 text-sm text-navy-600">
            {t('Livraison en {days} jours maximum selon la ville. Le prix du transport se discute sur WhatsApp ; les articles se règlent avant l’expédition.', {
              days: OUTSIDE_DALOA_MAX_DAYS,
            })}
          </p>
        </Card>
      </div>

      <section className="mt-8" aria-labelledby="daloa-quartiers">
        <h2 id="daloa-quartiers" className="text-lg font-bold">{t('Livraison à Daloa : quartiers et frais')}</h2>
        <p className="mt-1 text-sm text-navy-600">
          {t('Sélectionnez votre quartier au moment de la commande. Le frais ci-dessous s’ajoute au montant des articles.')}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {local.map((zone) => {
            // La liste canonique du quartier prime sur un ancien paramétrage
            // qui aurait recopié tous les quartiers dans les deux zones.
            const band = bandFromZoneName(zone.name);
            const names = (band ? neighbourhoodsForBand(band) : (zone.neighbourhoods ?? []))
              .slice()
              .sort((a, b) => a.localeCompare(b, 'fr'));
            return (
              <Card key={zone.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold">{zone.name}</h3>
                  <span className="rounded-md bg-accent-100 px-2 py-0.5 text-sm font-extrabold text-navy-950">
                    {toFcfa(zone.fee) === 0 ? t('Gratuit') : formatFCFA(toFcfa(zone.fee))}
                  </span>
                </div>
                {zone.estimatedDelay ? <p className="mt-1 text-xs text-navy-500">{zone.estimatedDelay}</p> : null}
                <p className="mt-2 text-xs leading-relaxed text-navy-700">{names.join(' · ')}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="hors-daloa">
        <h2 id="hors-daloa" className="text-lg font-bold">{t('Hors Daloa : une semaine maximum')}</h2>
        <p className="mt-1 text-sm text-navy-600">
          {t('Choisissez votre ville à la commande. Le prix du transport n’est pas calculé par le site : il se convient avec la boutique sur WhatsApp, selon la ville et le volume du colis.')}
        </p>

        {national.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {national.map((zone) => (
              <li key={zone.id} className="rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm font-medium text-navy-800">
                {zone.city}
              </li>
            ))}
          </ul>
        ) : null}

        <ol className="mt-4 list-decimal space-y-2 ps-5 text-sm text-navy-600">
          <li>{t('Vous commandez en ligne et choisissez votre ville.')}</li>
          <li>{t('Vous écrivez sur WhatsApp : nous vous répondons le prix du transport et le délai pour cette ville.')}</li>
          <li>{t('Vous réglez les articles par Wave, puis le transport selon l’accord donné.')}</li>
          <li>
            {t('La commande part dès le paiement confirmé et arrive en {days} jours maximum.', { days: OUTSIDE_DALOA_MAX_DAYS })}
          </li>
        </ol>

        {transportLink ? (
          <a
            href={transportLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
          >
            <MessageCircle className="size-4" aria-hidden /> {t('Demander le prix du transport sur WhatsApp')}
          </a>
        ) : null}
      </section>

      <section className="mt-8" aria-labelledby="horaires">
        <h2 id="horaires" className="flex items-center gap-2 text-lg font-bold">
          <CalendarClock className="size-5 text-accent-600" aria-hidden /> {t('Jours et heures de retrait et de livraison')}
        </h2>
        <ul className="mt-2 space-y-1.5 text-sm text-navy-700">
          <li>
            <strong>{t('Retrait en boutique')}</strong> : {settings.openingHours ?? t('horaires communiqués par téléphone')} ·{' '}
            {t('colis gardé {hours} h maximum.', { hours: PICKUP_HOLD_HOURS })}
          </li>
          <li>
            <strong>{t('Livraison à Daloa')}</strong> : {t('du lundi au samedi, aux heures d’ouverture de la boutique.')}
          </li>
          <li>
            <strong>{t('Hors Daloa')}</strong> : {t('expédition sous {days} jours maximum selon la ville.', { days: OUTSIDE_DALOA_MAX_DAYS })}
          </li>
          <li>
            <strong>{t('Adresse exacte de la boutique')}</strong> :{' '}
            <span className="font-mono" dir="ltr">{location.dms}</span> ·{' '}
            <a href={location.mapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-700 underline">
              {t('Ouvrir dans Google Maps')}
            </a>
          </li>
        </ul>
      </section>

      <Alert tone="info" className="mt-6" title={t('Ce que nous ne faisons pas')}>
        {t('Aucune commande hors Daloa n’est remise au transporteur avant confirmation du paiement. Aucune capture d’écran ne vaut preuve de paiement : seule la vérification de l’encaissement fait foi.')}
      </Alert>

      <PurchaseNotice className="mt-4" phone={settings.phone} />

      <FaqSection
        id="faq-livraison"
        title={t('Questions fréquentes : livraisons')}
        intro={t('Les questions qui reviennent le plus souvent en boutique. Pour un cas particulier, le WhatsApp de la boutique reste le canal le plus rapide.')}
        entries={DELIVERY_FAQ}
        settings={settings}
        fallbackMessage={DELIVERY_FAQ_FALLBACK_MESSAGE}
      />

      <FaqSection
        id="faq-retours"
        title={t('Questions fréquentes : retours')}
        intro={t('Une fois le produit livré, ni l’argent n’est rendu, ni le produit n’est remplacé. En cas de problème, appelez le service client.')}
        entries={RETURNS_FAQ}
        settings={settings}
        fallbackMessage={RETURNS_FAQ_FALLBACK_MESSAGE}
      />

      <div className="mt-6 flex items-center gap-2 rounded-lg bg-navy-50 p-3 text-sm text-navy-700">
        <Info className="size-4 shrink-0" aria-hidden />
        <span>
          {t('Une question sur une livraison ?')}{' '}
          <Link href="/contact" className="font-semibold text-accent-700 underline">{t('Contactez la boutique')}</Link>{' '}
          {t('ou consultez le')}{' '}
          <Link href="/suivi" className="font-semibold text-accent-700 underline">{t('suivi de commande')}</Link>.
        </span>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/nous-trouver" className="inline-flex items-center gap-1.5 font-semibold text-accent-700 hover:underline">
          <Navigation className="size-4" aria-hidden /> {t('Nous trouver')}
        </Link>
        <Link href="/retours" className="inline-flex items-center gap-1.5 font-semibold text-accent-700 hover:underline">
          <TriangleAlert className="size-4" aria-hidden /> {t('Conditions de retour')}
        </Link>
      </div>

      <p className="mt-4 text-xs text-navy-500">
        {t('Les délais hors Daloa dépendent des transporteurs.')} {t(FINAL_SALE_NOTICE)}
      </p>
    </div>
  );
}
