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
