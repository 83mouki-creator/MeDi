import type { Metadata } from 'next';
import Link from 'next/link';
import { Smartphone, Banknote, Store, ShieldCheck, Clock } from 'lucide-react';
import { getStoreSettings } from '@/lib/settings';
import { formatFCFA } from '@/lib/utils';
import { Alert, Card } from '@/components/ui/primitives';
import { getSiteI18n } from '@/lib/i18n/site-server';

export const metadata: Metadata = {
  title: 'Moyens de paiement',
  description: 'Paiement par Wave, à la livraison à Daloa ou en espèces en boutique. Prépaement obligatoire hors Daloa.',
  alternates: { canonical: '/paiement' },
};

export const dynamic = 'force-dynamic';

export default async function PaymentPage() {
  const settings = await getStoreSettings();
  const { t } = await getSiteI18n();

  return (
    <div className="container-page max-w-3xl py-8">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t('Paiement')}</h1>
      <p className="mt-2 text-sm text-navy-600">
        {t(
          'Tous les montants sont en francs CFA (FCFA). Le total affiché au moment de la commande est celui que vous réglez, sans supplément ajouté après coup.',
        )}
      </p>

      <div className="mt-5 space-y-3">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 size-5 shrink-0 text-accent-600" aria-hidden />
            <div>
              <h2 className="font-bold">{t('Wave')}</h2>
              <p className="mt-1 text-sm text-navy-600">
                {t('Le paiement Wave se fait depuis votre application, vers le numéro marchand affiché sur la page de commande.')}
              </p>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-navy-600">
                <li>{t('Vous saisissez ensuite la référence de la transaction dans le formulaire de la commande.')}</li>
                <li>
                  {t(
                    'La commande reste au statut « paiement à vérifier » jusqu’à ce que la boutique contrôle le paiement reçu sur son compte marchand.',
                  )}
                </li>
                <li>{t('Aucune confirmation ne s’obtient à partir d’une capture d’écran ou d’une simple déclaration.')}</li>
              </ul>
              {settings.waveNumber ? (
                <p className="mt-2 text-sm">
                  {t('Numéro marchand Wave :')}{' '}
                  <strong>{settings.waveNumber}</strong>
                  {settings.waveMerchantName ? ` — ${settings.waveMerchantName}` : ''}
                </p>
              ) : (
                <p className="mt-2 text-sm text-navy-500">{t('Contactez la boutique pour obtenir le numéro marchand Wave.')}</p>
              )}
              {settings.waveMode === 'MANUAL' ? (
                <Alert tone="info" className="mt-2">
                  {t('Le contrôle du paiement est assuré par la boutique, pendant les horaires d’ouverture.')}
                </Alert>
              ) : null}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Banknote className="mt-0.5 size-5 shrink-0 text-accent-600" aria-hidden />
            <div>
              <h2 className="font-bold">{t('Paiement à la livraison (espèces)')}</h2>
              {settings.allowCod ? (
                <>
                  <p className="mt-1 text-sm text-navy-600">
                    {t('Disponible uniquement à Daloa, pour une livraison à domicile, et dans la limite de')}{' '}
                    <strong>{formatFCFA(settings.codMaxAmount)}</strong> {t('par commande.')}
                  </p>
                  <p className="mt-1 text-sm text-navy-600">
                    {t('Le paiement se fait au livreur, à la remise du colis, dans votre quartier de Daloa.')}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-navy-600">
                  {t(
                    'Le paiement à la livraison n’est pas activé. La boutique peut l’ouvrir pour certaines zones ; les conditions applicables apparaissent alors directement au moment du paiement.',
                  )}
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Store className="mt-0.5 size-5 shrink-0 text-accent-600" aria-hidden />
            <div>
              <h2 className="font-bold">{t('Espèces en boutique (retrait)')}</h2>
              <p className="mt-1 text-sm text-navy-600">
                {t(
                  'Si vous choisissez le retrait à Daloa, vous pouvez régler sur place au moment de récupérer la commande. Le stock reste réservé pendant le délai indiqué sur votre commande.',
                )}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <h2 className="mt-8 text-lg font-bold">{t('Hors Daloa : prépaiement obligatoire')}</h2>
      <p className="mt-2 text-sm text-navy-600">
        {t(
          'Pour toute livraison en dehors de Daloa, la totalité du montant des articles est payée avant expédition. Le prix du transport, lui, se convient sur WhatsApp avec la boutique : il est ajouté après accord, et la commande n’est jamais remise au transporteur sans paiement reçu.',
        )}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Card className="p-4 text-sm">
          <ShieldCheck className="size-5 text-emerald-600" aria-hidden />
          <h3 className="mt-2 font-bold">{t('Aucun paiement simulé')}</h3>
          <p className="mt-1 text-navy-600">
            {t(
              'La boutique contrôle elle-même chaque paiement sur son compte marchand avant de préparer la commande. Une capture d’écran ou une déclaration ne remplace pas ce contrôle.',
            )}
          </p>
        </Card>
        <Card className="p-4 text-sm">
          <Clock className="size-5 text-accent-600" aria-hidden />
          <h3 className="mt-2 font-bold">{t('Réservation du stock')}</h3>
          <p className="mt-1 text-navy-600">
            {t(
              'Une commande non payée est annulée automatiquement à l’expiration du délai de réservation et les articles sont remis en vente.',
            )}
          </p>
        </Card>
      </div>

      <p className="mt-6 text-sm text-navy-600">
        {t('Un problème de paiement ?')}{' '}
        <Link href="/contact" className="font-semibold text-accent-700 underline">
          {t('Contactez la boutique')}
        </Link>{' '}
        {t('en précisant votre numéro de commande.')}
      </p>
    </div>
  );
}
