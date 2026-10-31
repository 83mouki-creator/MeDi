import Link from 'next/link';
import Image from 'next/image';
import { Camera, ChevronDown, LayoutDashboard, MapPin, Menu, Phone, ShoppingCart, Truck, User } from 'lucide-react';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { readCart } from '@/lib/cart';
import { getStoreSettings, whatsappLink } from '@/lib/settings';
import { getCategoryTree } from '@/lib/catalog';
import { SearchBar } from './search-bar';

const FALLBACK_CATEGORIES = [
  { slug: 'outillage-industriel', name: 'Outillage industriel' },
  { slug: 'materiel-de-construction', name: 'Construction' },
  { slug: 'quincaillerie', name: 'Quincaillerie' },
  { slug: 'electromenager', name: 'Électroménager' },
  { slug: 'maison-interieur-exterieur', name: 'Maison' },
  { slug: 'equipements-techniques', name: 'Équipements techniques' },
];

export async function SiteHeader() {
  const [settings, user, cart, tree] = await Promise.all([
    getStoreSettings(),
    getCurrentUser(),
    readCart(),
    getCategoryTree().catch(() => ({ roots: [], childrenOf: () => [], all: [] })),
  ]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const roots = tree.roots.length > 0 ? tree.roots : FALLBACK_CATEGORIES.map((c, i) => ({ ...c, id: c.slug, productCount: 0, position: i, parentId: null, imageUrl: null }));
  const whatsapp = whatsappLink(settings);

  return (
    <header className="sticky top-0 z-40 border-b border-navy-800 bg-navy-950 text-white">
      {/* Bandeau d'information */}
      <div className="hidden bg-navy-900 text-[12px] text-navy-100 md:block">
        <div className="container-page flex h-9 items-center justify-between gap-4">
          <p className="flex items-center gap-2">
            <MapPin className="size-3.5 text-accent-400" aria-hidden />
            Retrait en boutique à {settings.city} · Livraison locale et expédition dans toute la Côte d&apos;Ivoire
          </p>
          <div className="flex items-center gap-4">
            {settings.phone ? (
              <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="flex items-center gap-1.5 hover:text-white">
                <Phone className="size-3.5" aria-hidden /> {settings.phone}
              </a>
            ) : null}
            <Link href="/livraison" className="flex items-center gap-1.5 hover:text-white">
              <Truck className="size-3.5" aria-hidden /> Livraison
            </Link>
            <Link href="/suivi" className="hover:text-white">
              Suivre ma commande
            </Link>
          </div>
        </div>
      </div>

      {/* Barre principale */}
      <div className="container-page flex flex-wrap items-center gap-3 py-3 lg:gap-6">
        <Link href="/" className="flex shrink-0 items-center" aria-label="MeDi — accueil">
          <Image src="/brand/medi-logo-horizontal-blanc.png" alt="MeDi" width={703} height={200} priority className="h-11 w-auto lg:h-12" />
        </Link>

        <div className="order-3 w-full lg:order-2 lg:flex-1">
          <SearchBar />
        </div>

        <div className="order-2 ml-auto flex items-center gap-1 lg:order-3 lg:gap-2">
          <Link
            href="/recherche-visuelle"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-navy-100 hover:bg-navy-800 hover:text-white lg:hidden"
            aria-label="Rechercher par photo"
          >
            <Camera className="size-5" aria-hidden />
          </Link>

          <Link
            href={user ? '/compte' : '/connexion'}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-navy-100 hover:bg-navy-800 hover:text-white"
          >
            <User className="size-5" aria-hidden />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-[11px] text-navy-300">{user ? 'Bonjour' : 'Compte'}</span>
              <span className="block font-semibold text-white">{user ? (user.firstName ?? 'Mon compte') : 'Connexion'}</span>
            </span>
          </Link>

          <Link
            href="/panier"
            className="relative flex items-center gap-2 rounded-lg bg-accent-500 px-3 py-2 text-sm font-semibold text-white hover:bg-accent-600"
            aria-label={`Panier, ${cartCount} article(s)`}
          >
            <ShoppingCart className="size-5" aria-hidden />
            <span className="hidden sm:inline">Panier</span>
            {cartCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold text-accent-700 ring-2 ring-navy-950">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            ) : null}
          </Link>

          {/*
            Bouton d'administration : visible en permanence pour les comptes de la
            boutique (propriétaire, admin, stock, commandes), jamais pour un visiteur
            ni pour un client. Il occupe l'angle supérieur droit de la barre.
          */}
          {isStaff(user?.role) ? (
            <Link
              href="/admin"
              aria-label="Administration de la boutique"
              title="Administration de la boutique"
              className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-extrabold text-navy-950 shadow-sm ring-1 ring-white/60 hover:bg-accent-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
            >
              <LayoutDashboard className="size-5 text-accent-600" aria-hidden />
              <span className="hidden sm:inline">Administration</span>
              <span className="sm:hidden">Admin</span>
            </Link>
          ) : null}
        </div>
      </div>

      {/* Navigation par catégories */}
      <nav aria-label="Catégories" className="border-t border-navy-800 bg-navy-900">
        <div className="container-page flex items-center gap-1">
          <details className="group relative lg:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-2.5 text-sm font-semibold text-white">
              <Menu className="size-5" aria-hidden />
              Catégories
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="absolute left-0 z-50 mt-1 w-72 rounded-xl border border-navy-100 bg-white p-2 text-navy-900 shadow-xl">
              <ul className="max-h-[70vh] overflow-y-auto">
                {roots.map((category) => (
                  <li key={category.id}>
                    <Link href={`/categorie/${category.slug}`} className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-navy-50">
                      {category.name}
                    </Link>
                  </li>
                ))}
                <li className="mt-1 border-t border-navy-100 pt-1">
                  <Link href="/catalogue" className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-accent-700 hover:bg-navy-50">
                    Tout le catalogue
                  </Link>
                </li>
              </ul>
            </div>
          </details>

          <ul className="no-scrollbar hidden items-center gap-0.5 overflow-x-auto lg:flex">
            {roots.slice(0, 8).map((category) => (
              <li key={category.id} className="shrink-0">
                <Link
                  href={`/categorie/${category.slug}`}
                  className="block whitespace-nowrap px-3 py-2.5 text-[13px] font-medium text-navy-100 hover:bg-navy-800 hover:text-white"
                >
                  {category.name}
                </Link>
              </li>
            ))}
            <li className="shrink-0">
              <Link href="/catalogue?promo=1" className="block whitespace-nowrap px-3 py-2.5 text-[13px] font-semibold text-accent-300 hover:bg-navy-800">
                Promotions
              </Link>
            </li>
          </ul>

          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto hidden items-center gap-1.5 py-2.5 text-[13px] font-semibold text-emerald-300 hover:text-emerald-200 lg:flex"
            >
              Besoin d&apos;aide ? WhatsApp
            </a>
          ) : (
            <Link href="/contact" className="ml-auto hidden py-2.5 text-[13px] font-semibold text-navy-200 hover:text-white lg:block">
              Besoin d&apos;aide ?
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
