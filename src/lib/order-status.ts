export type OrderStatus =
  | 'PENDING_CONFIRMATION'
  | 'AWAITING_PAYMENT'
  | 'AWAITING_PAYMENT_VERIFICATION'
  | 'PAYMENT_CONFIRMED'
  | 'PREPARING'
  | 'READY_TO_SHIP'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: 'En attente de confirmation',
  AWAITING_PAYMENT: 'En attente de paiement',
  AWAITING_PAYMENT_VERIFICATION: 'Paiement à vérifier',
  PAYMENT_CONFIRMED: 'Paiement confirmé',
  PREPARING: 'En préparation',
  READY_TO_SHIP: 'Prête à expédier',
  SHIPPED: 'Expédiée',
  OUT_FOR_DELIVERY: 'En cours de livraison',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  REFUNDED: 'Remboursée',
};

/**
 * Le même statut, dit comme une action concrète.
 * Dans la fiche commande, le menu déroulant propose « J'ai donné le colis au
 * transporteur » plutôt que « Expédiée » : on choisit ce qu'on fait, pas un code.
 */
export const ORDER_STATUS_ACTIONS: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: 'La commande vient d’arriver',
  AWAITING_PAYMENT: 'Le client doit encore payer',
  AWAITING_PAYMENT_VERIFICATION: 'Le client dit avoir payé (à vérifier)',
  PAYMENT_CONFIRMED: 'J’ai reçu l’argent',
  PREPARING: 'Je prépare le colis',
  READY_TO_SHIP: 'Le colis est prêt',
  SHIPPED: 'J’ai donné le colis au transporteur',
  OUT_FOR_DELIVERY: 'Le livreur est en route',
  DELIVERED: 'Le client a reçu son colis',
  CANCELLED: 'Annuler la commande',
  REFUNDED: 'J’ai remboursé le client',
};

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: 'bg-navy-100 text-navy-800',
  AWAITING_PAYMENT: 'bg-amber-100 text-amber-900',
  AWAITING_PAYMENT_VERIFICATION: 'bg-amber-100 text-amber-900',
  PAYMENT_CONFIRMED: 'bg-emerald-100 text-emerald-900',
  PREPARING: 'bg-sky-100 text-sky-900',
  READY_TO_SHIP: 'bg-sky-100 text-sky-900',
  SHIPPED: 'bg-indigo-100 text-indigo-900',
  OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-900',
  DELIVERED: 'bg-emerald-100 text-emerald-900',
  CANCELLED: 'bg-rose-100 text-rose-900',
  REFUNDED: 'bg-rose-100 text-rose-900',
};

export const PAYMENT_STATUS_LABELS = {
  UNPAID: 'Non payé',
  AWAITING_VERIFICATION: 'Paiement à vérifier',
  PAID: 'Payé',
  FAILED: 'Échec',
  REFUNDED: 'Remboursé',
} as const;

/** Ordre d'affichage du suivi (les statuts terminaux sont traités à part). */
export const TRACKING_STEPS: OrderStatus[] = [
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

/**
 * Transitions autorisées. Toute transition non listée est refusée côté serveur.
 * Les règles commerciales (prépaiement hors Daloa) sont vérifiées en plus dans
 * le service de commandes.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_CONFIRMATION: ['AWAITING_PAYMENT', 'AWAITING_PAYMENT_VERIFICATION', 'PAYMENT_CONFIRMED', 'CANCELLED'],
  AWAITING_PAYMENT: ['AWAITING_PAYMENT_VERIFICATION', 'PAYMENT_CONFIRMED', 'CANCELLED'],
  AWAITING_PAYMENT_VERIFICATION: ['PAYMENT_CONFIRMED', 'AWAITING_PAYMENT', 'CANCELLED'],
  PAYMENT_CONFIRMED: ['PREPARING', 'READY_TO_SHIP', 'CANCELLED', 'REFUNDED'],
  PREPARING: ['READY_TO_SHIP', 'SHIPPED', 'CANCELLED'],
  READY_TO_SHIP: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED', 'REFUNDED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(status: OrderStatus) {
  return status === 'DELIVERED' || status === 'CANCELLED' || status === 'REFUNDED';
}

export const ORDER_STEPS: { label: string; hint: string }[] = [
  { label: 'Commande reçue', hint: 'Le client a commandé' },
  { label: 'Argent reçu', hint: 'Vous avez vérifié le paiement' },
  { label: 'Colis prêt', hint: 'Tout est emballé' },
  { label: 'Colis livré', hint: 'Le client a son colis' },
];

/**
 * Position d'une commande sur les quatre grandes étapes.
 *
 * Onze statuts techniques, c'est trop pour décider quoi faire. Quatre étapes
 * suffisent : reçue, payée, prête, livrée.
 */
export function orderStep(status: OrderStatus): number {
  switch (status) {
    case 'PAYMENT_CONFIRMED':
    case 'PREPARING':
      return 1;
    case 'READY_TO_SHIP':
    case 'SHIPPED':
    case 'OUT_FOR_DELIVERY':
      return 2;
    case 'DELIVERED':
      return 3;
    default:
      return 0;
  }
}
