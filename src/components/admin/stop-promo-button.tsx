'use client';

import { useActionState } from 'react';
import { stopPromoAction, type PromoActionState } from '@/app/actions/admin-promos';
import { useAdminI18n } from '@/components/admin/admin-i18n';
import { Button } from '@/components/ui/button';

const initial: PromoActionState = {};

/** Arrêt immédiat d'une opération : les prix d'avant reviennent sur le site. */
export function StopPromoButton({ campaignId }: { campaignId: string }) {
  const { t } = useAdminI18n();
  const [state, formAction, pending] = useActionState(stopPromoAction, initial);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="campaignId" value={campaignId} />
      <Button type="submit" size="sm" variant="secondary" loading={pending}>
        {t('Arrêter')}
      </Button>
      {state.error ? <span className="text-xs text-rose-700">{state.error}</span> : null}
      {state.success ? <span className="text-xs text-emerald-700">{state.success}</span> : null}
    </form>
  );
}
