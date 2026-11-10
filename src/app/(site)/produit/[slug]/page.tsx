import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  MessageCircle,
  Package,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import { getProductBySlug, getRelatedProducts } from '@/lib/catalog';
import { getStoreSettings, whatsappLink } from '@/lib/settings';
import { computeAvailability, computePricing } from '@/lib/pricing';
import { formatFCFA } from '@/lib/utils';
import { env } from '@/lib/env';
import { Badge, Card } from '@/components/ui/primitives';
import { AddToCart, MobileBuyBar, ProductGallery, ShareButtons } from '@/components/product-detail-client';
import { ProductRail } from '@/components/product-card';
import { RecentlyViewed } from '@/components/recently-viewed';
import { TrackProductView } from '@/components/track-view';
import { ButtonLink } from '@/components/ui/button';
import { PurchaseNotice } from '@/components/purchase-notice';
import { getSiteI18n } from '@/lib/i18n/site-server';
import { OUTSIDE_DALOA_MAX_DAYS } from '@/lib/store-policy';
import { ProductStickerList, ProductStickerOverlay } from '@/components/product-sticker';
import { STORE_NAME, WHATSAPP_MESSAGES } from '@/lib/brand';
import { sweepExpiredReservations } from '@/lib/reservations';

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug).catch(() => null);
  if (!product) return { title: 'Produit introuvable' };

  const pricing = computePricing(product);
  // Certaines références portent déjà la marque dans leur nom : on ne l'ajoute pas deux fois.
  const brandSuffix =
    product.brandName && !product.name.toLowerCase().includes(product.brandName.toLowerCase())
      ? ` — ${product.brandName}`
      : '';
  const description =
    product.shortDescription ??
    `${product.name}${brandSuffix} disponible chez ${STORE_NAME}. ${formatFCFA(pricing.price)}.`;

  return {
    title: `${product.name}${brandSuffix}`,
    description: description.slice(0, 300),
    alternates: { canonical: `/produit/${product.slug}` },
    openGraph: {
      type: 'website',
      title: product.name,
      description: description.slice(0, 300),
      images: product.imageUrl ? [product.imageUrl] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  // Avant d'afficher une disponibilité, on rend à la vente les réservations expirées.
  await sweepExpiredReservations();
  const { slug } = await params;
  const [product, settings, { t }] = await Promise.all([getProductBySlug(slug), getStoreSettings(), getSiteI18n()]);
  if (!product || !product.isActive || product.isArchived) notFound();

  const pricing = computePricing(product);
  const availability = computeAvailability(product, settings.lowStockThreshold);
  const related = await getRelatedProducts(
    { id: product.id, categoryId: product.categoryId, brandId: product.brandId },
    8,
  ).catch(() => []);

  const images = product.images.length > 0 ? product.images : product.imageUrl ? [{ id: 'main', url: product.imageUrl, alt: product.imageAlt, width: product.imageWidth, height: product.imageHeight }] : [];
  const productUrl = `${env.appUrl.replace(/\/$/, '')}/produit/${product.slug}`;
  // Message prérempli et contextualisé : la boutique sait immédiatement de quel
  // article il s'agit, et le client n'a rien à recopier.
  const whatsapp = whatsappLink(
    settings,
    `${WHATSAPP_MESSAGES.product} « ${product.name} » (réf. ${product.sku}) — ${productUrl}`,
  );
  const visibleStickers = product.stickers ?? [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku,
    description: product.shortDescription ?? product.description ?? product.name,
    image: images.map((image) => (image.url.startsWith('http') ? image.url : `${env.appUrl.replace(/\/$/, '')}${image.url}`)),
    brand: product.brandName ? { '@type': 'Brand', name: product.brandName } : undefined,
    category: product.categoryName ?? undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'XOF',
      price: pricing.price,
      availability:
        availability.state === 'OUT_OF_STOCK' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      url: productUrl,
      seller: { '@type': 'Organization', name: settings.storeName },
    },
  };

  return (
    <div className="container-page py-5">
      <TrackProductView productId={product.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label={t('Fil d’Ariane')} className="mb-4 flex flex-wrap items-center gap-1 text-xs text-navy-500">
        <Link href="/" className="hover:text-accent-700">{t('Accueil')}</Link>
        <ChevronRight className="size-3" aria-hidden />
        <Link href="/catalogue" className="hover:text-accent-700">{t('Catalogue')}</Link>
        {product.categorySlug ? (
          <>
            <ChevronRight className="size-3" aria-hidden />
            <Link href={`/categorie/${product.categorySlug}`} className="hover:text-accent-700">{product.categoryName}</Link>
          </>
        ) : null}
        <ChevronRight className="size-3" aria-hidden />
        <span className="line-clamp-1 font-medium text-navy-800">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,520px)_1fr]">
        <div className="lg:sticky lg:top-40 lg:self-start">
          <div className="relative">
            <ProductGallery
              images={images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, width: i.width, height: i.height }))}
              name={product.name}
              discountPercent={pricing.discountPercent}
            />
            {/* Garantie, réduction… : les deux vignettes choisies par la boutique. */}
            <ProductStickerOverlay stickers={visibleStickers} className="inset-x-3 bottom-3" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-navy-700">
            <div className="rounded-lg border border-navy-100 bg-white px-2 py-3">
              <ShieldCheck className="mx-auto mb-1 size-4 text-accent-600" aria-hidden />
              {t('Stock vérifié')}
            </div>
            <div className="rounded-lg border border-navy-100 bg-white px-2 py-3">
              <Truck className="mx-auto mb-1 size-4 text-accent-600" aria-hidden />
              {t('Livraison à domicile')}
            </div>
            <div className="rounded-lg border border-navy-100 bg-white px-2 py-3">
              <Clock className="mx-auto mb-1 size-4 text-accent-600" aria-hidden />
              {t('Livraison 7 j max')}
            </div>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            {product.brandSlug ? (
              <Link href={`/catalogue?brand=${product.brandSlug}`} className="text-xs font-bold uppercase tracking-wide text-accent-700 hover:underline">
                {product.brandName}
              </Link>
            ) : null}
            {product.onPromo ? <Badge tone="accent">{t('Promotion')}</Badge> : null}
            {product.isFeatured ? <Badge tone="navy">{t('Sélection {store}', { store: settings.storeName })}</Badge> : null}
          </div>

          <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{product.name}</h1>
          <p className="mt-1 text-xs text-navy-500">
            {t('Réf.')} <span className="font-mono font-semibold text-navy-700">{product.sku}</span>
            {product.categoryName ? <> · {product.categoryName}</> : null}
            {product.supplierName ? <> · {t('Fournisseur')} : {product.supplierName}</> : null}
          </p>

          {visibleStickers.length > 0 ? (
            <div className="mt-3">
              <ProductStickerList stickers={visibleStickers} />
            </div>
          ) : null}

          {product.shortDescription ? <p className="mt-3 text-sm leading-relaxed text-navy-700">{product.shortDescription}</p> : null}

          {/* Prix : bloc mis en avant */}
          <div className="mt-4 overflow-hidden rounded-xl border border-accent-300 bg-gradient-to-br from-accent-50 to-white">
            <div className="p-4">
              <div className="flex flex-wrap items-end gap-2">
                <span className="text-3xl font-extrabold text-navy-950 sm:text-4xl">{formatFCFA(pricing.price)}</span>
                {product.onPromo ? (
                  <>
                    <span className="text-base text-navy-400 line-through">{formatFCFA(pricing.basePrice)}</span>
                    <span className="rounded-md bg-accent-500 px-2 py-0.5 text-xs font-bold text-navy-950">
                      {t('Économisez {amount}', { amount: formatFCFA(pricing.savings) })}
                    </span>
                  </>
                ) : null}
              </div>

              <p
                className={
                  availability.state === 'OUT_OF_STOCK'
                    ? 'mt-2 flex items-center gap-1.5 text-sm font-semibold text-danger-500'
                    : availability.state === 'LOW_STOCK'
                      ? 'mt-2 flex items-center gap-1.5 text-sm font-semibold text-warning-500'
                      : 'mt-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700'
                }
              >
                <Package className="size-4" aria-hidden />
                {availability.state === 'OUT_OF_STOCK'
                  ? t('Épuisé — indisponible actuellement')
                  : availability.state === 'PREORDER'
                    ? t('Disponible en précommande')
                    : availability.state === 'LOW_STOCK'
                      ? t('Plus que {count} en stock — livraison à domicile', { count: availability.available })
                      : t('En stock — livraison à domicile')}
              </p>

              <div className="mt-4">
                <AddToCart
                  productId={product.id}
                  available={availability.available}
                  canOrder={availability.canOrder}
                  availabilityState={availability.state}
                />
              </div>

              <div className="mt-4">
                <ShareButtons name={product.name} url={productUrl} price={pricing.price} />
              </div>
            </div>
          </div>

          {/* Livraison : le seul mode proposé par la boutique */}
          <Card className="mt-4 border-accent-200 bg-accent-50/40 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
              <Truck className="size-4 text-accent-600" aria-hidden /> {t('Livraison à domicile')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-navy-700">
              {t('À Daloa : vous choisissez votre quartier, les frais s’affichent avant la validation. Hors Daloa : {days} jours maximum, transport à convenir sur WhatsApp.', {
                days: OUTSIDE_DALOA_MAX_DAYS,
              })}
            </p>
            {settings.openingHours ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-navy-600">
                <Clock className="size-3.5 shrink-0" aria-hidden /> {settings.openingHours}
              </p>
            ) : null}
            <Link href="/livraison" className="mt-1 inline-block text-xs font-semibold text-accent-700 hover:underline">
              {t('Voir les zones et les frais de livraison')}
            </Link>
          </Card>

          <PurchaseNotice className="mt-3" phone={settings.phone} />

          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <MessageCircle className="size-4" aria-hidden /> {t('Poser une question sur WhatsApp')}
            </a>
          ) : null}

          {product.warranty ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-navy-600">
              <ShieldCheck className="size-4 text-navy-400" aria-hidden /> {t('Garantie :')} {product.warranty}
            </p>
          ) : null}
        </div>
      </div>

      {/* Description & caractéristiques */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="description-title" className="rounded-xl border border-navy-100 bg-white p-4">
          <h2 id="description-title" className="mb-2 flex items-center gap-2 text-lg font-bold">
            <Sparkles className="size-4 text-accent-600" aria-hidden /> {t('Description')}
          </h2>
          <div className="prose-sm max-w-none whitespace-pre-line text-sm leading-relaxed text-navy-700">
            {product.description || product.shortDescription || t('Photo et description complètes disponibles sur demande via WhatsApp.')}
          </div>
        </section>

        <section aria-labelledby="attributes-title" className="rounded-xl border border-navy-100 bg-white p-4">
          <h2 id="attributes-title" className="mb-2 text-lg font-bold">{t('Caractéristiques techniques')}</h2>
          {product.attributes.length > 0 ? (
            <dl className="divide-y divide-navy-100">
              {product.attributes.map((attribute) => (
                <div key={attribute.name} className="grid grid-cols-[45%_1fr] gap-2 py-2.5 text-sm">
                  <dt className="text-navy-500">{attribute.name}</dt>
                  <dd className="font-medium text-navy-900">{attribute.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-navy-500">
              {t('Les caractéristiques détaillées de cet article vous sont communiquées sur demande via WhatsApp.')}
            </p>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-navy-100 bg-white p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy-900">
          <CalendarClock className="size-4 text-accent-600" aria-hidden /> {t('Jours et heures de livraison')}
        </h2>
        <ul className="grid gap-2 text-sm text-navy-700 sm:grid-cols-2">
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            {t('Livraison dans votre commune ou votre quartier : frais affichés avant validation de la commande.')}
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            {t('Hors Daloa : {days} jours maximum selon la ville, transport à convenir sur WhatsApp.', { days: OUTSIDE_DALOA_MAX_DAYS })}
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            {t('Le stock affiché est mis à jour en temps réel au moment de la réservation.')}
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            {t('Une question avant de commander ? Écrivez-nous sur WhatsApp, nous répondons aux heures d’ouverture.')}
          </li>
        </ul>
      </section>

      {related.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold">{t('Produits similaires')}</h2>
          <ProductRail products={related.slice(0, 4)} />
        </section>
      ) : null}

      <RecentlyViewed excludeId={product.id} />

      {/*
        Sur téléphone, le prix et l'achat restent visibles en bas de l'écran.
        Une marge basse évite que la barre ne recouvre la fin de la page.
      */}
      <div className="h-20 lg:hidden" aria-hidden />
      <MobileBuyBar
        productId={product.id}
        available={availability.available}
        canOrder={availability.canOrder}
        availabilityState={availability.state}
        priceLabel={formatFCFA(pricing.price)}
        basePriceLabel={product.onPromo ? formatFCFA(pricing.basePrice) : null}
        discountPercent={pricing.discountPercent}
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/catalogue" variant="outline">{t('Retour au catalogue')}</ButtonLink>
        <ButtonLink href="/suivi" variant="ghost">{t('Suivre une commande')}</ButtonLink>
        <Link href="/livraison" className="inline-flex items-center gap-1 self-center text-sm font-semibold text-accent-700 hover:underline">
          {t('Livraison et frais')} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
