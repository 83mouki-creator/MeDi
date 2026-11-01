import Link from 'next/link';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { Search } from 'lucide-react';
import { getStockCounters, listStockProducts, type StockFilter } from '@/lib/admin';
import { StockAdjustForm } from '@/components/admin/stock-adjust';
import { Badge, Card, EmptyState } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form';
import { Pagination } from '@/components/pagination';
import { parsePage } from '@/lib/utils';
export const dynamic = 'force-dynamic';

const FILTERS: Record<StockFilter, string> = {
  all: 'Tous les produits',
  low: 'Sous le seuil d’alerte',
  out: 'Épuisés',
};

export default async function StockPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getAdminI18n();
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q : '';
  const rawFilter = typeof params.filter === 'string' ? params.filter : 'all';
  const filter: StockFilter = rawFilter === 'low' || rawFilter === 'out' ? rawFilter : 'all';
  const page = parsePage(params.page);

  const [counters, result] = await Promise.all([
    getStockCounters(),
    listStockProducts({ q, filter, page, perPage: 25 }),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">{t('Stock')}</h1>
        <p className="text-sm text-navy-600">
          {t('Le stock disponible affiché est le stock physique moins les unités réservées par des commandes en cours. Toute modification est tracée dans un mouvement horodaté.')}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-navy-500">{t('Produits publiés')}</p>
          <p className="mt-1 text-2xl font-extrabold">{counters.tracked}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-navy-500">{t('Sous le seuil d’alerte')}</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-600">{counters.low}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-navy-500">{t('Épuisés')}</p>
          <p className="mt-1 text-2xl font-extrabold text-rose-600">{counters.out}</p>
        </Card>
      </div>

      <Card className="p-3">
        <form method="get" className="grid gap-2 sm:grid-cols-[1fr_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy-400" aria-hidden />
            <Input
              name="q"
              defaultValue={q}
              className="pl-9"
              placeholder={t('Nom du produit ou référence')}
              aria-label={t('Rechercher un produit dans le stock')}
            />
          </div>
          <Select name="filter" defaultValue={filter} aria-label={t('Filtrer le stock')}>
            {(Object.keys(FILTERS) as StockFilter[]).map((key) => (
              <option key={key} value={key}>
                {FILTERS[key]}
              </option>
            ))}
          </Select>
          <Button type="submit">{t('Afficher')}</Button>
        </form>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState
          title={q ? 'Aucun produit ne correspond' : 'Aucun produit dans cette sélection'}
          description={
            q
              ? 'Vérifiez l’orthographe du nom ou de la référence.'
              : 'Créez ou importez des produits pour suivre leur stock.'
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {result.items.map((product) => (
              <Card key={product.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={`/admin/produits/${product.id}`} className="font-semibold text-navy-900 hover:text-accent-700">
                      {product.name}
                    </Link>
                    <p className="text-xs text-navy-500">
                      {product.sku} · physique {product.stock} · réservé {product.reserved} · disponible {product.available} · seuil{' '}
                      {product.threshold}
                    </p>
                  </div>
                  <Badge tone={product.available <= 0 ? 'danger' : product.available <= product.threshold ? 'warning' : 'success'}>
                    {product.available <= 0 ? 'Épuisé' : product.available <= product.threshold ? 'Stock faible' : 'OK'}
                  </Badge>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-accent-700">{t('Ajuster le stock')}</summary>
                  <div className="mt-3">
                    <StockAdjustForm productId={product.id} currentStock={product.stock} reserved={product.reserved} />
                  </div>
                </details>
              </Card>
            ))}
          </div>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            basePath="/admin/stock"
            searchParams={{ q: q || undefined, filter: filter !== 'all' ? filter : undefined }}
            labels={{ nav: t('Pagination'), previous: t('Page précédente'), next: t('Page suivante') }}
      />
        </>
      )}
    </div>
  );
}
