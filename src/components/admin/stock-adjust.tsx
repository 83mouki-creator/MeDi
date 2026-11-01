'use client';

import { useAdminI18n } from '@/components/admin/admin-i18n';
import { useActionState, useState } from 'react';
import { adjustStockAction, type AdminState } from '@/app/actions/admin-products';
import { Button } from '../ui/button';
import { Field, Input, Select } from '../ui/form';
import { Alert } from '../ui/primitives';

const initial: AdminState = {};

export function StockAdjustForm({ productId, currentStock, reserved }: { productId: string; currentStock: number; reserved: number }) {
  const { t } = useAdminI18n();
  const [state, formAction, pending] = useActionState(adjustStockAction, initial);
  const [mode, setMode] = useState<'delta' | 'set'>('delta');

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('Opération')} htmlFor={`mode-${productId}`}>
          <Select id={`mode-${productId}`} name="mode" value={mode} onChange={(e) => setMode(e.target.value as 'delta' | 'set')}>
            <option value="delta">{t('Ajouter / retirer')}</option>
            <option value="set">{t('Définir le stock exact')}</option>
          </Select>
        </Field>
        <Field label={mode === 'delta' ? t('Quantité (±)') : t('Nouveau stock')} htmlFor={`qty-${productId}`} required>
          <Input id={`qty-${productId}`} name="quantity" type="number" step={1} required placeholder={mode === 'delta' ? '10 ou -2' : '0'} />
        </Field>
        <Field label={t('Motif (obligatoire)')} htmlFor={`reason-${productId}`} required>
          <Input id={`reason-${productId}`} name="reason" required maxLength={120} placeholder={t('Réapprovisionnement, casse, inventaire…')} />
        </Field>
      </div>

      <p className="text-xs text-navy-500">
        {t('Stock actuel :')} <strong>{currentStock}</strong> · {t('Réservé')} : <strong>{reserved}</strong> ·{' '}
        {t('Disponible')} : <strong>{currentStock - reserved}</strong>.{' '}
        {t('Le stock ne peut jamais devenir négatif ni passer sous les unités réservées.')}
      </p>

      <Button type="submit" variant="secondary" loading={pending}>{t('Enregistrer le mouvement')}</Button>
    </form>
  );
}
