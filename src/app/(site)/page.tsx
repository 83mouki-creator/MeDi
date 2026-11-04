import type { Metadata } from 'next';
import { and, asc, desc, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import Image from 'next/image';
import { ArrowRight, BadgeCheck, CalendarClock, MapPin, ShieldCheck, Store, Truck } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/db';
import { brands, categories, products } from '@/db/schema';
import { ProductCardView } from '@/components/product-card';
import { listBestSellerProductIds, type ProductCard } from '@/lib/catalog';
import { categoryIcon } from '@/components/category-icon';
import { getStoreSettings } from '@/lib/settings';
import { getSiteI18n } from '@/lib/i18n/site-server';
import { storeLocation, whatsappWithMessage } from '@/lib/store-location';
import { PICKUP_HOLD_HOURS, OUTSIDE_DALOA_MAX_DAYS, FINAL_SALE_NOTICE_SHORT } from '@/lib/store-policy';
import { DALOA_NEIGHBOURHOOD_COUNT } from '@/lib/daloa';

export const metadata: Metadata = {
  title: 'MeDi Shop — Quincaillerie, outillage et équipement à Daloa',
  description:
    'Trouvez l’outillage professionnel, les matériaux de construction et l’équipement de la maison chez MeDi Shop à Daloa. Prix en FCFA, stock réel, retrait en boutique, livraison à Daloa et expédition dans toute la Côte d’Ivoire.',
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
            // Même fenêtre de validité que la fiche produit : une promo expirée
            // ne doit pas apparaître dans « Promotions en cours ».
            sql`(${products.promoPrice} < ${products.price})`,
            sql`(${products.promoStartsAt} IS NULL OR ${products.promoStartsAt} <= now())`,
            sql`(${products.promoEndsAt} IS NULL OR ${products.promoEndsAt} >= now())`,
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
  const [settings, data, { t }] = await Promise.all([getStoreSettings(), getHomeData(), getSiteI18n()]);
  const [featured, latest, promos, bestSellers] = await Promise.all([
    cardsFor(data.featured.map((row) => row.id)),
    cardsFor(data.latest.map((row) => row.id)),
    cardsFor(data.promos.map((row) => row.id)),
    listBestSellerProductIds(8)
      .then((ids) => cardsFor(ids))
      .catch(() => []),
  ]);

  const location = storeLocation(settings);
  const whatsappHref = whatsappWithMessage(
    settings,
    'Bonjour MeDi Shop, je souhaite des informations sur un produit.',
  );

  return (
    <>
      {/* HERO — photo de quincaillerie en fond */}
      <section className="relative isolate overflow-hidden bg-navy-950 text-white">
        <Image
          src="/brand/fond-quincaillerie.jpg"
          alt={t('Intérieur de la quincaillerie MeDi Shop à Daloa : outils et matériaux rangés en rayon')}
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 object-cover object-center"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-navy-950/90 via-navy-950/80 to-navy-950/95 rtl:bg-gradient-to-t"
          aria-hidden
        />
        <div className="container-page grid gap-6 py-10 sm:py-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-300 ring-1 ring-white/15">
              <BadgeCheck className="size-3.5" aria-hidden /> {t('Daloa · Côte d’Ivoire')}
            </p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {t('L’outillage et le matériel qu’il vous faut,')} <span className="text-accent-400">{t('au juste prix')}</span>.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-navy-100 sm:text-base">
              {t('Outils professionnels, matériaux de construction, quincaillerie et équipement de la maison. Stock réel, prix en FCFA, retrait en boutique à Daloa ou livraison.')}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/catalogue"
                className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-3 text-sm font-bold text-navy-950 hover:bg-accent-400"
              >
                {t('Voir le catalogue')} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Link>
              <Link
                href="/recherche-visuelle"
                className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                {t('Chercher par photo')}
              </Link>
            </div>
            <dl className="mt-6 grid max-w-md grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-navy-200">{t('Références')}</dt>
                <dd className="text-lg font-bold">{data.productCount}</dd>
              </div>
              <div>
                <dt className="text-navy-200">{t('Rayons')}</dt>
                <dd className="text-lg font-bold">{data.categoryCount}</dd>
              </div>
              <div>
                <dt className="text-navy-200">{t('Retrait')}</dt>
                <dd className="text-lg font-bold">{settings.allowPickup ? t('Gratuit') : t('Sur demande')}</dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-300">{t('Adresse exacte de la boutique')}</p>
              <p className="mt-1 text-sm font-bold text-white" dir="ltr">
                {location.dms}
              </p>
              <p className="mt-1 text-xs text-navy-100">
                {location.city}, {location.country}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                <a
                  href={location.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-accent-300 underline decoration-accent-500 underline-offset-2 hover:text-accent-200"
                >
                  {t('Ouvrir dans Google Maps')}
                </a>
                <a
                  href={location.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-accent-300 underline decoration-accent-500 underline-offset-2 hover:text-accent-200"
                >
                  {t('Itinéraire')}
                </a>
              </div>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
              <Store className="size-5 text-accent-300" aria-hidden />
              <p className="mt-2 text-sm font-semibold">{t('Retrait boutique')}</p>
              <p className="mt-1 text-xs text-navy-100">{t('Colis gardé {hours} h maximum.', { hours: PICKUP_HOLD_HOURS })}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
              <Truck className="size-5 text-accent-300" aria-hidden />
              <p className="mt-2 text-sm font-semibold">{t('Hors Daloa')}</p>
              <p className="mt-1 text-xs text-navy-100">
                {t('{days} jours maximum selon la ville. Transport à convenir sur WhatsApp.', { days: OUTSIDE_DALOA_MAX_DAYS })}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* RAYONS */}
      <section className="border-b border-navy-100 bg-navy-50/60 py-8">
        <div className="container-page">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{t('Nos rayons')}</h2>
            <Link href="/catalogue" className="text-sm font-semibold text-accent-700 hover:underline">
              {t('Tout le catalogue')}
            </Link>
          </div>
          {data.roots.length === 0 ? (
            <p className="rounded-lg border border-dashed border-navy-200 bg-white p-4 text-sm text-navy-500">
              {t('Retrouvez toutes nos familles de produits dans le catalogue.')}
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
          title={t('Promotions en cours')}
          subtitle={t('Prix réduits pendant la période annoncée, dans la limite du stock disponible.')}
          href="/catalogue?promo=1"
          products={promos}
          seeAll={t('Tout voir')}
        />
      ) : null}

      {bestSellers.length > 0 ? (
        <Section
          title={t('Meilleures ventes')}
          subtitle={t('Les références les plus commandées par nos clients, encore disponibles.')}
          href="/catalogue"
          products={bestSellers}
          seeAll={t('Tout voir')}
        />
      ) : null}

      {featured.length > 0 ? (
        <Section
          title={t('Sélection MeDi Shop')}
          subtitle={t('Les références mises en avant par la boutique, disponibles immédiatement.')}
          href="/catalogue"
          products={featured}
          seeAll={t('Tout voir')}
        />
      ) : null}

      <Section
        title={t('Nouveautés')}
        subtitle={t('Dernières références ajoutées au catalogue.')}
        href="/catalogue?sort=newest"
        products={latest}
        seeAll={t('Tout voir')}
        emptyLabel={t('Aucune nouveauté à afficher pour le moment.')}
      />

      {/* MARQUES */}
      {data.brandList.length > 0 ? (
        <section className="border-y border-navy-100 bg-white py-8">
          <div className="container-page">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{t('Marques disponibles')}</h2>
            <p className="mt-1 text-sm text-navy-600">
              {t('Des équipements de marques reconnues, avec facture et garantie fabricant.')}
            </p>
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
              <Store className="size-5 text-accent-600" aria-hidden /> {t('À Daloa')}
            </h2>
            <p className="mt-2 text-sm text-navy-600">
              {t('Retrait gratuit en boutique (colis gardé {hours} h maximum) ou livraison dans votre quartier : {count} quartiers de Daloa sont proposés à la commande.', {
                hours: PICKUP_HOLD_HOURS,
                count: DALOA_NEIGHBOURHOOD_COUNT,
              })}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <Link href="/livraison" className="inline-flex items-center gap-1 text-sm font-semibold text-accent-700 hover:underline">
                {t('Voir les quartiers et les frais')} <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
              </Link>
              <Link
                href="/nous-trouver"
                className="inline-flex items-center gap-1 text-sm font-semibold text-accent-700 hover:underline"
              >
                {t('Plan et itinéraire')} <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-navy-100 bg-white p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Truck className="size-5 text-accent-600" aria-hidden /> {t('Reste de la Côte d’Ivoire')}
            </h2>
            <p className="mt-2 text-sm text-navy-600">
              {t('Livraison sous {days} jours maximum selon la ville. Le prix du transport se discute sur WhatsApp : nous ne prenons aucun frais caché et le paiement des articles précède l’expédition.', {
                days: OUTSIDE_DALOA_MAX_DAYS,
              })}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline"
                >
                  {t('Demander le prix du transport sur WhatsApp')} <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
                </a>
              ) : null}
              <Link
                href="/livraison#faq-livraison"
                className="inline-flex items-center gap-1 text-sm font-semibold text-accent-700 hover:underline"
              >
                {t('FAQ livraisons')} <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 rounded-xl border border-navy-100 bg-navy-50 p-4 sm:grid-cols-3">
          <div className="flex items-start gap-2 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            <p>
              <strong>{t('Stock vérifié')}</strong>
              <br />
              <span className="text-navy-600">{t('Le stock est contrôlé avant chaque validation de commande.')}</span>
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            <p>
              <strong>{t('Prix en FCFA')}</strong>
              <br />
              <span className="text-navy-600">{t('Le montant facturé est celui de la boutique, vérifié à chaque commande.')}</span>
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            <p>
              <strong>{t('Jours et heures de livraison')}</strong>
              <br />
              <span className="text-navy-600">
                {settings.openingHours ?? t('Horaires communiqués par téléphone')}
              </span>
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-accent-300 bg-accent-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-navy-900">{t(FINAL_SALE_NOTICE_SHORT)}</p>
          <Link href="/retours" className="shrink-0 text-sm font-bold text-accent-800 underline">
            {t('En savoir plus')}
          </Link>
        </div>

        <div className="mt-4 rounded-xl border border-navy-100 bg-white p-4">
          <p className="flex items-start gap-2 text-sm text-navy-800">
            <MapPin className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
            <span>
              <strong>{t('Boutique MeDi Shop')}</strong> — {location.city},{' '}
              <span className="ltr-inline font-mono" dir="ltr">
                {location.dms}
              </span>
              .{' '}
              <a href={location.mapsUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-accent-700 underline">
                {t('Voir sur Google Maps')}
              </a>
            </span>
          </p>
        </div>
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
  seeAll,
}: {
  title: string;
  subtitle: string;
  href: string;
  products: ProductCard[];
  emptyLabel?: string;
  seeAll: string;
}) {
  return (
    <section className="container-page py-8">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-navy-600">{subtitle}</p>
        </div>
        <Link href={href} className="shrink-0 text-sm font-semibold text-accent-700 hover:underline">
          {seeAll}
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
