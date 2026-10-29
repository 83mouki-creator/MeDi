import type { Metadata } from 'next';
import { and, asc, desc, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import { ArrowRight, BadgeCheck, Truck, Store, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/db';
import { brands, categories, products } from '@/db/schema';
import { ProductCardView } from '@/components/product-card';
import type { ProductCard } from '@/lib/catalog';
import { categoryIcon } from '@/components/category-icon';
import { getStoreSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'MeDi — Quincaillerie, outillage et équipement à Daloa',
  description:
    'Trouvez l’outillage professionnel, les matériaux de construction et l’équipement de la maison chez MeDi à Daloa. Prix en FCFA, stock réel, livraison locale et expédition en Côte d’Ivoire.',
  alternates: { canonical: '/' },
};

export const dynamic = 'force-dynamic';

async function getHomeData() {
  try {
    const [roots, featured, latest, promos, brandList, counts] = await Promise.all([
      db
        .select({ id: categories.id, name: categories.name, slug: categories.slug })
        .from(categories)
        .where(and(eq(categories.isActive, true), isNull(categories.parentId)))
        .orderBy(asc(categories.position), asc(categories.name))
        .limit(10),
      db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.isActive, true),
            eq(products.isArchived, false),
            eq(products.isFeatured, true),
            sql`(${products.stock} - ${products.reserved}) > 0`,
          ),
        )
        .orderBy(desc(products.soldCount), desc(products.createdAt))
        .limit(8),
      db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.isActive, true), eq(products.isArchived, false)))
        .orderBy(desc(products.createdAt))
        .limit(8),
      db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.isActive, true),
            eq(products.isArchived, false),
            isNotNull(products.promoPrice),
            gt(products.promoPrice, sql`0`),
          ),
        )
        .orderBy(desc(products.updatedAt))
        .limit(8),
      db
        .select({ id: brands.id, name: brands.name, slug: brands.slug })
        .from(brands)
        .where(
          and(
            eq(brands.isActive, true),
            sql`EXISTS (SELECT 1 FROM products p WHERE p.brand_id = ${brands.id} AND p.is_active AND NOT p.is_archived)`,
          ),
        )
        .orderBy(asc(brands.name))
        .limit(12),
      db.execute(sql`
        SELECT
          (SELECT count(*)::int FROM products WHERE is_active AND NOT is_archived) AS products,
          (SELECT count(*)::int FROM categories WHERE is_active AND parent_id IS NULL) AS categories
      `),
    ]);

    return {
      roots,
      featured,
      latest,
      promos,
      brandList,
      productCount: (counts.rows[0] as { products: number } | undefined)?.products ?? 0,
      categoryCount: (counts.rows[0] as { categories: number } | undefined)?.categories ?? 0,
    };
  } catch (error) {
    console.error('[home] chargement impossible', error);
    return { roots: [], featured: [], latest: [], promos: [], brandList: [], productCount: 0, categoryCount: 0 };
  }
}

async function cardsFor(ids: string[]): Promise<ProductCard[]> {
  if (ids.length === 0) return [];
  const { getProductsByIds } = await import('@/lib/catalog');
  return getProductsByIds(ids);
}

