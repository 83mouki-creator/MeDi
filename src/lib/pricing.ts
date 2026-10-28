import { toFcfa } from './utils';

export type ProductPricingInput = {
  price: string | number;
  promoPrice: string | number | null;
  promoStartsAt: Date | string | null;
  promoEndsAt: Date | string | null;
};

export type Availability = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'PREORDER';

export type EffectivePricing = {
  /** Prix catalogue en FCFA */
  basePrice: number;
  /** Prix effectivement facturé (promo si active) */
  price: number;
  /** true si une promotion est active maintenant */
  onPromo: boolean;
  /** Pourcentage de remise arrondi (0 si pas de promo) */
  discountPercent: number;
  /** Économie en FCFA */
  savings: number;
};

/**
 * Une promotion n'est appliquée que si `promoPrice` est renseigné, inférieur au
 * prix de base, et que la fenêtre [promoStartsAt, promoEndsAt] est ouverte.
 */
export function computePricing(product: ProductPricingInput, now = new Date()): EffectivePricing {
  const basePrice = toFcfa(product.price);
  const promo = product.promoPrice === null ? null : toFcfa(product.promoPrice);

  if (promo === null || promo <= 0 || promo >= basePrice) {
    return { basePrice, price: basePrice, onPromo: false, discountPercent: 0, savings: 0 };
  }

  const starts = product.promoStartsAt ? new Date(product.promoStartsAt) : null;
  const ends = product.promoEndsAt ? new Date(product.promoEndsAt) : null;
  const started = !starts || starts.getTime() <= now.getTime();
  const notEnded = !ends || ends.getTime() >= now.getTime();

  if (!started || !notEnded) {
    return { basePrice, price: basePrice, onPromo: false, discountPercent: 0, savings: 0 };
  }

  const savings = basePrice - promo;
  return {
    basePrice,
    price: promo,
    onPromo: true,
    discountPercent: Math.round((savings / basePrice) * 100),
    savings,
  };
}

/**
 * Disponibilité explicite.
 * Règle : un produit n'est jamais annoncé « disponible » si le stock réel est nul,
 * sauf si le propriétaire a explicitement activé la précommande.
 */
export function computeAvailability(
  input: { stock: number; reserved: number; lowStockThreshold?: number | null; allowPreorder: boolean },
  defaultLowStockThreshold = 5,
): { state: Availability; available: number; label: string; canOrder: boolean } {
  const available = Math.max(0, input.stock - input.reserved);
  const threshold = input.lowStockThreshold ?? defaultLowStockThreshold;

  if (available <= 0) {
    if (input.allowPreorder) {
      return { state: 'PREORDER', available: 0, label: 'Précommande', canOrder: true };
    }
    return { state: 'OUT_OF_STOCK', available: 0, label: 'Épuisé', canOrder: false };
  }
  if (available <= threshold) {
    return { state: 'LOW_STOCK', available, label: `Plus que ${available} en stock`, canOrder: true };
  }
  return { state: 'IN_STOCK', available, label: 'En stock', canOrder: true };
}

export const availabilityColor: Record<Availability, string> = {
  IN_STOCK: 'text-success-500',
  LOW_STOCK: 'text-warning-500',
  OUT_OF_STOCK: 'text-danger-500',
  PREORDER: 'text-navy-500',
};
