/**
 * Libellés de statut côté vitrine.
 *
 * `lib/order-status.ts` reste la source de vérité en français (l'administration
 * l'utilise telle quelle). Ici on traduit le libellé français via la clé du
 * dictionnaire de la vitrine : un statut non encore traduit s'affiche en
 * français au lieu de disparaître.
 */
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/order-status';
import type { SiteTranslator } from './site';

export function siteOrderStatusLabel(t: SiteTranslator, status: OrderStatus): string {
  return t(ORDER_STATUS_LABELS[status]);
}
