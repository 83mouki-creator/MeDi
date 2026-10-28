'use client';

import { useActionState } from 'react';
import { AlertCircle, Copy, ShieldQuestion } from 'lucide-react';
import { submitPaymentReferenceAction, type PaymentReferenceState } from '@/app/actions/payment';
import { Button } from './ui/button';
import { Field, Input } from './ui/form';
import { Alert } from './ui/primitives';

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
  const [state, formAction, pending] = useActionState(submitPaymentReferenceAction, initial);

  if (paymentStatus === 'PAID') {
    return <Alert tone="success" title="Paiement confirmé">Votre commande est en cours de préparation. Merci de votre confiance.</Alert>;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-accent-200 bg-accent-50 p-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-accent-900">
          <ShieldQuestion className="size-4" aria-hidden /> Paiement Wave
        </h2>
        <p className="mt-1 text-sm text-accent-900">
          Montant à payer : <strong>{amountLabel}</strong> — commande <strong>{orderNumber}</strong>.
        </p>

        {waveNumber ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-white p-3">
            <span className="text-sm text-navy-600">Numéro Wave marchand :</span>
            <span className="font-mono text-base font-bold tracking-wide text-navy-950">{waveNumber}</span>
            {waveMerchantName ? <span className="text-xs text-navy-500">({waveMerchantName})</span> : null}
            <CopyButton value={waveNumber} />
          </div>
        ) : (
          <Alert tone="warning" className="mt-3">
            Le numéro Wave marchand n&apos;est pas encore renseigné. Contactez la boutique pour obtenir les instructions de paiement
            avant de déclarer une référence.
          </Alert>
        )}

        <p className="mt-3 text-xs leading-relaxed text-accent-900">
          Indiquez la référence <strong>{orderNumber}</strong> dans le motif du transfert Wave. Ensuite, saisissez ci-dessous le
          numéro de transaction Wave affiché dans votre application.
          <strong> Une capture d&apos;écran ne constitue pas une preuve de paiement</strong> : la boutique vérifie le crédit réel
          sur son compte marchand avant de confirmer.
        </p>
      </div>

      {customerReference ? (
        <Alert tone="info" title="Référence déjà transmise">
          Référence {customerReference} — en attente de vérification par la boutique.
        </Alert>
      ) : null}

      {autoMode ? (
        <p className="text-xs text-navy-600">
          Le paiement automatique Wave est configuré : le bouton « Payer avec Wave » ouvre une session sécurisée et la confirmation
          est reçue par notification serveur signée.
        </p>
      ) : null}

      <form action={formAction} className="rounded-xl border border-navy-100 bg-white p-4">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="token" value={token} />
        <Field
          label="Référence de transaction Wave"
          htmlFor="reference"
          required
          hint="Exemple : TDH5TEWTLFE. Visible dans l’application Wave après le paiement."
        >
          <Input id="reference" name="reference" required minLength={4} maxLength={60} placeholder="TDH5TEWTLFE" />
        </Field>
        <Button type="submit" className="mt-3" loading={pending}>
          J&apos;ai payé — transmettre la référence
        </Button>
        {state.error ? <p className="mt-2 text-sm font-medium text-danger-500">{state.error}</p> : null}
        {state.message ? <p className="mt-2 text-sm font-medium text-emerald-700">{state.message}</p> : null}
      </form>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value.replace(/\s/g, ''));
      }}
      className="inline-flex items-center gap-1 rounded-md border border-navy-200 px-2 py-1 text-xs font-medium text-navy-700 hover:bg-navy-50"
    >
      <Copy className="size-3.5" aria-hidden /> Copier
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
