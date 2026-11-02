'use client';

import { useActionState } from 'react';
import { LockKeyhole, Unlock } from 'lucide-react';
import { closeCashAction, openCashAction, type CashActionState } from '@/app/actions/admin-cash';
import { useAdminI18n } from '@/components/admin/admin-i18n';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';

const initial: CashActionState = {};

/** Ouverture de caisse : on inscrit le fond de caisse compté le matin. */
export function OpenCashForm({ suggestedFloat }: { suggestedFloat: number }) {
  const { t } = useAdminI18n();
  const [state, formAction, pending] = useActionState(openCashAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('Fond de caisse (FCFA)')} htmlFor="openingFloat" required hint={t('L’argent déjà présent dans le tiroir avant la première vente.')}>
          <Input id="openingFloat" name="openingFloat" type="number" min={0} step={100} defaultValue={suggestedFloat} required />
        </Field>
        <Field label={t('Remarque (facultatif)')} htmlFor="open-note">
          <Input id="open-note" name="note" maxLength={200} placeholder={t('Ex. caisse du matin')} />
        </Field>
      </div>
      <Button type="submit" loading={pending}>
        <Unlock className="size-4" aria-hidden />
        {t('Ouvrir la caisse')}
      </Button>
    </form>
  );
}

/** Fermeture de caisse : on saisit l'argent réellement compté. */
export function CloseCashForm({ expected }: { expected: number }) {
  const { t } = useAdminI18n();
  const [state, formAction, pending] = useActionState(closeCashAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t('Argent compté en caisse (FCFA)')}
          htmlFor="countedCash"
          required
          hint={t('Comptez billets et pièces, puis inscrivez le total. L’écart avec {expected} FCFA sera enregistré.', { expected })}
        >
          <Input id="countedCash" name="countedCash" type="number" min={0} step={100} defaultValue={expected} required />
        </Field>
        <Field label={t('Remarque (facultatif)')} htmlFor="close-note">
          <Input id="close-note" name="note" maxLength={200} placeholder={t('Ex. erreur de rendu sur une vente')} />
        </Field>
      </div>
      <Button type="submit" variant="secondary" loading={pending}>
        <LockKeyhole className="size-4" aria-hidden />
        {t('Fermer la caisse')}
      </Button>
    </form>
  );
}
