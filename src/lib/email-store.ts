import { env } from './env';
import type { StoreEmailInfo } from './email-templates';
import type { PublicSettings } from './settings';

/**
 * Coordonnées de la boutique telles qu'elles apparaissent en pied d'e-mail.
 *
 * Le téléphone, le WhatsApp et la ville viennent des réglages saisis par le
 * propriétaire. Rien n'est inventé : une valeur absente disparaît simplement du
 * pied de page. La boutique n'affiche plus d'adresse ni de coordonnées GPS.
 */
export function storeEmailInfo(settings: PublicSettings): StoreEmailInfo {
  return {
    name: settings.storeName,
    phone: settings.phone,
    whatsapp: settings.whatsapp,
    email: settings.email,
    addressLine: settings.addressLine,
    city: settings.city,
    siteUrl: env.appUrl.replace(/\/$/, ''),
  };
}
