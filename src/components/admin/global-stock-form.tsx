'use client';

import { useActionState, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { adjustAllStockAction, type GlobalStockState } from '@/app/actions/admin-stock';
import { useAdminI18n } from '@/components/admin/admin-i18n';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';

const initial: GlobalStockState = {};

/**
 * Ajout ou retrait de pièces sur tout le stock d'un coup.
 *
 * Deux boutons seulement : « + » ajoute la quantité à chaque produit, « − » la
 * retire. Le motif est obligatoire et chaque produit garde sa ligne d'historique.
 */
export function GlobalStockForm({ productCount }: { productCount: number }) {
  const { t } = useAdminI18n();
  const [state, formAction, pending] = useActionState(adjustAllStockAction, initial);
  const [quantity, setQuantity] = useState('1');

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <Field label={t('Nombre de pièces')} htmlFor="global-qty" required>
          <Input
            id="global-qty"
            name="quantity"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
          />
        </Field>
        <Field label={t('Pourquoi ? (obligatoire)')} htmlFor="global-reason" required>
          <Input
            id="global-reason"
            name="reason"
            required
            maxLength={120}
            placeholder={t('Ex. livraison du fournisseur, inventaire du samedi')}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" loading={pending} name="sign" value="add">
          <Plus className="size-4" aria-hidden />
          {t('Ajouter à tout le stock')}
        </Button>
        <Button type="submit" variant="secondary" loading={pending} name="sign" value="remove">
          <Minus className="size-4" aria-hidden />
          {t('Retirer à tout le stock')}
        </Button>
      </div>

      <p className="text-xs text-navy-500">
        {t('Les {count} produits non archivés sont concernés. Un produit dont le stock deviendrait négatif est ignoré et signalé. Chaque mouvement est écrit dans l’historique.', {
          count: productCount,
        })}
      </p>
      <p className="text-xs text-amber-700">{t('« Retirer » déduit la quantité indiquée de chaque produit.')}</p>
    </form>
  );
}
