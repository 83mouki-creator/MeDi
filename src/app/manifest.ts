import type { MetadataRoute } from 'next';

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
    name: 'MeDi Shop — Quincaillerie à Daloa',
    short_name: 'MeDi Shop',
    description:
      'Outillage, matériaux de construction, quincaillerie et équipement de la maison à Daloa. Prix en FCFA, retrait en boutique, livraison.',
    lang: 'fr',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: '#0b2545',
    theme_color: '#0b2545',
    categories: ['shopping', 'business'],
    icons: [
      { src: '/brand/medi-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/medi-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/medi-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Catalogue',
        short_name: 'Catalogue',
        description: 'Parcourir les rayons et les produits',
        url: '/catalogue',
        icons: [{ src: '/brand/medi-icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Mon panier',
        short_name: 'Panier',
        description: 'Voir le panier et commander',
        url: '/panier',
        icons: [{ src: '/brand/medi-icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Suivre ma commande',
        short_name: 'Suivi',
        description: 'État d’une commande avec son numéro',
        url: '/suivi',
        icons: [{ src: '/brand/medi-icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
