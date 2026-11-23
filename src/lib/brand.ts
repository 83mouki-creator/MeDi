/**
 * Identité de la boutique — source unique de vérité.
 *
 * Tout ce qui porte le nom de la boutique (titres, manifeste de l'application,
 * e-mails, images, données structurées) lit ce module. Changer `STORE_NAME` ou
 * `STORE_TAGLINE` ici suffit pour renommer la boutique partout ; les images de
 * marque, elles, se régénèrent avec `npm run brand:assets`.
 */

export const STORE_NAME = 'MeDi Shop';

/** Slogan officiel, avec son point final : il fait partie de la marque. */
export const STORE_TAGLINE = 'Tout ce que vous cherchez au même endroit.';

/** Même slogan, sans la ponctuation finale (titres, métadonnées). */
export const STORE_TAGLINE_SHORT = 'Tout ce que vous cherchez au même endroit';

/**
 * Coordonnées publiques de la boutique (surchargées par /admin/parametres).
 *
 * Numéro WhatsApp — un seul numéro partout : en-tête, pied de page,
 * fiches produit, page contact, e-mails, guide d'équipe et fiche Play Store.
 */
export const STORE_WHATSAPP = '+225 07 08 90 48 91';
export const STORE_WHATSAPP_DIGITS = '2250708904891';
export const STORE_PHONE = '+225 07 08 90 48 91';

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
 * Images de marque. Le logo est le visuel fourni par la boutique ; les déclinaisons
 * (blanc, fond clair, icônes, image de partage) se régénèrent avec
 * `npm run brand:assets` à partir des tracés de `public/brand/*.svg`
 * (voir `scripts/make-brand-assets.ts`).
 */
export const BRAND = {
  /** En-tête et pied de page (fond bleu nuit). */
  logoHorizontalWhite: '/brand/medi-logo-horizontal-blanc.png',
  /** Documents et fonds clairs. */
  logoHorizontal: '/brand/medi-logo-horizontal.png',
  /** Versions empilées (e-mails, factures). */
  logoStacked: '/brand/medi-logo.png',
  logoStackedWhite: '/brand/medi-logo-blanc.png',
  /** Icônes. */
  icon: '/brand/medi-icon.png',
  icon192: '/brand/medi-icon-192.png',
  iconMaskable: '/brand/medi-icon-maskable-512.png',
  appleTouchIcon: '/brand/apple-touch-icon.png',
  favicon: '/brand/favicon-32.png',
  /** Emblème vectoriel (filigrane de l'administration, documents imprimés). */
  emblem: '/brand/medi-icon.svg',
  /** Photo du bandeau d'accueil. */
  heroImage: '/brand/fond-quincaillerie.jpg',
  /** Image de partage (Open Graph / Twitter). */
  ogImage: '/brand/medi-og.png',
} as const;

/** Dimensions du logo horizontal, pour éviter tout décalage de mise en page. */
export const BRAND_LOGO_SIZE = { width: 1069, height: 200 } as const;

/** Couleur de marque (bleu nuit), reprise par le manifeste et le thème. */
export const BRAND_NAVY = '#0e2340';

/** Numéro WhatsApp prêt à recevoir un message prérempli. */
export function whatsappUrl(message?: string, digits = STORE_WHATSAPP_DIGITS): string {
  const suffix = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${suffix}`;
}
