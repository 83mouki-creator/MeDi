import type { FaqEntry } from './faq';

/**
 * Contenu de la FAQ « livraisons et expéditions ».
 *
 * Source unique : la page /livraison, les données structurées FAQPage et les
 * tests lisent tous ce même tableau. Chaque réponse renvoie vers le WhatsApp de
 * la boutique : aucun cas particulier n'est tranché par une règle inventée.
 */
export const DELIVERY_FAQ: readonly FaqEntry[] = [
  {
    id: 'hors-daloa',
    question: 'Livrez-vous en dehors de Daloa ?',
    answer:
      'Oui. Pour toute ville située hors de Daloa, la commande part par transporteur. Le montant du transport dépend de la destination : il est ajouté au panier après le choix de la ville et s’affiche avant le paiement. Si votre ville n’apparaît pas dans la liste, ne devinez pas le tarif : écrivez-nous avec la ville et la référence du produit, nous vous communiquons le coût réel du transport avant tout règlement.',
    whatsappMessage:
      'Bonjour MeDi, je souhaite une livraison hors Daloa. Ma ville de destination est : … et les produits qui m’intéressent sont : …',
  },
  {
    id: 'daloa',
    question: 'Comment se passe une livraison ou un retrait à Daloa ?',
    answer:
      'À Daloa, deux possibilités : le retrait gratuit en boutique pendant les heures d’ouverture, ou la livraison à domicile dans votre quartier. Vous indiquez votre quartier ou un point de repère au moment de la commande, les frais de la zone s’ajoutent au total et le créneau de passage est convenu avec vous. Le paiement à la livraison n’est proposé que si la boutique l’a autorisé pour la zone et le montant concernés.',
    whatsappMessage:
      'Bonjour MeDi, je souhaite organiser une livraison à Daloa (ou un retrait en boutique). Mon quartier / point de repère : …',
  },
  {
    id: 'prepaiement',
    question: 'Pourquoi le paiement intégral est-il exigé hors Daloa ?',
    answer:
      'Parce que le transporteur est réglé au départ du colis et qu’aucun encaissement n’a lieu à l’arrivée. La commande ne devient « prête à expédier » qu’après vérification de l’encaissement réel par un administrateur : une capture d’écran, un SMS ou une déclaration ne valent jamais preuve de paiement. Tant que le paiement n’est pas confirmé, la commande reste « paiement à vérifier » et le colis reste en boutique.',
    whatsappMessage:
      'Bonjour MeDi, je souhaite expédier une commande hors Daloa et j’ai une question sur le prépaiement. Ma référence de commande / de transaction : …',
  },
  {
    id: 'delais-suivi',
    question: 'Quel délai prévoir et comment suivre mon expédition ?',
    answer:
      'Le délai dépend du transporteur et de la destination : aucun délai garanti n’est annoncé à l’avance, la boutique vous confirme l’estimation au moment de la commande. Dès que le colis est remis au transporteur, la référence de suivi est enregistrée sur votre commande et reste consultable avec votre numéro de commande sur la page de suivi. Pour un point de situation précis, le plus rapide reste WhatsApp.',
    whatsappMessage:
      'Bonjour MeDi, je voudrais le point sur l’expédition de ma commande. Numéro de commande : …',
  },
  {
    id: 'modification',
    question: 'Puis-je modifier la commande ou changer la ville avant l’expédition ?',
    answer:
      'Oui, tant que le colis n’a pas été remis au transporteur. Signalez-le immédiatement sur WhatsApp en indiquant votre numéro de commande : la boutique vérifie l’état réel de la commande et la disponibilité du stock avant de modifier la destination, les articles ou le mode de retrait. Si un supplément de transport s’applique, il est annoncé et réglé avant l’expédition ; aucune modification n’est appliquée sans votre accord.',
    whatsappMessage:
      'Bonjour MeDi, je souhaite modifier ma commande avant expédition. Numéro de commande : … Modification souhaitée : …',
  },
] as const;

export const DELIVERY_FAQ_FALLBACK_MESSAGE =
  'Bonjour MeDi, j’ai une question sur la livraison ou l’expédition d’une commande.';
