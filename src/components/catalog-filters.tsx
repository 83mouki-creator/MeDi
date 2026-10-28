'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Input, Label, Select } from './ui/form';
import { Button } from './ui/button';
import { formatFCFA } from '@/lib/utils';

type FilterProps = {
  basePath: string;
  categories: { slug: string; name: string; count: number }[];
  brands: { slug: string; name: string; count: number }[];
  priceRange: { min: number; max: number };
};

/** Filtres du catalogue : formulaire GET classique (fonctionne sans JavaScript). */
export function CatalogFilters({ basePath, categories, brands, priceRange }: FilterProps) {
  const params = useSearchParams();
  const current = new URLSearchParams(params.toString());

  const setParam = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.target.value;
    if (value) current.set(key, value);
    else current.delete(key);
    current.delete('page');
    window.location.href = `${basePath}?${current.toString()}`;
  };

  const activeCount = ['category', 'brand', 'min', 'max', 'availability', 'promo', 'q'].filter((key) => params.get(key)).length;

  return (
    <form action={basePath} method="get" className="space-y-5" aria-label="Filtres du catalogue">
      {params.get('q') ? <input type="hidden" name="q" value={params.get('q') ?? ''} /> : null}
      {params.get('sort') ? <input type="hidden" name="sort" value={params.get('sort') ?? ''} /> : null}

      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-navy-900">
          <SlidersHorizontal className="size-4" aria-hidden /> Filtres
        </h2>
        {activeCount > 0 ? (
          <a href={basePath} className="flex items-center gap-1 text-xs font-semibold text-accent-700 hover:underline">
            <X className="size-3.5" aria-hidden /> Réinitialiser
          </a>
        ) : null}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-navy-900">Catégorie</legend>
        <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
          <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-navy-50">
            <input type="radio" name="category" value="" defaultChecked={!params.get('category')} className="accent-accent-500" />
            Toutes les catégories
          </label>
          {categories.map((category) => (
            <label key={category.slug} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-navy-50">
              <input
                type="radio"
                name="category"
                value={category.slug}
                defaultChecked={params.get('category') === category.slug}
                className="accent-accent-500"
              />
              <span className="flex-1">{category.name}</span>
              <span className="text-xs text-navy-400">{category.count}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-navy-900">Marque</legend>
        <Select name="brand" defaultValue={params.get('brand') ?? ''}>
          <option value="">Toutes les marques</option>
          {brands.map((brand) => (
            <option key={brand.slug} value={brand.slug}>
              {brand.name} ({brand.count})
            </option>
          ))}
        </Select>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-navy-900">Prix (FCFA)</legend>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Label htmlFor="min" className="text-xs text-navy-500">Min</Label>
            <Input id="min" name="min" type="number" inputMode="numeric" min={0} step={500} placeholder={String(priceRange.min)} defaultValue={params.get('min') ?? ''} />
          </div>
          <div className="flex-1">
            <Label htmlFor="max" className="text-xs text-navy-500">Max</Label>
            <Input id="max" name="max" type="number" inputMode="numeric" min={0} step={500} placeholder={String(priceRange.max)} defaultValue={params.get('max') ?? ''} />
          </div>
        </div>
        <p className="mt-1 text-xs text-navy-400">
          Catalogue : {formatFCFA(priceRange.min)} – {formatFCFA(priceRange.max)}
        </p>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-navy-900">Disponibilité</legend>
        <div className="space-y-1">
          {[
            { value: '', label: 'Tous les produits' },
            { value: 'in_stock', label: 'En stock uniquement' },
            { value: 'promo', label: 'En promotion' },
          ].map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-navy-50">
              <input
                type="radio"
                name="availability"
                value={option.value}
                defaultChecked={(params.get('availability') ?? '') === option.value}
                className="accent-accent-500"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" className="w-full">
        Appliquer les filtres
      </Button>
    </form>
  );
}

/** Tri : conserve les filtres et recharge la page immédiatement. */
export function SortSelect({ basePath }: { basePath: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm text-navy-600">
      <span className="hidden sm:inline">Trier par</span>
      <Select
        aria-label="Trier les résultats"
        value={params.get('sort') ?? 'relevance'}
        disabled={pending}
        onChange={(event) => {
          const next = new URLSearchParams(params.toString());
          if (event.target.value === 'relevance') next.delete('sort');
          else next.set('sort', event.target.value);
          next.delete('page');
          startTransition(() => router.push(`${basePath}?${next.toString()}`));
        }}
        className="h-10 w-auto"
      >
        <option value="relevance">Pertinence</option>
        <option value="price_asc">Prix croissant</option>
        <option value="price_desc">Prix décroissant</option>
        <option value="newest">Nouveautés</option>
      </Select>
    </label>
  );
}
