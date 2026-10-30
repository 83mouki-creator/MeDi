import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, CheckCircle2, ChevronRight, MapPin, Package, ShieldCheck, Store, Truck } from 'lucide-react';
import { getProductBySlug, getRelatedProducts } from '@/lib/catalog';
import { getStoreSettings, whatsappLink } from '@/lib/settings';
import { computeAvailability, computePricing } from '@/lib/pricing';
import { formatFCFA, toFcfa } from '@/lib/utils';
import { env } from '@/lib/env';
import { Badge, Card } from '@/components/ui/primitives';
import { AddToCart, ProductGallery, ShareButtons } from '@/components/product-detail-client';
import { ProductRail } from '@/components/product-card';
import { RecentlyViewed } from '@/components/recently-viewed';
import { TrackProductView } from '@/components/track-view';
import { ButtonLink } from '@/components/ui/button';

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
    `${product.name}${brandSuffix} disponible chez MeDi à Daloa. ${formatFCFA(pricing.price)}.`;

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
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductBySlug(slug), getStoreSettings()]);
  if (!product || !product.isActive || product.isArchived) notFound();

  const pricing = computePricing(product);
  const availability = computeAvailability(product, settings.lowStockThreshold);
  const related = await getRelatedProducts(
    { id: product.id, categoryId: product.categoryId, brandId: product.brandId },
    8,
  ).catch(() => []);

  const images = product.images.length > 0 ? product.images : product.imageUrl ? [{ id: 'main', url: product.imageUrl, alt: product.imageAlt, width: product.imageWidth, height: product.imageHeight }] : [];
  const productUrl = `${env.appUrl.replace(/\/$/, '')}/produit/${product.slug}`;
  const whatsapp = whatsappLink(settings, `Bonjour MeDi, je souhaite des informations sur « ${product.name} » (réf. ${product.sku}).`);

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

      <nav aria-label="Fil d'Ariane" className="mb-4 flex flex-wrap items-center gap-1 text-xs text-navy-500">
        <Link href="/" className="hover:text-accent-700">Accueil</Link>
        <ChevronRight className="size-3" aria-hidden />
        <Link href="/catalogue" className="hover:text-accent-700">Catalogue</Link>
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
          <ProductGallery
            images={images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, width: i.width, height: i.height }))}
            name={product.name}
            discountPercent={pricing.discountPercent}
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            {product.brandSlug ? (
              <Link href={`/catalogue?brand=${product.brandSlug}`} className="text-xs font-bold uppercase tracking-wide text-accent-700 hover:underline">
                {product.brandName}
              </Link>
            ) : null}
            {product.onPromo ? <Badge tone="accent">Promotion</Badge> : null}
            {product.isFeatured ? <Badge tone="navy">Sélection MeDi</Badge> : null}
          </div>

          <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{product.name}</h1>
          <p className="mt-1 text-xs text-navy-500">
            Réf. <span className="font-mono font-semibold text-navy-700">{product.sku}</span>
            {product.categoryName ? <> · {product.categoryName}</> : null}
            {product.supplierName ? <> · Fournisseur : {product.supplierName}</> : null}
          </p>

          {product.shortDescription ? <p className="mt-3 text-sm leading-relaxed text-navy-700">{product.shortDescription}</p> : null}

          <div className="mt-4 rounded-xl border border-navy-100 bg-white p-4">
            <div className="flex flex-wrap items-end gap-2">
              <span className="text-3xl font-extrabold text-navy-950">{formatFCFA(pricing.price)}</span>
              {product.onPromo ? (
                <>
                  <span className="text-base text-navy-400 line-through">{formatFCFA(pricing.basePrice)}</span>
                  <Badge tone="accent">Économisez {formatFCFA(pricing.savings)}</Badge>
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
                ? 'Épuisé — indisponible actuellement'
                : availability.state === 'PREORDER'
                  ? 'Disponible en précommande'
                  : `${availability.label} — expédition sous 24 h ouvrées après paiement`}
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

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                <Store className="size-4 text-accent-600" aria-hidden /> Retrait en boutique
              </p>
              <p className="mt-1 text-xs leading-relaxed text-navy-600">
                {settings.addressLine ? `${settings.addressLine}, ${settings.city}` : `Boutique à ${settings.city} — adresse à confirmer`}
                {settings.openingHours ? ` · ${settings.openingHours}` : ''}
              </p>
            </Card>
            <Card className="p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                <Truck className="size-4 text-accent-600" aria-hidden /> Livraison & expédition
              </p>
              <p className="mt-1 text-xs leading-relaxed text-navy-600">
                Livraison à Daloa selon la zone. Hors Daloa : paiement confirmé avant expédition par car ou transporteur.
              </p>
              <Link href="/livraison" className="mt-1 inline-block text-xs font-semibold text-accent-700 hover:underline">
                En savoir plus
              </Link>
            </Card>
          </div>

          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline"
            >
              Poser une question sur WhatsApp <ArrowRight className="size-4" aria-hidden />
            </a>
          ) : null}

          {product.warranty ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-navy-600">
              <ShieldCheck className="size-4 text-navy-400" aria-hidden /> Garantie : {product.warranty}
            </p>
          ) : null}
        </div>
      </div>

      {/* Description & caractéristiques */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="description-title">
          <h2 id="description-title" className="mb-2 text-lg font-bold">Description</h2>
          <div className="prose-sm max-w-none whitespace-pre-line text-sm leading-relaxed text-navy-700">
            {product.description || product.shortDescription || 'Photo et description complètes disponibles sur demande via WhatsApp.'}
          </div>
        </section>

        <section aria-labelledby="attributes-title">
          <h2 id="attributes-title" className="mb-2 text-lg font-bold">Caractéristiques techniques</h2>
          {product.attributes.length > 0 ? (
            <dl className="divide-y divide-navy-100 rounded-xl border border-navy-100 bg-white">
              {product.attributes.map((attribute) => (
                <div key={attribute.name} className="grid grid-cols-[45%_1fr] gap-2 px-4 py-2.5 text-sm">
                  <dt className="text-navy-500">{attribute.name}</dt>
                  <dd className="font-medium text-navy-900">{attribute.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-navy-500">
              Les caractéristiques détaillées de cet article vous sont communiquées sur demande via WhatsApp.
            </p>
          )}
        </section>
      </div>

      <section className="mt-10 rounded-xl border border-navy-100 bg-white p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy-900">
          <MapPin className="size-4 text-accent-600" aria-hidden /> Conditions de retrait et de livraison
        </h2>
        <ul className="grid gap-2 text-sm text-navy-700 sm:grid-cols-2">
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> Retrait en boutique à Daloa, gratuit, après confirmation de la commande.</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> Livraison à domicile dans les zones desservies ; frais affichés au moment de la commande.</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> Hors Daloa : prépaiement intégral, expédition par car ou transporteur.</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> Le stock affiché est mis à jour en temps réel au moment de la réservation.</li>
        </ul>
      </section>

      {related.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold">Produits similaires</h2>
          <ProductRail products={related.slice(0, 4)} />
        </section>
      ) : null}

      <RecentlyViewed excludeId={product.id} />

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/catalogue" variant="outline">Retour au catalogue</ButtonLink>
        <ButtonLink href="/suivi" variant="ghost">Suivre une commande</ButtonLink>
      </div>
    </div>
  );
}
