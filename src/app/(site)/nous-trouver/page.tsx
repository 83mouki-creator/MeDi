import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, Compass, MapPin, MessageCircle, Navigation, Phone, TriangleAlert } from 'lucide-react';
import { getStoreSettings, whatsappLink } from '@/lib/settings';
import {
  formatCoordinates,
  geoJsonLd,
  googleMapsDirectionsUrl,
  googleMapsPlaceUrl,
  osmEmbedUrl,
  osmPageUrl,
} from '@/lib/geo';
import { Card } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'Nous trouver — boutique MeDi à Daloa',
  description:
    'Localisation de la boutique MeDi à Daloa : carte, itinéraire, horaires et téléphone pour venir retirer votre commande.',
  alternates: { canonical: '/nous-trouver' },
};

export const dynamic = 'force-dynamic';

export default async function FindUsPage() {
  const settings = await getStoreSettings();
  const point = settings.geo;
  const whatsapp = whatsappLink(
    settings,
    'Bonjour MeDi, je voudrais l’emplacement exact de la boutique à Daloa pour venir la visiter.',
  );

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: settings.storeName,
    ...(settings.addressLine ? { streetAddress: settings.addressLine } : {}),
    address: {
      '@type': 'PostalAddress',
      ...(settings.addressLine ? { streetAddress: settings.addressLine } : {}),
      addressLocality: settings.city,
      addressCountry: settings.country,
    },
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(settings.openingHours ? { openingHours: settings.openingHours } : {}),
    ...(point ? { geo: geoJsonLd(point) } : {}),
  };

  return (
    <div className="container-page max-w-4xl py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Nous trouver</h1>
      <p className="mt-2 text-sm text-navy-600">
        La boutique se trouve à {settings.city}, {settings.country}. Retrouvez ici l’itinéraire, les horaires et le numéro à appeler
        pour venir retirer votre commande.
      </p>

      {/* ─── Carte ou emplacement en attente ─── */}
      <section aria-labelledby="carte-titre" className="mt-5">
        <h2 id="carte-titre" className="sr-only">
          Carte de localisation
        </h2>

        {point ? (
          <div className="overflow-hidden rounded-xl border border-navy-100 bg-white">
            <iframe
              title={`Carte — ${settings.storeName}, ${settings.city}`}
              src={osmEmbedUrl(point)}
              className="h-[320px] w-full border-0 sm:h-[420px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="flex flex-col gap-3 border-t border-navy-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-navy-900">
                  {settings.addressLine ?? `Boutique ${settings.storeName}`} — {settings.city}
                </p>
                <p className="mt-0.5 font-mono text-xs text-navy-500">{formatCoordinates(point)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={googleMapsDirectionsUrl(point)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-600"
                >
                  <Navigation className="size-4" aria-hidden /> Itinéraire
                </a>
                <a
                  href={googleMapsPlaceUrl(point)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-navy-200 px-4 py-2.5 text-sm font-semibold text-navy-800 hover:bg-navy-50"
                >
                  <MapPin className="size-4" aria-hidden /> Ouvrir dans Maps
                </a>
                <a
                  href={osmPageUrl(point)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-navy-200 px-4 py-2.5 text-sm font-semibold text-navy-800 hover:bg-navy-50"
                >
                  <Compass className="size-4" aria-hidden /> Voir la carte
                </a>
              </div>
            </div>
          </div>
        ) : (
          <Card className="border-amber-200 bg-amber-50 p-5 text-amber-900">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Compass className="size-4" aria-hidden /> Itinéraire sur WhatsApp
            </h3>
            <p className="mt-2 text-sm">
              Nous ne publions pas de position approximative : votre itinéraire doit être exact. Demandez l’itinéraire sur WhatsApp,
              un membre de l’équipe vous indique le chemin depuis votre point de départ.
            </p>
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <MessageCircle className="size-4" aria-hidden /> Demander l’itinéraire sur WhatsApp
              </a>
            ) : (
              <Link
                href="/contact"
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100"
              >
                <MessageCircle className="size-4" aria-hidden /> Écrire à la boutique
              </Link>
            )}
          </Card>
        )}
      </section>

      {/* ─── Informations pratiques ─── */}
      <section aria-labelledby="pratique-titre" className="mt-6">
        <h2 id="pratique-titre" className="text-lg font-bold">
          Informations pratiques
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Card className="p-4 text-sm">
            <p className="flex items-center gap-2 font-bold">
              <MapPin className="size-4 text-accent-600" aria-hidden /> Adresse
            </p>
            <p className="mt-1 text-navy-600">
              {settings.addressLine ? `${settings.addressLine}, ${settings.city}` : `${settings.city}, ${settings.country}`}
            </p>
          </Card>
          <Card className="p-4 text-sm">
            <p className="flex items-center gap-2 font-bold">
              <Clock className="size-4 text-accent-600" aria-hidden /> Horaires
            </p>
            <p className="mt-1 text-navy-600">{settings.openingHours ?? 'Contactez la boutique pour connaître les horaires.'}</p>
          </Card>
          <Card className="p-4 text-sm">
            <p className="flex items-center gap-2 font-bold">
              <Phone className="size-4 text-accent-600" aria-hidden /> Téléphone
            </p>
            <p className="mt-1 text-navy-600">
              {settings.phone ? (
                <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="font-semibold hover:underline">
                  {settings.phone}
                </a>
              ) : (
                <span className="text-navy-500">Numéro communiqué sur WhatsApp</span>
              )}
            </p>
          </Card>
          <Card className="p-4 text-sm">
            <p className="flex items-center gap-2 font-bold">
              <Compass className="size-4 text-accent-600" aria-hidden /> Retrait de commande
            </p>
            <p className="mt-1 text-navy-600">
              {settings.allowPickup
                ? 'Retrait gratuit en boutique pendant les heures d’ouverture, dès que la commande est marquée « prête ».'
                : 'Retrait en boutique temporairement désactivé.'}
            </p>
            <Link href="/livraison" className="mt-2 inline-block font-semibold text-accent-700 underline">
              Voir les conditions de retrait et de livraison
            </Link>
          </Card>
        </div>
      </section>

    </div>
  );
}
