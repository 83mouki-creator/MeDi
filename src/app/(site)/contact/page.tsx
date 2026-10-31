import type { Metadata } from 'next';
import { MapPin, MessageCircle, Phone, Clock, Mail, TriangleAlert } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getStoreSettings } from '@/lib/settings';
import { ContactForm } from '@/components/contact-form';
import { Card } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'Contact et service client',
  description:
    'Contactez MeDi à Daloa : question sur un produit, disponibilité, suivi de commande, facture ou demande de devis.',
  alternates: { canonical: '/contact' },
};

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const [settings, user] = await Promise.all([getStoreSettings(), getCurrentUser().catch(() => null)]);

  const whatsappHref = settings.whatsapp
    ? `https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, '')}`
    : null;

  return (
    <div className="container-page grid gap-6 py-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Nous contacter</h1>
        <p className="mt-2 max-w-2xl text-sm text-navy-600">
          Une question sur une référence, un délai, une facture ou une commande en cours ? Écrivez-nous : votre message est
          enregistré et traité par l’équipe de la boutique.
        </p>

        <Card className="mt-5 p-4 sm:p-6">
          <ContactForm defaultEmail={user?.email} defaultName={[user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined} />
        </Card>

        <p className="mt-3 text-xs text-navy-500">
          Vos données servent uniquement à traiter votre demande. Elles ne sont ni revendues ni utilisées à des fins
          publicitaires. Voir la{' '}
          <a href="/confidentialite" className="font-medium text-accent-700 underline">politique de confidentialité</a>.
        </p>
      </div>

      <aside className="space-y-3">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-navy-500">Coordonnées de la boutique</h2>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2">
              <Phone className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
              <span>
                <span className="block text-xs text-navy-500">Téléphone</span>
                {settings.phone ? (
                  <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="font-semibold text-navy-900 hover:underline">
                    {settings.phone}
                  </a>
                ) : null}
              </span>
            </li>
            {whatsappHref ? (
              <li className="flex gap-2">
                <MessageCircle className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
                <span>
                  <span className="block text-xs text-navy-500">WhatsApp</span>
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy-900 hover:underline">
                    {settings.whatsapp}
                  </a>
                </span>
              </li>
            ) : null}
            <li className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
              <span>
                <span className="block text-xs text-navy-500">Adresse</span>
                {settings.addressLine ? (
                  <span className="font-semibold text-navy-900">
                    {settings.addressLine}, {settings.city}, {settings.country}
                  </span>
                ) : (
                  <span className="font-semibold text-navy-900">{settings.city}, {settings.country}</span>
                )}
              </span>
            </li>
            <li className="flex gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
              <span>
                <span className="block text-xs text-navy-500">Horaires</span>
                {settings.openingHours ? (
                  <span className="font-semibold text-navy-900">{settings.openingHours}</span>
                ) : null}
              </span>
            </li>
            <li className="flex gap-2">
              <Mail className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
              <span>
                <span className="block text-xs text-navy-500">E-mail</span>
                {settings.email ? (
                  <a href={`mailto:${settings.email}`} className="font-semibold text-navy-900 hover:underline">
                    {settings.email}
                  </a>
                ) : null}
              </span>
            </li>
          </ul>
        </Card>

        <Card className="p-4 text-sm">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
            <MapPin className="size-4 text-accent-600" aria-hidden /> Nous trouver
          </h2>
          <p className="text-navy-600">
            Carte, coordonnées GPS et itinéraire vers la boutique à {settings.city}.
          </p>
          <a href="/nous-trouver" className="mt-2 inline-block font-semibold text-accent-700 underline">
            Ouvrir la page « Nous trouver »
          </a>
        </Card>

        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="size-4" aria-hidden /> Tarifs et délais
          </p>
          <p className="mt-1">
            Les frais de livraison dépendent de votre quartier ou de votre ville. Pour une livraison hors Daloa, le coût du
            transport est confirmé avant tout paiement.
          </p>
        </Card>

        <Card className="p-4 text-sm">
          <h2 className="mb-2 text-sm font-bold">Suivre une commande</h2>
          <p className="text-navy-600">
            Munissez-vous de votre numéro de commande (format <span className="font-mono">MED-AAAA-NNNNN</span>) et du numéro de
            téléphone utilisé lors de l’achat.
          </p>
          <a href="/suivi" className="mt-2 inline-block font-semibold text-accent-700 underline">
            Ouvrir le suivi de commande
          </a>
        </Card>
      </aside>
    </div>
  );
}
