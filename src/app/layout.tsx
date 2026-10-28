import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { env } from '@/lib/env';

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: 'MeDi — Quincaillerie, outillage et équipement à Daloa',
    template: '%s | MeDi',
  },
  description:
    'MeDi, votre quincaillerie à Daloa : outillage professionnel, matériaux de construction, équipement maison et électroménager. Paiement Wave, retrait en boutique et livraison.',
  applicationName: 'MeDi',
  keywords: [
    'quincaillerie Daloa',
    'outillage Côte d’Ivoire',
    'matériaux construction Daloa',
    'électroménager Daloa',
    'MeDi',
  ],
  openGraph: {
    type: 'website',
    locale: 'fr_CI',
    siteName: 'MeDi',
    title: 'MeDi — Quincaillerie, outillage et équipement à Daloa',
    description:
      'Outillage professionnel, matériaux de construction et équipement de la maison. Commande en ligne, retrait à Daloa ou livraison.',
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: '/brand/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/brand/favicon.svg' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b2545',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr-CI">
      <body className="min-h-dvh bg-white font-sans text-navy-900 antialiased">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-navy-950 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Aller au contenu principal
        </a>
        <SiteHeader />
        <main id="contenu" className="min-h-[60vh]">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
