import type { Permission } from './auth';
import type { OrderStatus } from './order-status';

/**
 * Contenu du guide « Comment utiliser le site MeDi Shop » (`/admin/guide`).
 *
 * Les textes sont rangés ici, hors de la page, pour deux raisons :
 *  • les tests vérifient que **chaque phrase** existe bien en arabe (la page,
 *    elle, passe les chaînes à `t()` de façon dynamique : un simple scan du
 *    code ne les verrait pas) ;
 *  • la page ne garde que la mise en page, et le guide reste facile à corriger
 *    sans toucher au rendu.
 *
 * Règle d'écriture : des phrases courtes, sans jargon, compréhensibles par
 * n'importe qui dans la boutique.
 */

export type GuideIcon =
  | 'cash'
  | 'payment'
  | 'package'
  | 'message'
  | 'stock'
  | 'promo'
  | 'print'
  | 'users'
  | 'journal';

export type GuideSection = { id: string; label: string };

export type GuideStep = { title: string; text: string };

export type GuideAction = {
  href: string;
  icon: GuideIcon;
  title: string;
  text: string;
  permission?: Permission;
};

export const GUIDE_SECTIONS: GuideSection[] = [
  { id: 'comprendre', label: 'Comprendre le site en une minute' },
  { id: 'parcours', label: 'Le voyage d’une commande' },
  { id: 'routine', label: 'Votre routine du jour' },
  { id: 'gestes', label: 'Les gestes utiles' },
  { id: 'mots', label: 'Les mots de l’écran' },
  { id: 'probleme', label: 'En cas de problème' },
];

/** Les étapes du parcours d'une commande, dans l'ordre où elles arrivent. */
export const GUIDE_JOURNEY: OrderStatus[] = [
  'PENDING_CONFIRMATION',
  'AWAITING_PAYMENT',
  'AWAITING_PAYMENT_VERIFICATION',
  'PAYMENT_CONFIRMED',
  'PREPARING',
  'READY_TO_SHIP',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

/** Ce que l'équipe fait, très concrètement, à chaque étape. */
export const GUIDE_JOURNEY_ACTION: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: 'Rien à faire tout de suite : la commande vient d’arriver. Appelez le client si un détail manque.',
  AWAITING_PAYMENT: 'Le client n’a pas encore payé. Laissez la commande ouverte et rappelez-lui le numéro Wave.',
  AWAITING_PAYMENT_VERIFICATION: 'Ouvrez le paiement, vérifiez l’argent sur le compte Wave ou dans la caisse, puis confirmez.',
  PAYMENT_CONFIRMED: 'L’argent est là. C’est le moment de sortir les articles et de préparer le carton.',
  PREPARING: 'Comptez les pièces, contrôlez la référence et l’état, puis emballez.',
  READY_TO_SHIP: 'Le colis est prêt. Imprimez le bon de livraison et prévenez le client.',
  SHIPPED: 'Le colis est parti. Notez le nom du transporteur dans la fiche commande.',
  OUT_FOR_DELIVERY: 'Le livreur est en route. Restez joignable au téléphone.',
  DELIVERED: 'La commande est terminée. Le client a signé le bon de livraison.',
  CANCELLED: 'La commande est annulée : remettez les articles en rayon, le stock se libère tout seul.',
  REFUNDED: 'L’argent a été rendu. Notez pourquoi dans la fiche, pour garder une trace.',
};

export const GUIDE_INTRO: GuideStep[] = [
  {
    title: 'Le client choisit et commande',
    text: 'Il regarde le catalogue, met les articles dans son panier et indique son quartier de Daloa, ou sa ville hors Daloa.',
  },
  {
    title: 'Le client paie',
    text: 'Par Wave, ou en espèces à la livraison quand c’est autorisé. Aucune capture d’écran ne vaut preuve : c’est vous qui vérifiez l’argent reçu.',
  },
  {
    title: 'Vous préparez le colis',
    text: 'Les articles sont comptés, contrôlés, emballés. Le stock se met à jour tout seul.',
  },
  {
    title: 'Le client reçoit',
    text: 'Retrait gratuit en boutique sous 48 h, livraison dans un quartier de Daloa, ou expédition hors Daloa en 7 jours maximum.',
  },
];

export const GUIDE_ROUTINE: GuideAction[] = [
  {
    href: '/admin/caisse',
    icon: 'cash',
    title: 'Ouvrir la caisse',
    text: 'Notez l’argent présent au départ, puis ouvrez la journée.',
    permission: 'payments.read',
  },
  {
    href: '/admin/paiements',
    icon: 'payment',
    title: 'Vérifier les paiements',
    text: 'Chaque client qui dit avoir payé attend votre confirmation.',
    permission: 'payments.read',
  },
  {
    href: '/admin/commandes?status=PAYMENT_CONFIRMED',
    icon: 'package',
    title: 'Préparer les colis',
    text: 'Sortez les articles, comptez, emballez, imprimez le bon.',
    permission: 'orders.read',
  },
  {
    href: '/admin/messages',
    icon: 'message',
    title: 'Répondre aux messages',
    text: 'Une question sans réponse est une vente perdue.',
    permission: 'messages.handle',
  },
  {
    href: '/admin/caisse',
    icon: 'cash',
    title: 'Fermer la caisse',
    text: 'Comptez l’argent du soir et fermez la journée.',
    permission: 'payments.read',
  },
  {
    href: '/admin/stock',
    icon: 'stock',
    title: 'Regarder le stock',
    text: 'Les produits bientôt finis sont signalés : commandez-les.',
    permission: 'products.read',
  },
];

