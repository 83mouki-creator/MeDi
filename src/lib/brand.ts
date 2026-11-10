/**
 * Identité de la boutique — source unique de vérité.
 *
 * Tout ce qui porte le nom de la boutique (titres, manifeste de l'application,
 * e-mails, images, données structurées) lit ce module. Changer `STORE_NAME` ou
 * `STORE_TAGLINE` ici suffit pour renommer la boutique partout ; les images de
 * marque, elles, se régénèrent avec `npm run brand:assets`.
 */

export const STORE_NAME = 'Perokado';

/** Slogan officiel, avec son point final : il fait partie de la marque. */
export const STORE_TAGLINE = 'Tout ce que vous cherchez au même endroit.';

/** Même slogan, sans la ponctuation finale (titres, métadonnées). */
export const STORE_TAGLINE_SHORT = 'Tout ce que vous cherchez au même endroit';

/**
 * Coordonnées publiques de la boutique (surchargées par /admin/parametres).
 *
 * Numéro WhatsApp Business — un seul numéro partout : en-tête, pied de page,
 * fiches produit, page contact, e-mails, guide d'équipe et fiche Play Store.
 */
export const STORE_WHATSAPP = '+225 05 44 01 41 82';
export const STORE_WHATSAPP_DIGITS = '2250544014182';
export const STORE_PHONE = '+225 05 44 01 41 82';

/**
 * Messages préremplis des boutons WhatsApp.
 *
 * Le client qui clique n'a rien à écrire : la conversation s'ouvre déjà avec le
 * bon contexte (produit, commande, question), ce qui évite les « Bonjour » nus
 * et permet à la boutique de répondre du premier coup.
 */
export const WHATSAPP_MESSAGES = {
  /** Bouton d'aide générique (en-tête, pied de page, page contact). */
  help: `Bonjour ${STORE_NAME}, je souhaite être aidé(e) par le service client.`,
  /** Fiche produit : le nom et la référence sont ajoutés par l'appelant. */
  product: `Bonjour ${STORE_NAME}, je souhaite des informations sur ce produit :`,
  /** Suivi de commande. */
  order: `Bonjour ${STORE_NAME}, je souhaite des informations sur ma commande :`,
  /** Livraison / frais. */
  delivery: `Bonjour ${STORE_NAME}, je souhaite connaître les frais et le délai de livraison.`,
  /** Retour ou échange. */
  returns: `Bonjour ${STORE_NAME}, je souhaite organiser un retour ou un échange.`,
} as const;

export const STORE_COUNTRY = "Côte d'Ivoire";
export const STORE_CITY = 'Daloa';

/**
 * Images de marque. Elles sont produites par `npm run brand:assets` à partir des
 * tracés vectoriels de `scripts/make-brand-vectors.py`.
 */
export const BRAND = {
  /** En-tête et pied de page (fond bleu nuit). */
  logoHorizontalWhite: '/brand/perokado-logo-horizontal-blanc.png',
  /** Documents et fonds clairs. */
  logoHorizontal: '/brand/perokado-logo-horizontal.png',
  /** Versions empilées (e-mails, factures). */
  logoStacked: '/brand/perokado-logo.png',
  logoStackedWhite: '/brand/perokado-logo-blanc.png',
  /** Icônes. */
  icon: '/brand/perokado-icon.png',
  icon192: '/brand/perokado-icon-192.png',
  iconMaskable: '/brand/perokado-icon-maskable-512.png',
  appleTouchIcon: '/brand/apple-touch-icon.png',
  favicon: '/brand/favicon-32.png',
  /** Emblème vectoriel (filigrane de l'administration). */
  emblem: '/brand/perokado-emblem.svg',
  /** Image de partage (Open Graph / Twitter). */
  ogImage: '/brand/perokado-og.png',
} as const;

/** Dimensions du logo horizontal, pour éviter tout décalage de mise en page. */
export const BRAND_LOGO_SIZE = { width: 515, height: 132 } as const;

/** Couleur de marque (bleu nuit), reprise par le manifeste et le thème. */
export const BRAND_NAVY = '#0e2340';

/** Numéro WhatsApp prêt à recevoir un message prérempli. */
export function whatsappUrl(message?: string, digits = STORE_WHATSAPP_DIGITS): string {
  const suffix = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${suffix}`;
}
