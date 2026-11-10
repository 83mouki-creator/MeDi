import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Les images produits sont servies en WebP optimisé depuis notre stockage.
  images: {
    formats: ['image/webp'],
    // Les vignettes du catalogue portent un suffixe de version (`?v=<empreinte>`) :
    // sans lui, une photo remplacée au même chemin garderait la même clé dans le
    // cache d'images et les visiteurs verraient l'ancienne. Next exige que ces
    // requêtes soient déclarées ici.
    localPatterns: [
      { pathname: '/catalogue/**' },
      { pathname: '/uploads/**' },
      { pathname: '/brand/**' },
    ],
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  experimental: {
    serverActions: {
      // Téléversement d'images produit (5 Mio) + marge multipart.
      bodySizeLimit: '8mb',
    },
  },
  async headers() {
    return [
      {
        // Vérification du domaine par Android : ce fichier autorise l'application
        // Play Store à ouvrir le site en plein écran, sans barre d'adresse.
        // Il est produit par `npm run assetlinks` (voir docs/ANDROID.md).
        source: '/.well-known/assetlinks.json',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
      {
        // Le service worker doit être revalidé à chaque visite, sinon une ancienne
        // version reste active pendant des jours sur les téléphones.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
        ],
      },
    ];
  },
};

export default nextConfig;
