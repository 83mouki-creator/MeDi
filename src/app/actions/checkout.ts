'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { checkoutSchema, fieldErrors } from '@/lib/validation';
import { createOrder, OrderError } from '@/lib/orders';
import { getCartSummary } from '@/lib/cart';
import { getCurrentUser, clientIpFrom } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { startWaveCheckout } from '@/lib/wave-checkout';

export type CheckoutState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  notice?: string;
};

function parseItems(raw: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(raw ?? '[]')) as { productId: string; quantity: number }[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Validation de commande. Les prix, frais et disponibilités sont recalculés
 * intégralement côté serveur ; le navigateur ne fournit que produits + quantités
 * et les informations de livraison.
 */
export async function placeOrderAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const h = await headers();
  const ip = clientIpFrom(h);

  const limit = rateLimit(`checkout:${ip ?? 'local'}`, 8, 60);
  if (!limit.allowed) {
    return { error: 'Trop de tentatives. Merci de patienter une minute avant de réessayer.' };
  }

  const raw = {
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    email: String(formData.get('email') ?? ''),
    deliveryMethod: String(formData.get('deliveryMethod') ?? ''),
    zoneId: String(formData.get('zoneId') ?? ''),
    city: String(formData.get('city') ?? ''),
    commune: String(formData.get('commune') ?? ''),
    addressLine: String(formData.get('addressLine') ?? ''),
    landmark: String(formData.get('landmark') ?? ''),
    carrier: String(formData.get('carrier') ?? ''),
    paymentMethod: String(formData.get('paymentMethod') ?? ''),
    customerNote: String(formData.get('customerNote') ?? ''),
    items: parseItems(formData.get('items')),
  };

  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: 'Certains champs nécessitent votre attention.',
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  // Le panier doit correspondre au stock au moment de la validation.
  const cart = await getCartSummary(parsed.data.items);
  if (cart.isEmpty) return { error: 'Votre panier est vide.' };
  if (cart.lines.some((line) => line.availability === 'OUT_OF_STOCK')) {
    return { error: 'Un produit de votre panier est épuisé. Mettez votre panier à jour.' };
  }

  const user = await getCurrentUser();

  try {
    const result = await createOrder({
      input: parsed.data,
      userId: user?.id ?? null,
      actor: user,
      ip,
    });

    const target = `/commande/${result.order.number}?t=${encodeURIComponent(result.order.accessToken)}`;

    // Paiement Wave automatique si configuré : redirection vers la page Wave.
    if (result.paymentMethod === 'WAVE') {
      const session = await startWaveCheckout(result.order.id);
      if (session.ok) redirect(session.url);
    }

    redirect(target);
  } catch (error) {
    if (error instanceof OrderError) {
      return { error: error.message };
    }
    // Next.js utilise des exceptions internes pour la redirection : ne pas les masquer.
    if (typeof error === 'object' && error !== null && 'digest' in error) throw error;
    console.error('[checkout] échec inattendu', error);
    return { error: 'Une erreur est survenue lors de la création de la commande. Merci de réessayer.' };
  }
}
