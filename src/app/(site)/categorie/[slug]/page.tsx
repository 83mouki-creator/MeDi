import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { categories } from '@/db/schema';
import { listProducts, getCategoryTree, listBrandsWithCounts, getPriceRange } from '@/lib/catalog';
import { ProductGrid } from '@/components/product-card';
import { CatalogFilters, SortSelect } from '@/components/catalog-filters';
import { Pagination } from '@/components/pagination';
import { EmptyState } from '@/components/ui/primitives';
import { parsePage } from '@/lib/utils';
type Params = { slug: string };
type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const rows = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  const category = rows[0];
  if (!category) return { title: 'Catégorie introuvable' };
  return {
    title: category.metaTitle ?? `${category.name} à Daloa`,
    description:
      category.metaDescription ??
      `Découvrez notre sélection ${category.name.toLowerCase()} chez MeDi, boutique à Daloa. Retrait en boutique, livraison à Daloa, expédition en Côte d'Ivoire.`,
    alternates: { canonical: `/categorie/${category.slug}` },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const rows = await db
    .select()
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.isActive, true)))
    .limit(1);
  const category = rows[0];
  if (!category) notFound();

  const brand = first(query.brand) ?? '';
  const min = Number(first(query.min) ?? '') || undefined;
  const max = Number(first(query.max) ?? '') || undefined;
  const availability = (first(query.availability) as 'in_stock' | 'promo' | 'all' | undefined) ?? 'all';
  const sort = (first(query.sort) as 'relevance' | 'price_asc' | 'price_desc' | 'newest' | undefined) ?? 'relevance';
  const page = parsePage(first(query.page));

  const [tree, brands, priceRange, result] = await Promise.all([
    getCategoryTree().catch(() => ({ roots: [], childrenOf: () => [], all: [] as { id: string; slug: string; name: string; productCount: number }[] })),
    listBrandsWithCounts().catch(() => []),
    getPriceRange().catch(() => ({ min: 0, max: 0 })),
    listProducts({ category: slug, brand: brand || undefined, minPrice: min, maxPrice: max, availability, sort, page, perPage: 24 }),
  ]);

  const children = tree.childrenOf(category.id);

  return (
    <div className="container-page py-6">
      <nav aria-label="Fil d'Ariane" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-navy-500">
        <Link href="/" className="hover:text-accent-700">Accueil</Link>
        <ChevronRight className="size-3" aria-hidden />
        <Link href="/catalogue" className="hover:text-accent-700">Catalogue</Link>
        <ChevronRight className="size-3" aria-hidden />
        <span className="font-medium text-navy-800">{category.name}</span>
      </nav>

      <header className="mb-4">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{category.name}</h1>
        {category.description ? <p className="mt-2 max-w-3xl text-sm text-navy-600">{category.description}</p> : null}
        <p className="mt-2 text-sm text-navy-500">{result.total} produit(s)</p>
      </header>

      {children.length > 0 ? (
        <div className="mb-5 flex flex-wrap gap-2">
          {children.map((child) => (
            <Link
              key={child.id}
              href={`/categorie/${child.slug}`}
              className="rounded-full border border-navy-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-700 hover:border-accent-300 hover:bg-accent-50"
            >
              {child.name} <span className="text-navy-400">({child.productCount})</span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-40 lg:self-start">
          <details className="rounded-xl border border-navy-100 bg-white p-4" open>
            <summary className="cursor-pointer text-sm font-semibold lg:hidden">Afficher les filtres</summary>
            <div className="mt-3 lg:mt-0">
              <CatalogFilters
                basePath={`/categorie/${slug}`}
                categories={tree.all.map((c) => ({ slug: c.slug, name: c.name, count: c.productCount }))}
                brands={brands.map((b) => ({ slug: b.slug, name: b.name, count: b.productCount }))}
                priceRange={priceRange}
              />
            </div>
          </details>
        </aside>

        <div>
          <div className="mb-4 flex justify-end rounded-lg border border-navy-100 bg-white px-3 py-2">
            <SortSelect basePath={`/categorie/${slug}`} />
          </div>
          {result.items.length === 0 ? (
            <EmptyState
              title="Aucun produit dans cette catégorie pour le moment"
              description="Les produits arrivent progressivement. Explorez le reste du catalogue ou contactez-nous pour une demande spécifique."
              action={<Link href="/catalogue" className="font-semibold text-accent-700 hover:underline">Voir tout le catalogue</Link>}
            />
          ) : (
            <>
              <ProductGrid products={result.items} />
              <Pagination
                page={result.page}
                totalPages={result.totalPages}
                basePath={`/categorie/${slug}`}
                searchParams={{ brand: brand || undefined, min: min ? String(min) : undefined, max: max ? String(max) : undefined, availability: availability !== 'all' ? availability : undefined, sort: sort !== 'relevance' ? sort : undefined }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
