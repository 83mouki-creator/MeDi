import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

/**
 * Habillage de la boutique : en-tête (recherche, catégories, panier) et pied de page.
 *
 * L'administration vit hors de ce groupe de routes : elle n'affiche donc ni
 * barre de recherche produits, ni panier, ni navigation par rayons.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
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
    </>
  );
}
