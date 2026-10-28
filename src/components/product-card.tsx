import Link from 'next/link';
import Image from 'next/image';
import { ImageOff, ShoppingCart } from 'lucide-react';
import { cn, formatFCFA, toFcfa, truncate } from '@/lib/utils';
import { computeAvailability } from '@/lib/pricing';
import type { ProductCard as ProductCardType } from '@/lib/catalog';
import { Badge } from './ui/primitives';

/** Vignette produit — mobile-first, image optimisée, prix toujours visible. */
export function ProductCardView({ product, className }: { product: ProductCardType; className?: string }) {
  const availability = computeAvailability(product, 5);
  const price = toFcfa(product.effectivePrice);
  const base = toFcfa(product.price);

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-xl border border-navy-100 bg-white transition-shadow hover:shadow-[var(--shadow-card)] focus-within:ring-2 focus-within:ring-accent-400',
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-navy-50">
        <Link href={`/produit/${product.slug}`} className="block size-full" tabIndex={-1} aria-hidden="true">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.imageAlt ?? product.name}
              width={product.imageWidth ?? 600}
              height={product.imageHeight ?? 600}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-navy-300">
              <ImageOff aria-hidden className="size-8" />
              <span className="px-2 text-center text-[11px] font-medium text-navy-400">Photo à venir</span>
            </div>
          )}
        </Link>

        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          {product.onPromo ? (
            <span className="rounded-md bg-accent-500 px-1.5 py-0.5 text-[11px] font-bold text-white">-{product.discountPercent}%</span>
          ) : (
            <span />
          )}
          {availability.state === 'OUT_OF_STOCK' ? (
            <span className="rounded-md bg-navy-900/90 px-1.5 py-0.5 text-[11px] font-semibold text-white">Épuisé</span>
          ) : availability.state === 'LOW_STOCK' ? (
            <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">Stock faible</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        {product.brandName ? (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-400">{product.brandName}</p>
        ) : null}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-navy-900">
          <Link href={`/produit/${product.slug}`} className="after:absolute after:inset-0 after:content-['']">
            {product.name}
          </Link>
        </h3>
        {product.shortDescription ? (
          <p className="line-clamp-2 text-xs text-navy-500">{truncate(product.shortDescription, 90)}</p>
        ) : null}

        <div className="mt-auto pt-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-base font-extrabold text-navy-950">{formatFCFA(price)}</span>
            {product.onPromo ? (
              <span className="text-xs text-navy-400 line-through">{formatFCFA(base)}</span>
            ) : null}
          </div>
          {availability.state === 'OUT_OF_STOCK' ? (
            <p className="mt-1 text-xs font-medium text-danger-500">Indisponible</p>
          ) : availability.state === 'PREORDER' ? (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-navy-500">
              <ShoppingCart aria-hidden className="size-3.5" /> Précommande
            </p>
          ) : (
            <p className="mt-1 text-xs text-navy-500">{availability.label}</p>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-navy-100 bg-white">
      <div className="aspect-square animate-pulse bg-navy-100" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-1/3 animate-pulse rounded bg-navy-100" />
        <div className="h-4 w-full animate-pulse rounded bg-navy-100" />
        <div className="h-5 w-1/2 animate-pulse rounded bg-navy-100" />
      </div>
    </div>
  );
}

export function ProductGrid({ products }: { products: ProductCardType[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCardView key={product.id} product={product} />
      ))}
    </div>
  );
}

export function ProductRail({ products }: { products: ProductCardType[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCardView key={product.id} product={product} className="w-[46%] shrink-0 snap-start sm:w-auto" />
      ))}
    </div>
  );
}

export function PriceTag({ price, promoPrice, size = 'md' }: { price: string | number; promoPrice?: string | number | null; size?: 'sm' | 'md' | 'lg' }) {
  const base = toFcfa(price);
  const promo = promoPrice === null || promoPrice === undefined ? null : toFcfa(promoPrice);
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span
        className={cn(
          'font-extrabold text-navy-950',
          size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-sm' : 'text-xl',
        )}
      >
        {formatFCFA(promo && promo > 0 && promo < base ? promo : base)}
      </span>
      {promo && promo > 0 && promo < base ? (
        <>
          <span className="text-sm text-navy-400 line-through">{formatFCFA(base)}</span>
          <Badge tone="accent">-{Math.round(((base - promo) / base) * 100)}%</Badge>
        </>
      ) : null}
    </div>
  );
}