export default async function HomePage() {
  const [settings, data] = await Promise.all([getStoreSettings(), getHomeData()]);
  const [featured, latest, promos] = await Promise.all([
    cardsFor(data.featured.map((row) => row.id)),
    cardsFor(data.latest.map((row) => row.id)),
    cardsFor(data.promos.map((row) => row.id)),
  ]);

  const whatsappHref = settings.whatsapp
    ? `https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
        'Bonjour MeDi, je souhaite des informations sur un produit.',
      )}`
    : null;

  return (
    <>
      {/* HERO */}
      <section className="bg-navy-950 text-white">
        <div className="container-page grid gap-6 py-8 sm:py-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-300">
              <BadgeCheck className="size-3.5" aria-hidden /> Daloa · Côte d’Ivoire
            </p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              L’outillage et le matériel qu’il vous faut, <span className="text-accent-400">au juste prix</span>.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-navy-200 sm:text-base">
              Outils professionnels, matériaux de construction, quincaillerie et équipement de la maison. Stock réel, prix en
              FCFA, retrait en boutique à Daloa ou livraison.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/catalogue"
                className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-3 text-sm font-bold text-white hover:bg-accent-600"
              >
                Voir le catalogue <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/recherche-visuelle"
                className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Chercher par photo
              </Link>
            </div>
            <dl className="mt-6 grid max-w-md grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-navy-300">Références</dt>
                <dd className="text-lg font-bold">{data.productCount}</dd>
              </div>
              <div>
                <dt className="text-navy-300">Rayons</dt>
                <dd className="text-lg font-bold">{data.categoryCount}</dd>
              </div>
              <div>
                <dt className="text-navy-300">Retrait</dt>
                <dd className="text-lg font-bold">{settings.allowPickup ? 'Gratuit' : 'Sur demande'}</dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-300">Disponibilité en temps réel</p>
              <p className="mt-1 text-sm text-navy-100">
                Chaque fiche indique le stock réellement disponible en boutique. Une dernière unité réservée n’est jamais
                revendue.
              </p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
              <Truck className="size-5 text-accent-300" aria-hidden />
              <p className="mt-2 text-sm font-semibold">Hors Daloa</p>
              <p className="mt-1 text-xs text-navy-200">Expédition par transporteur après paiement confirmé.</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
              <Store className="size-5 text-accent-300" aria-hidden />
              <p className="mt-2 text-sm font-semibold">Retrait boutique</p>
              <p className="mt-1 text-xs text-navy-200">Commandez en ligne, récupérez sur place.</p>
            </div>
          </div>
        </div>
      </section>

      {/* RAYONS */}
      <section className="border-b border-navy-100 bg-navy-50/60 py-8">
        <div className="container-page">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Nos rayons</h2>
            <Link href="/catalogue" className="text-sm font-semibold text-accent-700 hover:underline">
              Tout le catalogue
            </Link>
          </div>
          {data.roots.length === 0 ? (
            <p className="rounded-lg border border-dashed border-navy-200 bg-white p-4 text-sm text-navy-500">
              Les rayons seront affichés dès que le catalogue sera importé.
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {data.roots.map((category) => {
                const Icon = categoryIcon(category.slug);
                return (
                  <li key={category.id}>
                    <Link
                      href={`/categorie/${category.slug}`}
                      className="group flex h-full flex-col items-center gap-2 rounded-xl border border-navy-100 bg-white p-3 text-center transition hover:border-accent-300 hover:shadow-sm"
                    >
                      <span className="grid size-11 place-items-center rounded-full bg-navy-50 text-navy-700 group-hover:bg-accent-50 group-hover:text-accent-600">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="text-xs font-semibold leading-snug text-navy-800 sm:text-sm">{category.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {promos.length > 0 ? (
        <Section
          title="Promotions en cours"
          subtitle="Prix réduits pendant la période annoncée, dans la limite du stock disponible."
          href="/catalogue?promo=1"
          products={promos}
        />
      ) : null}

      {featured.length > 0 ? (
        <Section
          title="Sélection MeDi"
          subtitle="Les références mises en avant par la boutique, disponibles immédiatement."
          href="/catalogue"
          products={featured}
        />
      ) : null}

      <Section
        title="Nouveautés"
        subtitle="Dernières références ajoutées au catalogue."
        href="/catalogue?sort=newest"
        products={latest}
        emptyLabel="Le catalogue sera bientôt enrichi."
      />

      {/* MARQUES */}
      {data.brandList.length > 0 ? (
        <section className="border-y border-navy-100 bg-white py-8">
          <div className="container-page">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Marques disponibles</h2>
            <p className="mt-1 text-sm text-navy-600">Des équipements de marques reconnues, avec facture et garantie fabricant.</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {data.brandList.map((brand) => (
                <li key={brand.id}>
                  <Link
                    href={`/catalogue?brand=${brand.slug}`}
                    className="inline-flex items-center rounded-lg border border-navy-200 bg-navy-50 px-4 py-2 text-sm font-semibold text-navy-800 hover:border-accent-300 hover:bg-white"
                  >
                    {brand.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* LIVRAISON / DALOA */}
      <section className="container-page py-8">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-navy-100 bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Store className="size-5 text-accent-600" aria-hidden /> À Daloa
            </h2>
            <p className="mt-2 text-sm text-navy-600">
              Retrait gratuit en boutique ou livraison à domicile selon votre quartier. Le paiement à la livraison est proposé
              uniquement si la boutique l’autorise pour la zone et le montant concernés.
            </p>
            <Link href="/livraison" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-700 hover:underline">
              Voir les zones et frais <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          <div className="rounded-xl border border-navy-100 bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Truck className="size-5 text-accent-600" aria-hidden /> Reste de la Côte d’Ivoire
            </h2>
            <p className="mt-2 text-sm text-navy-600">
              Expédition par transporteur, sur devis confirmé avant paiement. Le règlement intégral est requis avant remise du
              colis au transporteur, et la commande ne passe « prête à expédier » qu’après vérification de l’encaissement.
            </p>
            <Link href="/livraison" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-700 hover:underline">
              Comment ça marche <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 rounded-xl border border-navy-100 bg-navy-50 p-4 sm:grid-cols-3">
          <div className="flex items-start gap-2 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            <p>
              <strong>Stock vérifié</strong>
              <br />
              <span className="text-navy-600">Le stock est contrôlé avant chaque validation de commande.</span>
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            <p>
              <strong>Prix en FCFA</strong>
              <br />
              <span className="text-navy-600">Le total est recalculé côté serveur, jamais dans le navigateur.</span>
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <Truck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            <p>
              <strong>Suivi de commande</strong>
              <br />
              <span className="text-navy-600">Chaque étape est horodatée, du paiement à la livraison.</span>
            </p>
          </div>
        </div>

        {whatsappHref ? (
          <div className="mt-4 rounded-xl border border-accent-200 bg-accent-50 p-4">
            <p className="text-sm text-navy-800">
              Une question sur une référence ?{' '}
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="font-bold text-accent-700 underline">
                Écrivez-nous sur WhatsApp
              </a>
              .
            </p>
          </div>
        ) : null}

        {!settings.phone ? (
          <p className="mt-4 text-xs text-navy-500">
            Les coordonnées téléphoniques et l’adresse de la boutique seront publiées dès qu’elles nous auront été communiquées
            par le propriétaire.
          </p>
        ) : null}
      </section>
    </>
  );
}

function Section({
  title,
  subtitle,
  href,
  products,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  href: string;
  products: ProductCard[];
  emptyLabel?: string;
}) {
  return (
    <section className="container-page py-8">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-navy-600">{subtitle}</p>
        </div>
        <Link href={href} className="shrink-0 text-sm font-semibold text-accent-700 hover:underline">
          Tout voir
        </Link>
      </div>
      {products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-navy-200 p-4 text-sm text-navy-500">{emptyLabel}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <li key={product.id}>
              <ProductCardView product={product} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
