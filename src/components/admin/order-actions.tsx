'use client';

import { useAdminI18n } from '@/components/admin/admin-i18n';
import { useActionState, useState } from 'react';
import { AlertTriangle, Check, PackageCheck, Send, X } from 'lucide-react';
import { transitionOrderAction, confirmPaymentAction, cancelOrderAction, type AdminActionState } from '@/app/actions/admin-orders';
import { ORDER_STATUS_ACTIONS, ALLOWED_TRANSITIONS, type OrderStatus } from '@/lib/order-status';
import { Button } from '../ui/button';
import { Field, Select, Textarea, Input } from '../ui/form';
import { Alert } from '../ui/primitives';

const initial: AdminActionState = {};

export function OrderStatusForm({
  orderId,
  currentStatus,
  allowed,
  isCarrier,
  paid,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  allowed: OrderStatus[];
  isCarrier: boolean;
  paid: boolean;
}) {
  const { t } = useAdminI18n();
  const [state, formAction, pending] = useActionState(transitionOrderAction, initial);
  const [target, setTarget] = useState<string>(allowed[0] ?? '');

  const blocked = isCarrier && !paid;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      {blocked ? (
        <Alert tone="warning" title={t('Expédition bloquée')}>
          {t('Cette commande est destinée hors de Daloa et n’est pas payée : elle ne peut pas être marquée « prête à expédier » ni « expédiée ». Confirmez d’abord le paiement.')}
        </Alert>
      ) : null}

      <Field
        label={t('Que se passe-t-il maintenant ?')}
        htmlFor={`to-${orderId}`}
        hint={t('Choisissez l’étape qui vient d’arriver, puis appuyez sur le bouton.')}
      >
        <Select id={`to-${orderId}`} name="to" value={target} onChange={(e) => setTarget(e.target.value)}>
          {ALLOWED_TRANSITIONS[currentStatus].map((status) => (
            <option key={status} value={status}>
              {t(ORDER_STATUS_ACTIONS[status])}
              {status === 'SHIPPED' && isCarrier && !paid ? ` — ${t('paiement à recevoir d’abord')}` : ''}
            </option>
          ))}
        </Select>
      </Field>

      {target === 'SHIPPED' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label={t('Transporteur')} htmlFor="carrier">
            <Input id="carrier" name="carrier" placeholder={t('Car, transporteur, interne')} />
          </Field>
          <Field label={t('Numéro de suivi')} htmlFor="trackingNumber">
            <Input id="trackingNumber" name="trackingNumber" placeholder={t('Facultatif')} />
          </Field>
        </div>
      ) : null}

      <Field
        label={t('Une précision à noter ? (facultatif)')}
        htmlFor="note"
        hint={t('Ex. « Le client passe demain matin ». Cette note reste dans l’historique.')}
      >
        <Textarea id="note" name="note" rows={2} maxLength={500} />
      </Field>

      <Button type="submit" loading={pending} disabled={blocked && (target === 'SHIPPED' || target === 'READY_TO_SHIP')}>
        <PackageCheck className="size-4" aria-hidden /> {t('Enregistrer cette étape')}
      </Button>
    </form>
  );
}

export function PaymentReviewForm({
  paymentId,
  amountLabel,
  reference,
  customerReference,
  canConfirm,
}: {
  paymentId: string;
  amountLabel: string;
  reference: string;
  customerReference: string | null;
  canConfirm: boolean;
}) {
  const { t } = useAdminI18n();
  const [state, formAction, pending] = useActionState(confirmPaymentAction, initial);
  const [decision, setDecision] = useState<'CONFIRM' | 'REJECT'>('CONFIRM');

  if (!canConfirm) {
    return (
      <p className="rounded-lg bg-navy-50 p-3 text-sm text-navy-700">
        {t('Seuls un administrateur ou le propriétaire peuvent confirmer un paiement. Votre rôle permet la consultation.')}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="decision" value={decision} />
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <div className="rounded-lg border border-navy-100 bg-navy-50 p-3 text-sm">
        <p className="font-semibold">{t('Le client doit payer : {montant}', { montant: amountLabel })}</p>
        <p className="text-xs text-navy-600">{t('Commande n° {numero}', { numero: reference })}</p>
        <p className="text-xs text-navy-600">
          {t('Référence que le client a indiquée :')} <strong>{customerReference ?? t('aucune')}</strong>
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDecision('CONFIRM')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold ${decision === 'CONFIRM' ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-navy-200 text-navy-600'}`}
        >
          <Check className="size-4" aria-hidden /> {t('J’ai reçu l’argent')}
        </button>
        <button
          type="button"
          onClick={() => setDecision('REJECT')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold ${decision === 'REJECT' ? 'border-rose-400 bg-rose-50 text-rose-800' : 'border-navy-200 text-navy-600'}`}
        >
          <X className="size-4" aria-hidden /> {t('Je n’ai rien reçu')}
        </button>
      </div>

      {decision === 'CONFIRM' ? (
        <Field
          label={t('Numéro de la transaction Wave (facultatif)')}
          htmlFor="transactionReference"
          hint={t('Vous le trouvez dans votre application Wave, sur le reçu du client.')}
        >
          <Input id="transactionReference" name="transactionReference" maxLength={60} placeholder={t('TDH5TEWTLFE')} />
        </Field>
      ) : null}

      <Field
        label={decision === 'CONFIRM' ? t('Où avez-vous vérifié ? (obligatoire)') : t('Pourquoi ? (obligatoire)')}
        htmlFor="note"
        required
        hint={t('Une phrase suffit. Ex. « Vu sur mon téléphone Wave à 10:42 ».')}
      >
        <Textarea id="note" name="note" rows={2} maxLength={500} required />
      </Field>

      <Button type="submit" variant={decision === 'CONFIRM' ? 'primary' : 'danger'} loading={pending}>
        {decision === 'CONFIRM' ? t('Oui, l’argent est arrivé') : t('Non, je n’ai rien reçu')}
      </Button>
      <p className="flex items-start gap-1.5 text-[11px] text-navy-500">
        <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
        {t('Ne vous fiez pas à une capture d’écran : ouvrez votre application Wave et vérifiez vous-même.')}
      </p>
    </form>
  );
}

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const { t } = useAdminI18n();
  const [state, formAction, pending] = useActionState(cancelOrderAction, initial);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <Field label={t('Motif d’annulation')} htmlFor="cancel-note">
        <Input id="cancel-note" name="note" maxLength={300} placeholder={t('Ex. client injoignable, rupture fournisseur…')} />
      </Field>
      <Button type="submit" variant="outline" loading={pending}>
        <Send className="size-4" aria-hidden /> {t('Annuler la commande')}
      </Button>
    </form>
  );
}
