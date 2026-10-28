import type { Metadata } from 'next';
import Link from 'next/link';
import { PackageSearch, SearchX } from 'lucide-react';
import { listProducts, getCategoryTree, listBrandsWithCounts, getPriceRange } from '@/lib/catalog';
import { searchProducts } from '@/lib/search';
import { recordSearch } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { ProductGrid } from '@/components/product-card';
import { CatalogFilters, SortSelect } from '@/components/catalog-filters';
import { Pagination } from '@/components/pagination';
import { EmptyState } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';

type SearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = {
  title: 'Catalogue — outillage, construction, quincaillerie',
  description:
    "Parcourez tout le catalogue MeDi : outillage industriel, matériel de construction, quincaillerie, électroménager et équipement de la maison à Daloa.",
  alternates: { canonical: '/catalogue' },
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = first(params.q)?.trim() ?? '';
  const category = first(params.category) ?? '';
  const brand = first(params.brand) ?? '';
  const min = Number(first(params.min) ?? '') || undefined;
  const max = Number(first(params.max) ?? '') || undefined;
  const promo = first(params.promo) === '1';
  const availability = promo ? 'promo' : ((first(params.availability) as 'in_stock' | 'promo' | 'all' | undefined) ?? 'all');
  const sort = (first(params.sort) as 'relevance' | 'price_asc' | 'price_desc' | 'newest' | undefined) ?? 'relevance';
  const page = Math.max(1, Number(first(params.page) ?? 1) || 1);

  const [tree, brands, priceRange] = await Promise.all([
    getCategoryTree().catch(() => ({ roots: [], childrenOf: () => [], all: [] as { id: string; slug: string; name: string; productCount: number }[] })),
    listBrandsWithCounts().catch(() => []),
    getPriceRange().catch(() => ({ min: 0, max: 0 })),
  ]);

  const filters = { category: category || undefined, brand: brand || undefined, minPrice: min, maxPrice: max, availability, sort, page, perPage: 24 };

  const searchResult = q
    ? await searchProducts(q, { page, perPage: 24, sort, category: category || undefined, brand: brand || undefined, availability: availability === 'in_stock' ? 'in_stock' : 'all' })
    : null;
  const listResult = q ? null : await listProducts(filters);

  const result = searchResult ?? listResult!;
  const usedFuzzy = searchResult?.usedFuzzy ?? false;

  const items = q ? result.items.filter((item) => (promo ? item.onPromo : true)) : result.items;

  if (q) {
    const user = await getCurrentUser().catch(() => null);
    await recordSearch(q, result.total, 'TEXT', user?.id).catch(() => undefined);
  }

  const categoriesForFilter = tree.all.map((c) => ({ slug: c.slug, name: c.name, count: c.productCount }));
  const total = q && promo ? items.length : result.total;

  const searchParamsForLinks: Record<string, string | undefined> = {
    q: q || undefined,
    category: category || undefined,
    brand: brand || undefined,
    min: min ? String(min) : undefined,
    max: max ? String(max) : undefined,
    availability: availability !== 'all' ? availability : undefined,
    promo: promo ? '1' : undefined,
    sort: sort !== 'relevance' ? sort : undefined,
  };

  return (
    <div className="container-page py-6">
      <nav aria-label="Fil d'Ariane" className="mb-3 text-xs text-navy-500">
        <Link href="/" className="hover:text-accent-700">Accueil</Link>
        <span className="mx-1.5" aria-hidden>/</span>
        <span className="font-medium text-navy-800">{q ? 'Résultats de recherche' : 'Catalogue'}</span>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {q ? `Résultats pour « ${q} »` : 'Tout le catalogue'}
        </h1>
        <p className="mt-1 text-sm text-navy-600" aria-live="polite">
          {total} produit{total > 1 ? 's' : ''} {q ? (usedFuzzy && !promo ? '· correspondances approximatives incluses' : '') : 'disponibles'}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-40 lg:self-start">
          <details className="rounded-xl border border-navy-100 bg-white p-4 lg:open:block" open>
            <summary className="cursor-pointer text-sm font-semibold lg:hidden">Afficher les filtres</summary>
            <div className="mt-3 lg:mt-0">
              <CatalogFilters
                basePath="/catalogue"
                categories={categoriesForFilter}
                brands={brands.map((b) => ({ slug: b.slug, name: b.name, count: b.productCount }))}
                priceRange={priceRange}
              />
            </div>
          </details>
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-navy-100 bg-white px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {q ? <Chip label={`Recherche : ${q}`} /> : null}
              {promo ? <Chip label="Promotions" /> : null}
              {availability === 'in_stock' ? <Chip label="En stock" /> : null}
              {category ? <Chip label={tree.all.find((c) => c.slug === category)?.name ?? category} /> : null}
              {brand ? <Chip label={brands.find((b) => b.slug === brand)?.name ?? brand} /> : null}
              {min || max ? <Chip label={`${min ?? 0} – ${max ?? '∞'} FCFA`} /> : null}
            </div>
            <SortSelect basePath="/catalogue" />
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={q ? <SearchX className="size-10" /> : <PackageSearch className="size-10" />}
              title={q ? 'Aucun produit ne correspond à votre recherche' : 'Aucun produit dans cette sélection'}
              description={
                q
                  ? 'Vérifiez l’orthographe, essayez un terme plus général (ex. « perceuse » au lieu de « perceuse à percussion Bosch ») ou parcourez les catégories.'
                  : 'Modifiez vos filtres ou parcourez tout le catalogue.'
              }
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <ButtonLink href="/catalogue" variant="outline">Tout le catalogue</ButtonLink>
                  <ButtonLink href="/contact">Demander un produit</ButtonLink>
                </div>
              }
            />
          ) : (
            <>
              <ProductGrid products={items} />
              <Pagination page={result.page} totalPages={result.totalPages} basePath="/catalogue" searchParams={searchParamsForLinks} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-navy-50 px-2 py-1 text-xs font-medium text-navy-700">{label}</span>
  );
}
