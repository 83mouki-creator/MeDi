import type { Metadata, Viewport } from 'next';
import './globals.css';
import { env } from '@/lib/env';
import { PwaRegister } from '@/components/pwa-register';
import { BRAND, BRAND_NAVY, STORE_NAME, STORE_TAGLINE, STORE_TAGLINE_SHORT } from '@/lib/brand';

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: `${STORE_NAME} — ${STORE_TAGLINE_SHORT}`,
    template: `%s | ${STORE_NAME}`,
  },
  description:
    `${STORE_NAME} — ${STORE_TAGLINE} Outillage professionnel, matériaux de construction, ` +
    'équipement de la maison et électroménager à Daloa. Prix en FCFA, paiement Wave et livraison à domicile.',
  applicationName: STORE_NAME,
  keywords: [
    'Perokado',
    'quincaillerie Daloa',
    'outillage Côte d’Ivoire',
    'matériaux construction Daloa',
    'électroménager Daloa',
    STORE_TAGLINE_SHORT,
  ],
  openGraph: {
    type: 'website',
    locale: 'fr_CI',
    siteName: STORE_NAME,
    title: `${STORE_NAME} — ${STORE_TAGLINE_SHORT}`,
    description: `${STORE_TAGLINE} Outillage, matériaux de construction et équipement de la maison, livrés à domicile.`,
    images: [{ url: BRAND.ogImage, width: 1200, height: 630, alt: `${STORE_NAME} — ${STORE_TAGLINE}` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${STORE_NAME} — ${STORE_TAGLINE_SHORT}`,
    description: `${STORE_TAGLINE} Outillage, matériaux de construction et équipement de la maison, livrés à domicile.`,
    images: [BRAND.ogImage],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: BRAND.favicon, sizes: '32x32', type: 'image/png' },
      { url: BRAND.icon192, sizes: '192x192', type: 'image/png' },
      { url: BRAND.icon, sizes: '512x512', type: 'image/png' },
    ],
    shortcut: [{ url: BRAND.favicon }],
    apple: [{ url: BRAND.appleTouchIcon, sizes: '180x180', type: 'image/png' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: BRAND_NAVY,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // La boutique est en français uniquement : ni cookie de langue, ni affichage
  // de droite à gauche. L'administration impose elle aussi le français.
  return (
    <html lang="fr-CI" dir="ltr">
      <body className="min-h-dvh bg-white font-sans text-navy-900 antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
