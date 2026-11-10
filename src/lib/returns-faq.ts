import type { FaqEntry } from './faq';

/**
 * FAQ « remboursements et échanges ».
 *
 * Règle arrêtée par le propriétaire : une fois le produit livré, ni l’argent
 * n’est rendu, ni le produit n’est remplacé. Les réponses expliquent donc ce qui
 * reste possible (vérification avant la remise, annulation avant départ du
 * colis) et renvoient au service client pour tout problème.
 */
export const RETURNS_FAQ: readonly FaqEntry[] = [
  {
    id: 'demande-retour',
    question: 'Comment demander un retour ou un échange ?',
    answer:
      'Une fois le produit livré, ni l’argent n’est rendu, ni le produit n’est remplacé : aucune demande de retour n’aboutit après la remise. En cas de problème, appelez le service client le jour même avec votre numéro de commande et des photos : la boutique examine la situation avec vous et avec le livreur.',
    whatsappMessage: 'Bonjour Perokado, je souhaite joindre le service client au sujet d’une commande livrée. Numéro : …',
  },
  {
    id: 'produits-eligibles',
    question: 'Quels produits peuvent être retournés ?',
    answer:
      'Aucun produit livré n’est repris, remboursé ou échangé. Avant la remise, vous pouvez en revanche vérifier l’article avec le livreur : comptez les pièces, contrôlez la référence, l’état et l’emballage. Profitez de ce moment, car une fois le bon signé, le produit est considéré comme accepté.',
    whatsappMessage: 'Bonjour Perokado, je voudrais vérifier un article avant la livraison. Produit : …',
  },
  {
    id: 'produit-abime',
    question: 'Que faire si le produit arrive abîmé ?',
    answer:
      'Refusez le colis ou signalez-le immédiatement au livreur, puis appelez le service client le jour même en indiquant votre numéro de commande. La boutique vérifie avec le transporteur ce qui s’est passé. Sans signalement le jour de la livraison, aucun recours n’est possible.',
    whatsappMessage: 'Bonjour Perokado, mon colis est arrivé abîmé. Commande : … Photos : …',
  },
  {
    id: 'remboursement',
    question: 'Comment se passe un remboursement ou un avoir ?',
    answer:
      'Un remboursement n’est possible que si la commande est annulée avant la remise du colis au livreur ou au transporteur : les articles réglés par Wave sont alors rendus par le même moyen. Après la livraison, ni l’argent n’est rendu, ni le produit n’est remplacé. Appelez le service client pour toute situation particulière.',
    whatsappMessage: 'Bonjour Perokado, je souhaite annuler ma commande avant livraison. Numéro : …',
  },
  {
    id: 'frais-retour',
    question: 'Qui prend en charge les frais de retour ?',
    answer:
      'Aucun frais de retour n’est facturé, puisqu’aucun retour de produit livré n’est accepté. Si vous annulez avant l’expédition, la boutique vous indique sur WhatsApp les éventuels frais déjà engagés (transport, préparation) avant toute décision : rien n’est prélevé sans votre accord.',
    whatsappMessage: 'Bonjour Perokado, j’ai une question sur les frais en cas d’annulation. Commande : …',
  },
];

/** Message WhatsApp proposé à la fin de la FAQ retours. */
export const RETURNS_FAQ_FALLBACK_MESSAGE =
  'Bonjour Perokado, j’ai une question sur un retour, un échange ou un remboursement.';
