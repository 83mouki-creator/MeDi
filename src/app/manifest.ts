import type { MetadataRoute } from 'next';
import { BRAND, BRAND_NAVY, STORE_NAME, STORE_TAGLINE_SHORT } from '@/lib/brand';

/**
 * Manifeste de l'application (PWA).
 *
 * Il sert deux choses :
 *   1. « Ajouter à l'écran d'accueil » sur Android et iPhone : icône, nom, plein écran ;
 *   2. paquet Android du Play Store : c'est ce fichier que Bubblewrap lit pour
 *      fabriquer l'application (nom, icônes, couleurs, mode d'affichage).
 *
 * Servi par Next.js sur `/manifest.webmanifest` et rattaché automatiquement à
 * toutes les pages (`<link rel="manifest">`).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: `${STORE_NAME} — ${STORE_TAGLINE_SHORT}`,
    short_name: STORE_NAME,
    description: `${STORE_TAGLINE_SHORT} Outillage, matériaux de construction et équipement de la maison, livrés à domicile.`,
    lang: 'fr',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: BRAND_NAVY,
    theme_color: BRAND_NAVY,
    categories: ['shopping', 'business'],
    icons: [
      { src: BRAND.icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: BRAND.icon, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: BRAND.iconMaskable, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Catalogue',
        short_name: 'Catalogue',
        description: 'Parcourir les rayons et les produits',
        url: '/catalogue',
        icons: [{ src: BRAND.icon192, sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Mon panier',
        short_name: 'Panier',
        description: 'Voir le panier et commander',
        url: '/panier',
        icons: [{ src: BRAND.icon192, sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Suivre ma commande',
        short_name: 'Suivi',
        description: 'État d’une commande avec son numéro',
        url: '/suivi',
        icons: [{ src: BRAND.icon192, sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
