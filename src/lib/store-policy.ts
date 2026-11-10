import type { PublicSettings } from './settings';

/**
 * Règles de vente affichées au client, telles que fixées par le propriétaire.
 *
 *  • la livraison à domicile se fait aux heures d'ouverture de la boutique ;
 *  • hors Daloa, la livraison prend une semaine au maximum selon la ville ;
 *  • le prix du transport hors Daloa se discute sur WhatsApp ;
 *  • une fois le produit livré, ni remboursement, ni échange.
 *
 * Aucune de ces valeurs n'est calculée ailleurs : les pages, le tunnel de
 * commande et les bons de livraison lisent toutes ce module.
 *
 * Le **retrait en magasin a été retiré** du parcours : `PICKUP_HOLD_HOURS` ne
 * sert plus qu'à lire d'anciennes commandes, il n'est plus affiché.
 */
export const OUTSIDE_DALOA_MAX_DAYS = 7;

/** Variables {days} des textes (FAQ, pages) : jamais un chiffre figé dans une clé. */
export const STORE_POLICY_VARS = { days: OUTSIDE_DALOA_MAX_DAYS };

/** Phrase imposée par le propriétaire, en bon français. */
export const FINAL_SALE_NOTICE =
  'Une fois le produit livré, ni l’argent n’est rendu, ni le produit n’est remplacé. En cas de problème, appelez le service client.';

/** Version courte pour les bandeaux et les fiches produit. */
export const FINAL_SALE_NOTICE_SHORT =
  'Produit livré : ni remboursement, ni échange. En cas de problème, appelez le service client.';

export type ScheduleLine = { title: string; detail: string };

/**
 * Jours et heures de livraison.
 *
 * Les horaires viennent de `storeSettings.openingHours` (saisis par le
 * propriétaire). Tant qu'ils ne sont pas renseignés, on affiche une formule
 * neutre plutôt qu'un horaire inventé. Il n'y a plus de ligne « retrait » : la
 * boutique ne conserve pas de colis en magasin.
 */
export function deliverySchedule(settings: PublicSettings, options?: { zoneDelay?: string | null }) {
  const hours = settings.openingHours?.trim() || null;
  const openLine = hours
    ? `Aux heures d’ouverture de la boutique — ${hours}`
    : 'Aux heures d’ouverture de la boutique (à confirmer par téléphone)';

  const local: ScheduleLine = {
    title: `Livraison à Daloa`,
    detail: options?.zoneDelay
      ? `${options.zoneDelay}. Nous vous appelons avant de passer.`
      : `${openLine}. Nous vous appelons avant de passer.`,
  };

  const outside: ScheduleLine = {
    title: 'Livraison hors Daloa',
    detail: `Expédition sous ${OUTSIDE_DALOA_MAX_DAYS} jours maximum selon la ville. Le prix du transport est à convenir sur WhatsApp avec la boutique.`,
  };

  return { local, outside };
}
