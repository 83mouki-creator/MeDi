import { env } from './env';
import type { StoreEmailInfo } from './email-templates';
import type { PublicSettings } from './settings';
import { storeLocation } from './store-location';

/**
 * Coordonnées de la boutique telles qu'elles apparaissent en pied d'e-mail.
 *
 * L'adresse, la ville, le téléphone et les coordonnées GPS viennent des
 * réglages saisis par le propriétaire (repli : le relevé GPS officiel de la
 * boutique). Rien n'est inventé : une valeur absente disparaît simplement du
 * pied de page.
 */
export function storeEmailInfo(settings: PublicSettings): StoreEmailInfo {
  const location = storeLocation(settings);
  return {
    name: settings.storeName,
    phone: settings.phone,
    whatsapp: settings.whatsapp,
    email: settings.email,
    addressLine: location.addressLine,
    city: location.city,
    dms: location.dms,
    siteUrl: env.appUrl.replace(/\/$/, ''),
  };
}
