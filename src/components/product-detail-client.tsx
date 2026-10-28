'use client';

import { useActionState, useEffect, useState } from 'react';
import Image from 'next/image';
import { Check, Copy, Link2, Loader2, MessageCircle, Minus, Plus, Share2, ShoppingCart, Zap } from 'lucide-react';
import { addToCartAction, type CartActionState } from '@/app/actions/cart';
import { Button } from './ui/button';
import { cn, formatFCFA } from '@/lib/utils';

// ────────────────────────────── Galerie ──────────────────────────────

export function ProductGallery({
  images,
  name,
  discountPercent,
}: {
  images: { id: string; url: string; alt: string | null; width: number | null; height: number | null }[];
  name: string;
  discountPercent: number;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-xl border border-navy-100 bg-white">
        {active ? (
          <Image
            src={active.url}
            alt={active.alt ?? name}
            width={active.width ?? 900}
            height={active.height ?? 900}
            sizes="(max-width: 1024px) 100vw, 520px"
            priority
            className="size-full object-contain"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-navy-400">Photo à venir</div>
        )}
        {discountPercent > 0 ? (
          <span className="absolute left-3 top-3 rounded-md bg-accent-500 px-2 py-1 text-xs font-bold text-white">
            -{discountPercent}%
          </span>
        ) : null}
      </div>

      {images.length > 1 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Photos du produit">
          {images.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Voir la photo ${index + 1}`}
                aria-pressed={index === activeIndex}
                className={cn(
                  'size-16 overflow-hidden rounded-lg border-2 bg-white',
                  index === activeIndex ? 'border-accent-500' : 'border-navy-100 hover:border-navy-300',
                )}
              >
                <Image src={image.url} alt="" width={128} height={128} className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ────────────────────────────── Ajout au panier ──────────────────────────────

const initialState: CartActionState = { ok: true, message: '' };

export function AddToCart({
  productId,
  available,
  canOrder,
  availabilityState,
}: {
  productId: string;
  available: number;
  canOrder: boolean;
  availabilityState: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'PREORDER';
}) {
  const [quantity, setQuantity] = useState(1);
  const [state, formAction, pending] = useActionState(addToCartAction, initialState);

  const max = availabilityState === 'PREORDER' ? 99 : Math.max(1, available);

  useEffect(() => {
    if (quantity > max) setQuantity(max);
  }, [max, quantity]);

  if (!canOrder) {
    return (
      <div className="rounded-lg border border-navy-200 bg-navy-50 p-3 text-sm text-navy-700">
        Ce produit est actuellement épuisé. Contactez la boutique pour connaître la prochaine disponibilité.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="quantity" value={quantity} />

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-navy-700">Quantité</span>
        <div className="flex items-center rounded-lg border border-navy-200">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="grid size-11 place-items-center text-navy-700 hover:bg-navy-50 disabled:opacity-40"
            disabled={quantity <= 1}
            aria-label="Diminuer la quantité"
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <output className="w-10 text-center text-sm font-semibold" aria-live="polite">
            {quantity}
          </output>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(max, q + 1))}
            className="grid size-11 place-items-center text-navy-700 hover:bg-navy-50 disabled:opacity-40"
            disabled={quantity >= max}
            aria-label="Augmenter la quantité"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
        {availabilityState !== 'PREORDER' ? (
          <span className="text-xs text-navy-500">{available} disponible(s)</span>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="submit" size="lg" name="buyNow" value="0" loading={pending && !state.message}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShoppingCart className="size-4" aria-hidden />}
          Ajouter au panier
        </Button>
        <Button type="submit" size="lg" variant="secondary" name="buyNow" value="1">
          <Zap className="size-4" aria-hidden /> Commander maintenant
        </Button>
      </div>

      {state.message ? (
        <p className={cn('text-sm font-medium', state.ok ? 'text-emerald-700' : 'text-danger-500')} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

// ────────────────────────────── Partage ──────────────────────────────

export function ShareButtons({ name, url, price }: { name: string; url: string; price: number }) {
  const [copied, setCopied] = useState(false);
  const message = `${name} — ${formatFCFA(price)} sur MeDi Daloa : ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible */
    }
  }

  async function nativeShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: name, text: message, url });
        return;
      } catch {
        /* partage annulé */
      }
    }
    await copy();
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-navy-400">Partager</span>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="grid size-9 place-items-center rounded-lg border border-navy-200 text-emerald-600 hover:bg-emerald-50"
        aria-label="Partager sur WhatsApp"
      >
        <MessageCircle className="size-4" aria-hidden />
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="grid size-9 place-items-center rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50"
        aria-label="Partager sur Facebook"
      >
        <Share2 className="size-4" aria-hidden />
      </a>
      <button
        type="button"
        onClick={nativeShare}
        className="grid size-9 place-items-center rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50"
        aria-label="Partager le lien"
      >
        <Link2 className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={copy}
        className="flex items-center gap-1 rounded-lg border border-navy-200 px-2 py-2 text-xs font-medium text-navy-700 hover:bg-navy-50"
      >
        {copied ? <Check className="size-4 text-emerald-600" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? 'Copié' : 'Copier le lien'}
      </button>
    </div>
  );
}
