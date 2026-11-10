import type { FaqEntry } from './faq';

/**
 * Les délais s'écrivent `{days}` / `{hours}` : la page les remplit avec
 * `STORE_POLICY_VARS`, ce qui permet de traduire la phrase sans figer un
 * chiffre dans la clé de traduction.
 */

/**
 * Contenu de la FAQ « livraisons ».
 *
 * Source unique : la page /livraison, les données structurées FAQPage et les
 * tests lisent tous ce même tableau. Les règles sont celles fixées par le
 * propriétaire : livraison à domicile uniquement (le retrait en magasin a été
 * retiré du parcours), 7 jours maximum hors Daloa, prix du transport convenu sur
 * WhatsApp.
 */
export const DELIVERY_FAQ: readonly FaqEntry[] = [
  {
    id: 'hors-daloa',
    question: 'Livrez-vous en dehors de Daloa ?',
    answer: 'Oui. Choisissez votre ville au moment de la commande, puis écrivez-nous sur WhatsApp : c’est là que le prix du transport est convenu, selon la ville et le volume du colis. La livraison prend {days} jours maximum. Si votre ville n’apparaît pas dans la liste, écrivez-nous avec la référence du produit : nous vous répondons avant tout règlement.',
    whatsappMessage:
      'Bonjour Perokado, je souhaite une livraison hors Daloa. Ma ville de destination est : … et les produits qui m’intéressent sont : …',
  },
  {
    id: 'daloa',
    question: 'Comment se passe la livraison à Daloa ?',
    answer:
      'Vous choisissez votre quartier dans la liste au moment de la commande : les frais de livraison s’affichent aussitôt, avant le paiement. La livraison se fait à domicile, le jour même ou le lendemain, aux heures d’ouverture de la boutique. Le livreur vous appelle au numéro laissé à la commande.',
    whatsappMessage:
      'Bonjour Perokado, je souhaite organiser une livraison à Daloa. Mon quartier : …',
  },
  {
    id: 'prepaiement',
    question: 'Pourquoi le paiement des articles est-il demandé avant l’expédition hors Daloa ?',
    answer:
      'Parce que le transporteur est réglé au départ du colis. La commande ne part qu’après vérification du paiement reçu par la boutique : une capture d’écran ou une déclaration ne valent jamais preuve de paiement. Tant que le paiement n’est pas confirmé, la commande reste « paiement à vérifier » et le colis reste en boutique.',
    whatsappMessage:
      'Bonjour Perokado, je souhaite expédier une commande hors Daloa et j’ai une question sur le paiement. Ma référence de commande : …',
  },
  {
    id: 'delais-suivi',
    question: 'Quel délai prévoir et comment suivre ma commande ?',
    answer: 'Hors Daloa : {days} jours maximum selon la ville. À Daloa : livraison le jour même ou le lendemain, aux heures d’ouverture. Chaque étape est enregistrée sur votre commande : ouvrez la page de suivi avec votre numéro de commande pour voir où en est le colis.',
    whatsappMessage: 'Bonjour Perokado, je souhaite avoir une point sur ma commande. Numéro : …',
  },
  {
    id: 'modification',
    question: 'Puis-je modifier la commande ou changer la ville avant l’expédition ?',
    answer:
      'Oui, tant que la commande n’est pas partie. Écrivez sur WhatsApp avec votre numéro de commande : si le colis n’est pas encore remis au livreur ou au transporteur, la boutique ajuste la ville ou le quartier. Une fois le colis parti, le changement n’est plus possible.',
    whatsappMessage: 'Bonjour Perokado, je souhaite modifier ma commande avant expédition. Numéro : … Changement souhaité : …',
  },
];

/** Message WhatsApp proposé à la fin de la FAQ livraisons. */
export const DELIVERY_FAQ_FALLBACK_MESSAGE =
  'Bonjour Perokado, j’ai une question sur la livraison ou l’expédition d’une commande.';
