import Link from 'next/link';
import { SearchX, Home, LayoutGrid, LifeBuoy } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export default function NotFound() {
  return (
    <>
    <SiteHeader />
    <div className="container-page flex min-h-[60vh] max-w-2xl flex-col items-center justify-center py-12 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-navy-50 text-navy-400">
        <SearchX className="size-8" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">Page introuvable</h1>
      <p className="mt-2 max-w-md text-sm text-navy-600">
        Cette adresse n’existe pas ou le produit n’est plus disponible. Le catalogue évolue souvent : relancez une recherche ou
        parcourez les rayons.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-600"
        >
          <Home className="size-4" aria-hidden /> Accueil
        </Link>
        <Link
          href="/catalogue"
          className="inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-800 hover:border-navy-300"
        >
          <LayoutGrid className="size-4" aria-hidden /> Catalogue
        </Link>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-800 hover:border-navy-300"
        >
          <LifeBuoy className="size-4" aria-hidden /> Nous contacter
        </Link>
      </div>
      <p className="mt-6 text-xs text-navy-500">
        Vous cherchiez une commande ?{' '}
        <Link href="/suivi" className="font-semibold text-accent-700 underline">Utilisez le suivi de commande</Link>.
      </p>
    </div>
    <SiteFooter />
    </>
  );
}
