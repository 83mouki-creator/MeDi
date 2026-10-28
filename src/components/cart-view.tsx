'use client';

import { useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { removeFromCartAction, updateCartQuantityAction } from '@/app/actions/cart';
import { formatFCFA } from '@/lib/utils';
import type { CartLine } from '@/lib/cart';

export function CartLineRow({ line }: { line: CartLine }) {
  const [pending, startTransition] = useTransition();

  function setQuantity(quantity: number) {
    const formData = new FormData();
    formData.set('productId', line.productId);
    formData.set('quantity', String(quantity));
    startTransition(() => {
      void updateCartQuantityAction(formData);
    });
  }

  function remove() {
    const formData = new FormData();
    formData.set('productId', line.productId);
    startTransition(() => {
      void removeFromCartAction(formData);
    });
  }

  return (
    <li className="flex gap-3 border-b border-navy-100 py-4 last:border-0">
      <Link href={`/produit/${line.slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-navy-100 bg-white sm:size-24">
        {line.imageUrl ? (
          <Image src={line.imageUrl} alt={line.name} width={192} height={192} className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-[10px] text-navy-400">Photo à venir</span>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/produit/${line.slug}`} className="line-clamp-2 text-sm font-semibold text-navy-900 hover:text-accent-700">
              {line.name}
            </Link>
            <p className="mt-0.5 text-xs text-navy-500">Réf. {line.sku}</p>
            <p className="mt-1 text-sm font-bold text-navy-950">
              {formatFCFA(line.unitPrice)}
              {line.onPromo ? <span className="ml-2 text-xs font-normal text-navy-400 line-through">{formatFCFA(line.basePrice)}</span> : null}
            </p>
          </div>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-navy-400 hover:bg-rose-50 hover:text-danger-500"
            aria-label={`Retirer ${line.name} du panier`}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>

        {line.issue ? <p className="mt-1 text-xs font-medium text-amber-700">{line.issue}</p> : null}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center rounded-lg border border-navy-200 bg-white">
            <button
              type="button"
              onClick={() => setQuantity(line.quantity - 1)}
              disabled={pending || line.quantity <= 1}
              className="grid size-9 place-items-center text-navy-700 hover:bg-navy-50 disabled:opacity-40"
              aria-label="Diminuer la quantité"
            >
              <Minus className="size-3.5" aria-hidden />
            </button>
            <span className="w-9 text-center text-sm font-semibold" aria-live="polite">{line.quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(line.quantity + 1)}
              disabled={pending || (line.availability !== 'PREORDER' && line.quantity >= line.available)}
              className="grid size-9 place-items-center text-navy-700 hover:bg-navy-50 disabled:opacity-40"
              aria-label="Augmenter la quantité"
            >
              <Plus className="size-3.5" aria-hidden />
            </button>
          </div>
          <p className="text-sm font-bold text-navy-950">{formatFCFA(line.lineTotal)}</p>
        </div>
      </div>
    </li>
  );
}
