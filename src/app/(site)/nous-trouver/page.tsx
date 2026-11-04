import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, Compass, MapPin, MessageCircle, Navigation, Phone, Store } from 'lucide-react';
import { getStoreSettings, whatsappLink } from '@/lib/settings';
import { geoJsonLd, osmEmbedUrl, osmPageUrl } from '@/lib/geo';
import { formatStoreAddress, storeLocation } from '@/lib/store-location';
import { Card } from '@/components/ui/primitives';
import { getSiteI18n } from '@/lib/i18n/site-server';
import { PICKUP_HOLD_HOURS } from '@/lib/store-policy';

export const metadata: Metadata = {
  title: 'Nous trouver — boutique MeDi Shop à Daloa',
  description:
    'Adresse exacte de la boutique MeDi Shop à Daloa : 6°53’04.4″N 6°26’50.9″W. Carte, itinéraire Google Maps, horaires et téléphone pour venir retirer votre commande.',
  alternates: { canonical: '/nous-trouver' },
};

export const dynamic = 'force-dynamic';

export default async function FindUsPage() {
  const [settings, { t }] = await Promise.all([getStoreSettings(), getSiteI18n()]);
  const location = storeLocation(settings);
  const point = location.point;
  const whatsapp = whatsappLink(
    settings,
    'Bonjour MeDi Shop, je voudrais l’emplacement exact de la boutique à Daloa pour venir la visiter.',
  );

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: settings.storeName,
    streetAddress: location.addressLine,
    address: {
      '@type': 'PostalAddress',
      streetAddress: location.addressLine,
      addressLocality: location.city,
      addressCountry: location.country,
    },
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(settings.openingHours ? { openingHours: settings.openingHours } : {}),
    geo: geoJsonLd(point),
  };

  return (
    <div className="container-page max-w-4xl py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t('Nous trouver')}</h1>
      <p className="mt-2 text-sm text-navy-600">
        {t('La boutique MeDi Shop se trouve à {city}, {country}. Voici l’adresse exacte : ouvrez-la dans Google Maps et laissez-vous guider.', {
          city: location.city,
          country: location.country,
        })}
      </p>

      {/* Adresse exacte mise en avant */}
      <section className="mt-5 rounded-2xl border border-accent-300 bg-gradient-to-br from-accent-50 to-white p-5" aria-labelledby="adresse-titre">
        <h2 id="adresse-titre" className="flex items-center gap-2 text-sm font-bold text-navy-900">
          <MapPin className="size-4 text-accent-700" aria-hidden /> {t('Adresse exacte de l’entreprise')}
        </h2>
        <p className="mt-2 select-all font-mono text-lg font-extrabold tracking-tight text-navy-950 sm:text-xl" dir="ltr">
          {location.dms}
        </p>
        <p className="mt-1 text-sm text-navy-700">
          {formatStoreAddress(location)}
        </p>
        <p className="mt-1 font-mono text-xs text-navy-500" dir="ltr">
          {t('Coordonnées GPS :')} {location.decimal}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={location.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-bold text-navy-950 hover:bg-accent-400"
          >
            <Navigation className="size-4" aria-hidden /> {t('Itinéraire Google Maps')}
          </a>
          <a
            href={location.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-navy-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-800 hover:bg-navy-50"
          >
            <MapPin className="size-4" aria-hidden /> {t('Ouvrir dans Google Maps')}
          </a>
          <a
            href={location.osmUrl ?? osmPageUrl(point)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-navy-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-800 hover:bg-navy-50"
          >
            <Compass className="size-4" aria-hidden /> {t('Voir la carte')}
          </a>
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <MessageCircle className="size-4" aria-hidden /> {t('Demander l’itinéraire sur WhatsApp')}
            </a>
          ) : null}
        </div>
      </section>

      {/* Carte */}
      <section aria-labelledby="carte-titre" className="mt-5">
        <h2 id="carte-titre" className="sr-only">
          {t('Carte de localisation')}
        </h2>
        <div className="overflow-hidden rounded-xl border border-navy-100 bg-white">
          <iframe
            title={t('Carte — {store}, {city}', { store: settings.storeName, city: location.city })}
            src={osmEmbedUrl(point)}
            className="h-[320px] w-full border-0 sm:h-[420px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="border-t border-navy-100 p-4">
            <p className="text-sm font-semibold text-navy-900">
              {formatStoreAddress({
                addressLine: settings.addressLine ?? t('Boutique {store}', { store: settings.storeName }),
                city: location.city,
                country: '',
              })}
            </p>
            <p className="mt-0.5 font-mono text-xs text-navy-500" dir="ltr">
              {location.decimal}
            </p>
          </div>
        </div>
      </section>

      {/* Informations pratiques */}
      <section aria-labelledby="pratique-titre" className="mt-6">
        <h2 id="pratique-titre" className="text-lg font-bold">
          {t('Informations pratiques')}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Card className="p-4 text-sm">
            <p className="flex items-center gap-2 font-bold">
              <MapPin className="size-4 text-accent-600" aria-hidden /> {t('Adresse')}
            </p>
            <p className="mt-1 text-navy-600">{location.addressLine}</p>
            <p className="mt-0.5 font-mono text-xs text-navy-500" dir="ltr">{location.dms}</p>
          </Card>
          <Card className="p-4 text-sm">
            <p className="flex items-center gap-2 font-bold">
              <Clock className="size-4 text-accent-600" aria-hidden /> {t('Horaires')}
            </p>
            <p className="mt-1 text-navy-600">
              {settings.openingHours ?? t('Contactez la boutique pour connaître les horaires.')}
            </p>
          </Card>
          <Card className="p-4 text-sm">
            <p className="flex items-center gap-2 font-bold">
              <Phone className="size-4 text-accent-600" aria-hidden /> {t('Téléphone')}
            </p>
            <p className="mt-1 text-navy-600">
              {settings.phone ? (
                <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="font-semibold hover:underline">
                  {settings.phone}
                </a>
              ) : (
                <span className="text-navy-500">{t('Numéro communiqué sur WhatsApp')}</span>
              )}
            </p>
          </Card>
          <Card className="p-4 text-sm">
            <p className="flex items-center gap-2 font-bold">
              <Store className="size-4 text-accent-600" aria-hidden /> {t('Retrait de commande')}
            </p>
            <p className="mt-1 text-navy-600">
              {settings.allowPickup
                ? t('Retrait gratuit en boutique dès que la commande est prête. Le colis est gardé {hours} h maximum.', {
                    hours: PICKUP_HOLD_HOURS,
                  })
                : t('Retrait en boutique temporairement désactivé.')}
            </p>
            <Link href="/livraison" className="mt-2 inline-block font-semibold text-accent-700 underline">
              {t('Voir les conditions de retrait et de livraison')}
            </Link>
          </Card>
        </div>
      </section>
    </div>
  );
}
