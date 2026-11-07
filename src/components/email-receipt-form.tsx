'use client';

import { useActionState } from 'react';
import { Mail } from 'lucide-react';
import { emailOrderReceiptAction, type EmailReceiptState } from '@/app/actions/order-email';
import { Button } from './ui/button';
import { Alert } from './ui/primitives';
import { useSiteT } from './site-i18n';

/**
 * « Recevoir le bon par e-mail » — disponible sur la page de confirmation et
 * sur la page de suivi. N'apparaît que si le service d'e-mail est configuré :
 * aucun bouton mort.
 */
export function EmailReceiptForm({
  number,
  token,
  email,
}: {
  number: string;
  token: string;
  email: string | null;
}) {
  const [state, formAction, pending] = useActionState(emailOrderReceiptAction, {} as EmailReceiptState);
  const t = useSiteT();

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="number" value={number} />
      <input type="hidden" name="token" value={token} />
      {state.ok ? (
        <Alert tone="success">{t('Bon envoyé à {email}. Vérifiez aussi les indésirables.', { email: state.to ?? '' })}</Alert>
      ) : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Button type="submit" variant="outline" size="sm" loading={pending} className="w-full">
        <Mail className="size-4" aria-hidden /> {t('Recevoir le bon par e-mail')}
      </Button>
      {email && !state.ok ? <p className="text-xs text-navy-500">{t('Envoyé à {email}', { email })}</p> : null}
    </form>
  );
}
