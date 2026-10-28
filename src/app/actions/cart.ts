'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { readCart, writeCart, getCartSummary } from '@/lib/cart';
import { rateLimit } from '@/lib/rate-limit';

export type CartActionState = { ok: boolean; message: string };

/** Ajoute un produit au panier en vérifiant le stock côté serveur. */
export async function addToCartAction(_prev: CartActionState, formData: FormData): Promise<CartActionState> {
  const productId = String(formData.get('productId') ?? '');
  const quantity = Math.min(999, Math.max(1, Number(formData.get('quantity') ?? 1) || 1));
  const buyNow = formData.get('buyNow') === '1';

  if (!productId) return { ok: false, message: 'Produit introuvable.' };

  const limit = rateLimit(`cart:add:${productId}`, 30, 60);
  if (!limit.allowed) return { ok: false, message: 'Trop d’ajouts successifs. Patientez un instant.' };

  const lines = await readCart();

  // Vérifie la disponibilité réelle avant d'écrire le panier.
  const check = await getCartSummary([{ productId, quantity }]);
  const line = check.lines[0];
  if (!line) return { ok: false, message: 'Ce produit n’est plus disponible.' };
  if (line.availability === 'OUT_OF_STOCK') return { ok: false, message: 'Ce produit est épuisé.' };

  const existing = lines.find((l) => l.productId === productId);
  const nextQuantity = Math.min(999, (existing?.quantity ?? 0) + quantity);

  if (line.availability !== 'PREORDER' && nextQuantity > line.available) {
    return {
      ok: false,
      message: `Stock insuffisant : ${line.available} unité(s) disponible(s) pour « ${line.name} ».`,
    };
  }

  const next = existing
    ? lines.map((l) => (l.productId === productId ? { ...l, quantity: nextQuantity } : l))
    : [...lines, { productId, quantity }];

  await writeCart(next);
  revalidatePath('/panier');
  revalidatePath('/');

  if (buyNow) redirect('/commande');

  return { ok: true, message: `« ${line.name} » ajouté au panier.` };
}

export async function updateCartQuantityAction(formData: FormData) {
  const productId = String(formData.get('productId') ?? '');
  const quantity = Math.max(0, Math.min(999, Number(formData.get('quantity') ?? 0) || 0));
  const lines = await readCart();

  const next = quantity === 0
    ? lines.filter((l) => l.productId !== productId)
    : lines.map((l) => (l.productId === productId ? { ...l, quantity } : l));

  await writeCart(next);
  revalidatePath('/panier');
}

export async function removeFromCartAction(formData: FormData) {
  const productId = String(formData.get('productId') ?? '');
  const lines = await readCart();
  await writeCart(lines.filter((l) => l.productId !== productId));
  revalidatePath('/panier');
}

export async function clearCartAction() {
  await writeCart([]);
  revalidatePath('/panier');
}
