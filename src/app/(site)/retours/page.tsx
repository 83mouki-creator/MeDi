import type { Metadata } from 'next';
import Link from 'next/link';
import { Ban, Camera, CheckCircle2, Phone, ShieldAlert, Truck } from 'lucide-react';
import { getStoreSettings, whatsappLink } from '@/lib/settings';
import { faqJsonLd } from '@/lib/faq';
import { RETURNS_FAQ, RETURNS_FAQ_FALLBACK_MESSAGE } from '@/lib/returns-faq';
import { FaqSection } from '@/components/faq-section';
import { Alert, Card } from '@/components/ui/primitives';
import { getSiteI18n } from '@/lib/i18n/site-server';
import { FINAL_SALE_NOTICE, OUTSIDE_DALOA_MAX_DAYS, PICKUP_HOLD_HOURS, STORE_POLICY_VARS } from '@/lib/store-policy';
import { PurchaseNotice } from '@/components/purchase-notice';

export const metadata: Metadata = {
  title: 'Retours, échanges et garanties',
  description:
    'Règle MeDi : une fois le produit livré, ni remboursement, ni échange. Ce qui reste possible avant la remise, et comment joindre le service client.',
  alternates: { canonical: '/retours' },
};

export const dynamic = 'force-dynamic';

export default async function ReturnsPage() {
  const [settings, { t }] = await Promise.all([getStoreSettings(), getSiteI18n()]);
  const faqStructuredData = faqJsonLd(RETURNS_FAQ, settings, (text) => t(text, STORE_POLICY_VARS));
  const whatsapp = whatsappLink(settings, RETURNS_FAQ_FALLBACK_MESSAGE);

  return (
    <div className="container-page max-w-3xl py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }} />
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t('Retours, échanges et garanties')}</h1>

      {/* La règle, dite clairement et une seule fois */}
      <div className="mt-4 rounded-2xl border border-accent-300 bg-accent-50 p-5">
        <p className="flex items-start gap-2 text-base font-extrabold leading-snug text-navy-950">
          <Ban className="mt-0.5 size-5 shrink-0 text-accent-700" aria-hidden />
          {t(FINAL_SALE_NOTICE)}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-navy-800">
          <Phone className="size-4 text-accent-700" aria-hidden />
          {t('Service client :')}{' '}
          {settings.phone ? (
            <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="font-bold underline decoration-accent-500 underline-offset-2">
              {settings.phone}
            </a>
          ) : (
            <Link href="/contact" className="font-bold underline decoration-accent-500 underline-offset-2">
              {t('nous contacter')}
            </Link>
          )}
          {whatsapp ? (
            <>
              {' · '}
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-700 underline">
                WhatsApp
              </a>
            </>
          ) : null}
        </p>
      </div>

      {settings.returnPolicy ? (
        <Card className="mt-4 whitespace-pre-line p-4 text-sm text-navy-700">{settings.returnPolicy}</Card>
      ) : (
        <Alert tone="info" className="mt-4" title={t('Ce qui reste possible avant la remise')}>
          {t('Tant que le colis n’est pas remis au livreur ou au transporteur, la commande peut être annulée : les articles réglés par Wave vous sont alors rendus. Après la remise, le produit est considéré comme accepté.')}
        </Alert>
      )}

      <h2 className="mt-7 text-lg font-bold">{t('À vérifier au moment de la livraison')}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Card className="p-4 text-sm">
          <CheckCircle2 className="size-5 text-emerald-600" aria-hidden />
          <h3 className="mt-2 font-bold">{t('Comptez et contrôlez')}</h3>
          <p className="mt-1 text-navy-600">
            {t('Comptez les articles, vérifiez la référence, l’état et l’emballage devant le livreur. C’est le bon moment pour poser vos questions.')}
          </p>
        </Card>
        <Card className="p-4 text-sm">
          <Camera className="size-5 text-accent-600" aria-hidden />
          <h3 className="mt-2 font-bold">{t('Colis abîmé')}</h3>
          <p className="mt-1 text-navy-600">
            {t('Refusez le colis si l’emballage est visiblement détérioré, puis appelez le service client le jour même en joignant des photos.')}
          </p>
        </Card>
        <Card className="p-4 text-sm">
          <ShieldAlert className="size-5 text-accent-600" aria-hidden />
          <h3 className="mt-2 font-bold">{t('Garantie fabricant')}</h3>
          <p className="mt-1 text-navy-600">
            {t('Les garanties applicables sont celles du fabricant, indiquées sur la facture. La boutique vous accompagne pour la mettre en œuvre.')}
          </p>
        </Card>
        <Card className="p-4 text-sm">
          <Truck className="size-5 text-accent-600" aria-hidden />
          <h3 className="mt-2 font-bold">{t('Retrait en boutique')}</h3>
          <p className="mt-1 text-navy-600">
            {t('Un colis payé en ligne est gardé {hours} h maximum. Passé ce délai, contactez la boutique : le stock est remis en vente.', {
              hours: PICKUP_HOLD_HOURS,
            })}
          </p>
        </Card>
      </div>

      <FaqSection
        id="faq-retours"
        title={t('Questions fréquentes : retours et remboursements')}
        intro={t('Les réponses aux questions les plus fréquentes. Pour un cas particulier, appelez le service client.')}
        entries={RETURNS_FAQ}
        settings={settings}
        fallbackMessage={RETURNS_FAQ_FALLBACK_MESSAGE}
        className="mt-8 scroll-mt-24"
      />

      <h2 className="mt-7 text-lg font-bold">{t('En cas de problème, dans l’ordre')}</h2>
      <ol className="mt-2 list-decimal space-y-2 ps-5 text-sm text-navy-600">
        <li>{t('Notez votre numéro de commande (MED-AAAA-NNNNN).')}</li>
        <li>
          {t('Appelez le service client pendant les heures d’ouverture')}
          {settings.phone ? (
            <>
              {' : '}
              <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="font-semibold text-accent-700 underline">
                {settings.phone}
              </a>
            </>
          ) : null}
          .
        </li>
        <li>{t('Décrivez le problème et envoyez des photos sur WhatsApp si besoin.')}</li>
        <li>{t('La boutique vous répond le jour même pendant les heures d’ouverture.')}</li>
      </ol>

      {/* Précisions écrites par le propriétaire : elles n'apparaissent que s'il les a saisies. */}
      {settings.returnPolicy ? (
        <section className="mt-6 rounded-2xl border border-navy-200 bg-white p-4">
          <h2 className="text-base font-extrabold text-navy-950">{t('Précisions de la boutique')}</h2>
          <div className="mt-2 space-y-2 text-sm leading-relaxed text-navy-700">
            {settings.returnPolicy
              .split(/\n\s*\n|\n/)
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line, index) => (
                <p key={index}>{line}</p>
              ))}
          </div>
        </section>
      ) : null}

      <PurchaseNotice className="mt-6" phone={settings.phone} />

      <p className="mt-4 text-xs text-navy-500">
        {t('Livraison hors Daloa : {days} jours maximum selon la ville, transport à convenir sur WhatsApp.', { days: OUTSIDE_DALOA_MAX_DAYS })}
      </p>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/livraison" className="font-semibold text-accent-700 underline">{t('Livraison et retrait')}</Link>
        <Link href="/contact" className="font-semibold text-accent-700 underline">{t('Contact')}</Link>
        <Link href="/cgv" className="font-semibold text-accent-700 underline">{t('Conditions générales de vente')}</Link>
      </div>
    </div>
  );
}
