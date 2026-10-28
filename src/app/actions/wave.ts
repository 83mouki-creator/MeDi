'use server';

import { redirect } from 'next/navigation';
import { startWaveCheckout } from '@/lib/wave-checkout';

/** Relance une session de paiement Wave pour une commande en attente. */
export async function startWavePaymentAction(formData: FormData) {
  const orderId = String(formData.get('orderId') ?? '');
  if (!orderId) redirect('/panier');

  const result = await startWaveCheckout(orderId);
  if (result.ok) redirect(result.url);

  // Le service n'est pas disponible : on revient sur la page avec un message.
  const target = String(formData.get('returnTo') ?? '/');
  redirect(`${target}${target.includes('?') ? '&' : '?'}wave=unavailable`);
}
