'use client';

import { useActionState } from 'react';
import { AlertCircle, Copy, ShieldQuestion } from 'lucide-react';
import { submitPaymentReferenceAction, type PaymentReferenceState } from '@/app/actions/payment';
import { Button } from './ui/button';
import { Field, Input } from './ui/form';
import { Alert } from './ui/primitives';
import { useSiteT } from './site-i18n';

const initial: PaymentReferenceState = {};

export function PaymentInstructions({
  orderId,
  orderNumber,
  token,
  amountLabel,
  waveNumber,
  waveMerchantName,
  autoMode,
  paymentStatus,
  customerReference,
}: {
  orderId: string;
  orderNumber: string;
  token: string;
  amountLabel: string;
  waveNumber: string | null;
  waveMerchantName: string | null;
  autoMode: boolean;
  paymentStatus: string;
  customerReference: string | null;
}) {
  const t = useSiteT();
  const [state, formAction, pending] = useActionState(submitPaymentReferenceAction, initial);

  if (paymentStatus === 'PAID') {
    return (
      <Alert tone="success" title={t('Paiement confirmé')}>
        {t('Votre commande est en préparation. Merci de votre confiance.')}
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-accent-200 bg-accent-50 p-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-accent-900">
          <ShieldQuestion className="size-4" aria-hidden /> {t('Paiement Wave')}
        </h2>
        <p className="mt-1 text-sm text-accent-900">
          {t('Montant à payer :')} <strong>{amountLabel}</strong> — {t('Commande')} <strong>{orderNumber}</strong>.
        </p>

        {waveNumber ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-white p-3">
            <span className="text-sm text-navy-600">{t('Numéro Wave marchand :')}</span>
            <span className="font-mono text-base font-bold tracking-wide text-navy-950" dir="ltr">
              {waveNumber}
            </span>
            {waveMerchantName ? <span className="text-xs text-navy-500">({waveMerchantName})</span> : null}
            <CopyButton value={waveNumber} />
          </div>
        ) : (
          <Alert tone="warning" className="mt-3">
            {t(
              'Le numéro Wave marchand n’est pas encore renseigné. Contactez la boutique pour obtenir les instructions de paiement avant de déclarer une référence.',
            )}
          </Alert>
        )}

        <p className="mt-3 text-xs leading-relaxed text-accent-900">
          {t('Indiquez la référence {number} dans le motif du transfert Wave.', { number: orderNumber })}{' '}
          {t('Saisissez ensuite le numéro de transaction Wave affiché dans votre application.')}{' '}
          <strong>{t('Une capture d’écran ne constitue pas une preuve de paiement')}</strong>{' '}
          {t('la boutique vérifie le crédit réel sur son compte marchand avant de confirmer.')}
        </p>
      </div>

      {customerReference ? (
        <Alert tone="info" title={t('Référence déjà transmise')}>
          {t('Référence {reference} — en attente de vérification par la boutique.', { reference: customerReference })}
        </Alert>
      ) : null}

      {autoMode ? (
        <p className="text-xs text-navy-600">
          {t(
            'Le bouton « Payer avec Wave » vous amène directement au paiement sécurisé du montant exact de votre commande. La confirmation nous revient automatiquement.',
          )}
        </p>
      ) : null}

      <form action={formAction} className="rounded-xl border border-navy-100 bg-white p-4">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="token" value={token} />
        <Field
          label={t('Référence de transaction Wave')}
          htmlFor="reference"
          required
          hint={t('Exemple : TDH5TEWTLFE. Visible dans l’application Wave après le paiement.')}
        >
          <Input id="reference" name="reference" required minLength={4} maxLength={60} placeholder="TDH5TEWTLFE" dir="ltr" />
        </Field>
        <Button type="submit" className="mt-3" loading={pending}>
          {t('J’ai payé — transmettre la référence')}
        </Button>
        {state.error ? <p className="mt-2 text-sm font-medium text-danger-500">{state.error}</p> : null}
        {state.message ? <p className="mt-2 text-sm font-medium text-emerald-700">{state.message}</p> : null}
      </form>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const t = useSiteT();
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value.replace(/\s/g, ''));
      }}
      className="inline-flex items-center gap-1 rounded-md border border-navy-200 px-2 py-1 text-xs font-medium text-navy-700 hover:bg-navy-50"
    >
      <Copy className="size-3.5" aria-hidden /> {t('Copier')}
    </button>
  );
}

export function PaymentWarning({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}
