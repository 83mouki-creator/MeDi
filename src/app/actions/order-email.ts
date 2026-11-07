'use server';

import { headers } from 'next/headers';
import { clientIpFrom, getCurrentUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { emailStatus, isDeliverableAddress, sendEmail } from '@/lib/email';
import { buildOrderEmail } from '@/lib/order-mail';
import { getOrderByNumber } from '@/lib/orders';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Envoi du bon de commande par e-mail, à la demande du client.
 *
 * Le client peut être connecté (le bon part vers l'adresse de son compte) ou
 * simplement muni du lien de suivi (jeton de la commande) — c'est le même
 * niveau de preuve que la page de confirmation. Le contenu est reconstruit
 * depuis la base, jamais depuis le formulaire.
 */
export type EmailReceiptState = { ok?: boolean; to?: string; error?: string };

export async function emailOrderReceiptAction(_prev: EmailReceiptState, formData: FormData): Promise<EmailReceiptState> {
  const number = String(formData.get('number') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  if (!number) return { error: 'Commande introuvable.' };

  if (!emailStatus().configured) {
    return { error: 'Le service d’e-mail n’est pas encore activé. Demandez le bon à la boutique par WhatsApp.' };
  }

  const h = await headers();
  const ip = clientIpFrom(h);
  // Trois demandes par tranche de dix minutes : de quoi se tromper d'adresse
  // sans permettre d'inonder une boîte.
  const limit = rateLimit(`email-receipt:${ip ?? 'local'}`, 3, 600);
  if (!limit.allowed) return { error: 'Trop de demandes d’envoi. Réessayez dans quelques minutes.' };

  const order = await getOrderByNumber(number);
  if (!order) return { error: 'Commande introuvable.' };

  const user = await getCurrentUser();
  const owner = Boolean(user && order.userId === user.id);
  const authorised = owner || Boolean(token && token === order.accessToken);
  if (!authorised) return { error: 'Accès à cette commande protégé.' };

  // Adresse de destination : celle du compte si le client est connecté, sinon
  // celle saisie au moment de la commande.
  const to = owner ? (user?.email ?? order.email) : order.email;
  if (!isDeliverableAddress(to)) {
    return { error: 'Aucune adresse e-mail valide n’est associée à cette commande. Écrivez à la boutique sur WhatsApp.' };
  }

  const built = await buildOrderEmail(order.id, 'receipt');
  if (!built) return { error: 'Commande introuvable.' };

  const result = await sendEmail({ to: to!, ...built.message });
  await audit(user, {
    action: 'order.receipt_emailed',
    entity: 'order',
    entityId: order.id,
    ip,
    metadata: { to: to!, sent: result.sent },
  });

  if (!result.sent) {
    return { error: 'Envoi impossible pour le moment. Réessayez dans un instant ou demandez le bon par WhatsApp.' };
  }

  return { ok: true, to: to! };
}
