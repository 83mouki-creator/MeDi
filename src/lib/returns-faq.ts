import type { FaqEntry } from './faq';

/**
 * FAQ « retours et remboursements ».
 *
 * La politique de retour définitive n'est pas encore publiée par la direction :
 * aucune durée, aucun barème de frais et aucune exclusion ne sont inventés ici.
 * Chaque réponse décrit la procédure réelle (constat, vérification, décision de
 * la boutique) et renvoie au WhatsApp pour le cas particulier.
 */
export const RETURNS_FAQ: readonly FaqEntry[] = [
  {
    id: 'demande-retour',
    question: 'Comment demander un retour ou un échange ?',
    answer:
      'Écrivez sur WhatsApp en indiquant votre numéro de commande, la référence du produit et le motif, en joignant des photos si le produit est endommagé. La boutique vérifie l’état réel de la commande et vous confirme si le retour est recevable et comment procéder. Aucun retour n’est traité sans ce contrôle préalable : ne renvoyez pas un article de votre propre initiative.',
    whatsappMessage:
      'Bonjour MeDi, je souhaite demander un retour ou un échange. Numéro de commande : … Référence du produit : … Motif : …',
  },
  {
    id: 'produits-eligibles',
    question: 'Quels produits peuvent être retournés ?',
    answer:
      'Un article est examiné s’il est intact, non utilisé et non installé, complet (accessoires, visserie, notice) et dans son emballage d’origine. Les conditions définitives — cas exclus, produits déjà posés ou découpés, consommables — sont arrêtées par la direction de la boutique et rappelées sur la page Retours. En cas de doute sur un article précis, posez la question sur WhatsApp avant tout envoi.',
    whatsappMessage:
      'Bonjour MeDi, avant de renvoyer un article, je voudrais savoir s’il est éligible à un retour. Produit : … État : …',
  },
  {
    id: 'produit-abime',
    question: 'Que faire si le produit arrive abîmé ou défectueux ?',
    answer:
      'Si l’emballage est visiblement détérioré à la livraison, refusez le colis auprès du transporteur. Prévenez ensuite la boutique le jour même avec des photos du colis et du produit : la constatation est faite rapidement, ce qui conditionne la suite du dossier. Pour un défaut d’usage, la garantie du fabricant s’applique et la boutique vous accompagne dans sa mise en œuvre.',
    whatsappMessage:
      'Bonjour MeDi, un produit reçu est abîmé ou défectueux. Numéro de commande : … Photos et description : …',
  },
  {
    id: 'remboursement',
    question: 'Comment se passe un remboursement ou un avoir ?',
    answer:
      'Une fois l’article reçu et contrôlé par la boutique, le montant à rembourser est confirmé et le mode de règlement est convenu avec vous : remboursement par Wave ou avoir à valoir sur une prochaine commande. Aucun remboursement n’est déclenché avant la réception et le contrôle de l’article retourné, et l’opération est toujours annoncée par écrit sur WhatsApp.',
    whatsappMessage:
      'Bonjour MeDi, je souhaite connaître le remboursement prévu pour mon retour. Numéro de commande : …',
  },
  {
    id: 'frais-retour',
    question: 'Qui prend en charge les frais de retour ?',
    answer:
      'Aucun barème de frais de retour n’est publié à ce jour : le transport d’un retour dépend de la ville, du poids de l’article et du motif (erreur de préparation, produit défectueux, changement d’avis). La boutique vous indique par WhatsApp, avant l’expédition du retour, qui supporte ces frais et quel est le montant. Aucun frais n’est prélevé sans votre accord.',
    whatsappMessage:
      'Bonjour MeDi, je voudrais connaître les frais de retour pour mon article. Numéro de commande : … Ville : …',
  },
] as const;

export const RETURNS_FAQ_FALLBACK_MESSAGE =
  'Bonjour MeDi, j’ai une question sur un retour, un échange ou un remboursement.';