export const GUIDE_GESTURES: GuideAction[] = [
  {
    href: '/admin/promotions',
    icon: 'promo',
    title: 'Faire une promotion',
    text: 'Choisissez des produits, un pourcentage et les dates. Le nouveau prix et le bandeau s’affichent tout de suite sur le site.',
    permission: 'products.write',
  },
  {
    href: '/admin/stock',
    icon: 'stock',
    title: 'Changer le stock',
    text: 'Pour une pièce : ouvrez la fiche du produit. Pour tout le stock d’un coup : les boutons + et − en haut de la page Stock.',
    permission: 'products.read',
  },
  {
    href: '/admin/bons',
    icon: 'print',
    title: 'Imprimer un bon de livraison',
    text: 'Le bon reprend les produits commandés et se règle pour les petites imprimantes de comptoir (80 mm).',
    permission: 'delivery.manage',
  },
  {
    href: '/admin/caisse',
    icon: 'cash',
    title: 'Ouvrir et fermer la caisse',
    text: 'Le matin, notez l’argent du départ. Le soir, la caisse compare ce qui devait rester avec ce que vous comptez.',
    permission: 'payments.read',
  },
  {
    href: '/admin/utilisateurs',
    icon: 'users',
    title: 'Créer un accès agent',
    text: 'Un agent se crée avec un nom, un numéro ivoirien et une tâche. Aucun mot de passe à retenir : il reçoit un code par WhatsApp.',
    permission: 'users.manage',
  },
  {
    href: '/admin/journal',
    icon: 'journal',
    title: 'Voir qui a fait quoi',
    text: 'Chaque geste sensible (prix, stock, paiement) est écrit en clair, avec le nom de la personne.',
    permission: 'audit.read',
  },
];

export const GUIDE_WORDS: { word: string; text: string }[] = [
  {
    word: 'Paiement à vérifier',
    text: 'Le client dit avoir payé, mais vous ne l’avez pas encore constaté. Rien ne part avant votre confirmation.',
  },
  {
    word: 'Réservé',
    text: 'Une pièce est mise de côté pour une commande en cours. Elle n’est plus proposée aux autres clients.',
  },
  {
    word: 'Seuil',
    text: 'Le nombre à partir duquel le produit passe en alerte « bientôt fini ».',
  },
  {
    word: 'Bon de livraison',
    text: 'Le papier remis au livreur : il liste les produits, la quantité et l’adresse de livraison.',
  },
  {
    word: 'Caisse',
    text: 'Le tiroir de la boutique. L’ouverture note l’argent du départ, la fermeture compare avec les ventes du jour.',
  },
  {
    word: 'Hors Daloa',
    text: 'Une autre ville. Les articles se règlent d’abord, puis le transport se discute sur WhatsApp.',
  },
];

export const GUIDE_PROBLEMS: { q: string; a: string }[] = [
  {
    q: 'Le client dit avoir payé, mais je ne vois rien.',
    a: 'Ne confirmez pas. Demandez la référence Wave et l’heure du paiement, vérifiez le compte, puis répondez. Une capture d’écran ne suffit jamais.',
  },
  {
    q: 'Le client ne vient pas chercher son colis.',
    a: 'Appelez-le. Le colis payé en ligne reste {hours} h en boutique au maximum, puis les articles retournent en stock.',
  },
  {
    q: 'Le produit est arrivé abîmé.',
    a: 'Demandez au client de refuser le colis ou de le signaler au livreur le jour même, avec des photos. Notez tout dans la fiche commande.',
  },
  {
    q: 'Le client demande un remboursement après livraison.',
    a: 'Expliquez la règle, avec calme : une fois le produit livré, ni l’argent n’est rendu, ni le produit n’est remplacé. En cas de problème, appelez le service client.',
  },
  {
    q: 'Je me suis trompé sur un prix ou un stock.',
    a: 'Corrigez dans la bonne page, puis vérifiez l’historique : chaque changement est daté et signé. Rien n’est effacé.',
  },
];

/** Les trois phrases à retenir, affichées en bas du guide. */
export const GUIDE_SUMMARY: string[] = [
  'Rien ne part avant que l’argent soit vérifié par vous.',
  'Un colis, un bon de livraison imprimé, un stock à jour.',
  'Un doute ? Le guide, puis le service client : {phone}.',
];

/**
 * Toutes les phrases du guide, à plat : sert au test qui vérifie que chacune
 * existe en arabe comme en français.
 */
export function allGuideStrings(): string[] {
  return [
    ...GUIDE_SECTIONS.map((section) => section.label),
    ...GUIDE_INTRO.flatMap((step) => [step.title, step.text]),
    ...Object.values(GUIDE_JOURNEY_ACTION),
    ...GUIDE_ROUTINE.flatMap((step) => [step.title, step.text]),
    ...GUIDE_GESTURES.flatMap((step) => [step.title, step.text]),
    ...GUIDE_WORDS.flatMap((word) => [word.word, word.text]),
    ...GUIDE_PROBLEMS.flatMap((item) => [item.q, item.a]),
    ...GUIDE_SUMMARY,
  ];
}
