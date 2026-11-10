import type { Metadata } from 'next';
import { MessageCircle, Phone, Clock, Mail, TriangleAlert, Truck } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getStoreSettings, whatsappLink } from '@/lib/settings';
import { ContactForm } from '@/components/contact-form';
import { Card } from '@/components/ui/primitives';
import { getSiteI18n } from '@/lib/i18n/site-server';
import { WHATSAPP_MESSAGES } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Contact et service client',
  description:
    'Contactez Perokado à Daloa : question sur un produit, disponibilité, suivi de commande, facture ou demande de devis.',
  alternates: { canonical: '/contact' },
};

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const [settings, user] = await Promise.all([getStoreSettings(), getCurrentUser().catch(() => null)]);

  const { t } = await getSiteI18n();
  // Le bouton ouvre WhatsApp avec la question déjà écrite : le client n'a plus
  // qu'à appuyer sur « envoyer ».
  const whatsappHref = whatsappLink(settings, WHATSAPP_MESSAGES.help);
  const whatsappOrderHref = whatsappLink(settings, WHATSAPP_MESSAGES.order);

  return (
    <div className="container-page grid gap-6 py-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t('Nous contacter')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-navy-600">
          {t('Une question sur une référence, un délai, une facture ou une commande en cours ? Écrivez-nous : votre message est enregistré et traité par l’équipe de la boutique.')}
        </p>

        <Card className="mt-5 p-4 sm:p-6">
          <ContactForm defaultEmail={user?.email} defaultName={[user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined} />
        </Card>

        <p className="mt-3 text-xs text-navy-500">
          {t('Vos données servent uniquement à traiter votre demande. Elles ne sont ni revendues ni utilisées à des fins publicitaires. Voir la')}{' '}
          <a href="/confidentialite" className="font-medium text-accent-700 underline">{t('politique de confidentialité')}</a>.
        </p>
      </div>

      <aside className="space-y-3">
        <Card className="border-[#25D366]/40 bg-[#25D366]/5 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <MessageCircle className="size-4 text-[#128C7E]" aria-hidden /> {t('Service client sur WhatsApp')}
          </h2>
          <p className="mt-1 text-xs text-navy-600">
            {t('La réponse vient de la boutique, pas d’un centre d’appel. Le message s’ouvre déjà rédigé : vous n’avez qu’à l’envoyer.')}
          </p>
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-[#128C7E] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0e6e63]"
            >
              <MessageCircle className="size-4" aria-hidden />
              {t('Écrire sur WhatsApp')}
            </a>
          ) : null}
          <a href="/contact#formulaire" className="mt-2 block text-center text-xs font-semibold text-navy-600 underline">
            {t('Ou remplir le formulaire ci-contre')}
          </a>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-navy-500">{t('Coordonnées de la boutique')}</h2>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2">
              <Phone className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
              <span>
                <span className="block text-xs text-navy-500">{t('Téléphone')}</span>
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
                  <a href={whatsappOrderHref ?? whatsappHref} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy-900 hover:underline">
                    {settings.whatsapp}
                  </a>
                </span>
              </li>
            ) : null}
            <li className="flex gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
              <span>
                <span className="block text-xs text-navy-500">{t('Horaires')}</span>
                {settings.openingHours ? (
                  <span className="font-semibold text-navy-900">{settings.openingHours}</span>
                ) : null}
              </span>
            </li>
            <li className="flex gap-2">
              <Mail className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
              <span>
                <span className="block text-xs text-navy-500">{t('E-mail')}</span>
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
            <Truck className="size-4 text-accent-600" aria-hidden /> {t('Livraison')}
          </h2>
          <p className="text-navy-600">
            {t('Nous livrons à domicile à {city} et partout en Côte d’Ivoire.', { city: settings.city })}
          </p>
          <a href="/livraison" className="mt-2 inline-block font-semibold text-accent-700 underline">
            {t('Voir les zones et les frais de livraison')}
          </a>
        </Card>

        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="size-4" aria-hidden /> {t('Tarifs et délais')}
          </p>
          <p className="mt-1">
            {t('À Daloa, les frais dépendent de votre quartier. Hors Daloa, le prix du transport se convient sur WhatsApp avant tout paiement.')}
          </p>
        </Card>

        <Card className="p-4 text-sm">
          <h2 className="mb-2 text-sm font-bold">{t('Suivre une commande')}</h2>
          <p className="text-navy-600">
            {t('Munissez-vous de votre numéro de commande (format')} <span className="font-mono">PER-AAAA-NNNNN</span>
            {t(') et du numéro de téléphone utilisé lors de l’achat.')}
          </p>
          <a href="/suivi" className="mt-2 inline-block font-semibold text-accent-700 underline">
            {t('Ouvrir le suivi de commande')}
          </a>
        </Card>
      </aside>
    </div>
  );
}
