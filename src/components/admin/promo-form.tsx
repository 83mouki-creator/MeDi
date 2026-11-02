'use client';

import { useActionState, useMemo, useState } from 'react';
import { Search, Tags } from 'lucide-react';
import { createPromoAction, type PromoActionState } from '@/app/actions/admin-promos';
import { useAdminI18n } from '@/components/admin/admin-i18n';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';
import { formatFCFA } from '@/lib/utils';

export type PromoProductChoice = {
  id: string;
  name: string;
  sku: string;
  price: number;
  promoPrice: number | null;
  stock: number;
};

const initial: PromoActionState = {};

function todayISO(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/**
 * Formulaire de promotion manuelle : on coche des produits, on choisit la
 * remise et la période, et le prix baisse immédiatement sur la boutique.
 */
export function PromoForm({ products }: { products: PromoProductChoice[] }) {
  const { t } = useAdminI18n();
  const [state, formAction, pending] = useActionState(createPromoAction, initial);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [type, setType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [value, setValue] = useState('20');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((product) => product.name.toLowerCase().includes(needle) || product.sku.toLowerCase().includes(needle));
  }, [products, query]);

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const numericValue = Number(value.replace(',', '.')) || 0;
  const previewPrice = (price: number) =>
    type === 'PERCENT' ? Math.max(1, Math.round(price * (1 - numericValue / 100))) : Math.max(1, Math.round(price - numericValue));

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('Nom de l’opération')} htmlFor="promo-name" required hint={t('Exemple : opération outillage de fin d’année')}>
          <Input id="promo-name" name="name" required maxLength={80} placeholder={t('Opération outillage')} />
        </Field>
        <Field
          label={t('Phrase du bandeau (facultatif)')}
          htmlFor="promo-banner"
          hint={t('Affichée en haut du site, par exemple : −20 % sur l’outillage jusqu’à dimanche !')}
        >
          <Input id="promo-banner" name="bannerText" maxLength={140} />
        </Field>
        <Field label={t('Type de remise')} htmlFor="promo-type">
          <Select id="promo-type" name="type" value={type} onChange={(event) => setType(event.target.value as 'PERCENT' | 'FIXED')}>
            <option value="PERCENT">{t('Pourcentage du prix')}</option>
            <option value="FIXED">{t('Montant fixe en FCFA')}</option>
          </Select>
        </Field>
        <Field
          label={type === 'PERCENT' ? t('Remise (%)') : t('Remise (FCFA)')}
          htmlFor="promo-value"
          required
          hint={type === 'PERCENT' ? t('Entre 1 et 90 %') : t('Montant retiré du prix de chaque produit')}
        >
          <Input
            id="promo-value"
            name="value"
            type="number"
            min={1}
            max={type === 'PERCENT' ? 90 : undefined}
            step={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            required
          />
        </Field>
        <Field label={t('Début')} htmlFor="promo-start" required>
          <Input id="promo-start" name="startsAt" type="date" defaultValue={todayISO()} required />
        </Field>
        <Field label={t('Fin')} htmlFor="promo-end" required>
          <Input id="promo-end" name="endsAt" type="date" defaultValue={todayISO(7)} required />
        </Field>
      </div>

      <div className="rounded-xl border border-navy-100">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-100 p-3">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Tags className="size-4 text-accent-600" aria-hidden />
            {t('Produits concernés')} · {selected.length} {t('sélectionné(s)')}
          </p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-navy-400" aria-hidden />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="ps-9"
                placeholder={t('Rechercher un produit')}
                aria-label={t('Rechercher un produit')}
              />
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(filtered.map((item) => item.id))}>
              {t('Tout cocher')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelected([])}>
              {t('Tout décocher')}
            </Button>
          </div>
        </div>

        <ul className="max-h-80 divide-y divide-navy-50 overflow-y-auto">
          {filtered.map((product) => {
            const checked = selected.includes(product.id);
            return (
              <li key={product.id}>
                <label className="flex cursor-pointer items-center gap-3 p-2.5 text-sm hover:bg-navy-50">
                  <input
                    type="checkbox"
                    name="productIds"
                    value={product.id}
                    checked={checked}
                    onChange={() => toggle(product.id)}
                    className="size-4 accent-accent-500"
                  />
                  <span className="flex-1">
                    <span className="font-medium text-navy-900">{product.name}</span>
                    <span className="ms-2 text-xs text-navy-500">{product.sku}</span>
                  </span>
                  <span className="text-xs text-navy-600">
                    {product.stock} {t('en stock')}
                  </span>
                  <span className="w-28 text-end text-sm font-semibold">
                    {checked && numericValue > 0 ? (
                      <>
                        <span className="text-navy-400 line-through">{formatFCFA(product.price)}</span>{' '}
                        <span className="text-emerald-700">{formatFCFA(previewPrice(product.price))}</span>
                      </>
                    ) : (
                      formatFCFA(product.price)
                    )}
                  </span>
                </label>
              </li>
            );
          })}
          {filtered.length === 0 ? <li className="p-4 text-sm text-navy-500">{t('Aucun produit ne correspond à cette recherche.')}</li> : null}
        </ul>
      </div>

      <p className="text-xs text-navy-500">
        {t('La promotion s’applique tout de suite sur la boutique (accueil, rayons, recherche et fiches produit). Les prix d’avant sont conservés : arrêter l’opération les rétablit à l’identique.')}
      </p>

      <Button type="submit" loading={pending} disabled={selected.length === 0}>
        {t('Créer la promotion')}
      </Button>
    </form>
  );
}
