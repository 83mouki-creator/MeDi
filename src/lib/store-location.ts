/**
 * Coordonnées de contact de la boutique.
 *
 * La boutique ne publie plus d'adresse géographique ni de carte : le parcours
 * de vente repose sur la **livraison à domicile**, et le client n'a donc pas
 * besoin de se rendre sur place. Ce module ne conserve que ce qui reste utile :
 * le message WhatsApp prérempli pour convenir du transport hors ville.
 */
import { STORE_NAME } from './brand';

export type TransportQuoteItem = { name: string; quantity: number };

/**
 * Message pré-rempli pour négocier le transport hors Daloa.
 *
 * On y met tout ce qui permet au boutiquier de répondre du premier coup : ville
 * de destination, produits, montant des articles et numéro de commande.
 */
export function transportQuoteMessage(params: {
  city: string;
  items: TransportQuoteItem[];
  subtotal?: number;
  orderNumber?: string;
  customerName?: string;
  phone?: string;
  storeName?: string;
}): string {
  const store = params.storeName?.trim() || STORE_NAME;
  const lines = [
    `Bonjour ${store}, je souhaite faire livrer une commande hors Daloa (${params.city}).`,
    'Pouvez-vous me donner le prix du transport et le délai ?',
  ];
  if (params.orderNumber) lines.push(`Commande : ${params.orderNumber}`);
  if (params.items.length > 0) {
    const detail = params.items
      .slice(0, 8)
      .map((item) => `• ${item.name} × ${item.quantity}`)
      .join('\n');
    lines.push('Produits :', detail);
    if (params.items.length > 8) lines.push(`… et ${params.items.length - 8} autre(s) article(s).`);
  }
  if (typeof params.subtotal === 'number') {
    lines.push(`Montant des articles : ${new Intl.NumberFormat('fr-FR').format(params.subtotal)} FCFA`);
  }
  if (params.customerName) lines.push(`Nom : ${params.customerName}`);
  if (params.phone) lines.push(`Téléphone : ${params.phone}`);
  return lines.join('\n');
}

/** Lien WhatsApp vers la boutique avec un message déjà écrit. */
export function whatsappWithMessage(
  settings: { whatsapp?: string | null; phone?: string | null },
  message: string,
): string | null {
  const raw = settings.whatsapp ?? settings.phone;
  if (!raw) return null;
  const number = raw.replace(/\D/g, '');
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
