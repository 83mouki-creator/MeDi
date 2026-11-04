import Link from 'next/link';
import Image from 'next/image';
import { Camera, MapPin, Phone, ShoppingCart, Truck, User } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { readCart } from '@/lib/cart';
import { getStoreSettings, whatsappLink } from '@/lib/settings';
import { countActivePromotions, getCategoryTree } from '@/lib/catalog';
import { getSiteI18n } from '@/lib/i18n/site-server';
import { SearchBar } from './search-bar';
import { SiteLocaleSelector } from './site-locale-selector';
import { PromoBanner } from './promo-banner';
import { SiteCategoryMenu } from './site-category-menu';

const FALLBACK_CATEGORIES = [
  { slug: 'outillage-industriel', name: 'Outillage industriel' },
  { slug: 'materiel-de-construction', name: 'Construction' },
  { slug: 'quincaillerie', name: 'Quincaillerie' },
  { slug: 'electromenager', name: 'Électroménager' },
  { slug: 'maison-interieur-exterieur', name: 'Maison' },
  { slug: 'equipements-techniques', name: 'Équipements techniques' },
];

export async function SiteHeader() {
  const [settings, user, cart, tree, promoCount, { t }] = await Promise.all([
    getStoreSettings(),
    getCurrentUser(),
    readCart(),
    getCategoryTree().catch(() => ({ roots: [], childrenOf: () => [], all: [] })),
    countActivePromotions().catch(() => 0),
    getSiteI18n(),
  ]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const roots = tree.roots.length > 0 ? tree.roots : FALLBACK_CATEGORIES.map((c, i) => ({ ...c, id: c.slug, productCount: 0, position: i, parentId: null, imageUrl: null }));
  const whatsapp = whatsappLink(
    settings,
    settings.whatsapp
      ? 'Bonjour MeDi, je souhaite des informations sur un produit.'
      : undefined,
  );

  return (
    <header className="sticky top-0 z-40 border-b border-navy-800 bg-navy-950 text-white">
      {/* Bandeau d'information */}
      <div className="hidden bg-navy-900 text-[12px] text-navy-100 md:block">
        <div className="container-page flex h-9 items-center justify-between gap-4">
          <p className="flex items-center gap-2">
            <MapPin className="size-3.5 shrink-0 text-accent-400" aria-hidden />
            {t('Retrait en boutique à {city} · Livraison à Daloa et expédition dans toute la Côte d’Ivoire', { city: settings.city })}
          </p>
          <div className="flex items-center gap-4">
            {settings.phone ? (
              <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="flex items-center gap-1.5 hover:text-white">
                <Phone className="size-3.5" aria-hidden /> {settings.phone}
              </a>
            ) : null}
            <Link href="/livraison" className="flex items-center gap-1.5 hover:text-white">
              <Truck className="size-3.5" aria-hidden /> {t('Livraison')}
            </Link>
            <Link href="/suivi" className="hover:text-white">
              {t('Suivre ma commande')}
            </Link>
            <SiteLocaleSelector tone="dark" />
          </div>
        </div>
      </div>

      {/* Barre principale */}
      <div className="container-page flex flex-wrap items-center gap-3 py-3 lg:gap-6">
        <Link href="/" className="flex shrink-0 items-center" aria-label={t('MeDi — accueil')}>
          <Image src="/brand/medi-logo-horizontal-blanc.png" alt="MeDi" width={703} height={200} priority className="h-11 w-auto lg:h-12" />
        </Link>

        <div className="order-3 w-full lg:order-2 lg:flex-1">
          <SearchBar />
        </div>

        <div className="order-2 ms-auto flex items-center gap-1 lg:order-3 lg:gap-2">
          <SiteLocaleSelector tone="dark" className="md:hidden" />

          <Link
            href="/recherche-visuelle"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-navy-100 hover:bg-navy-800 hover:text-white lg:hidden"
            aria-label={t('Rechercher par photo')}
          >
            <Camera className="size-5" aria-hidden />
          </Link>

          <Link
            href={user ? '/compte' : '/connexion'}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-navy-100 hover:bg-navy-800 hover:text-white"
          >
            <User className="size-5" aria-hidden />
            <span className="hidden text-start leading-tight sm:block">
              <span className="block text-[11px] text-navy-300">{user ? t('Bonjour') : t('Compte')}</span>
              <span className="block font-semibold text-white">{user ? (user.firstName ?? t('Mon compte')) : t('Connexion')}</span>
            </span>
          </Link>

          <Link
            href="/panier"
            className="relative flex items-center gap-2 rounded-lg bg-accent-500 px-3 py-2 text-sm font-bold text-navy-950 hover:bg-accent-400"
            aria-label={t('Panier, {count} article(s)', { count: cartCount })}
          >
            <ShoppingCart className="size-5" aria-hidden />
            <span className="hidden sm:inline">{t('Panier')}</span>
            {cartCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold text-accent-700 ring-2 ring-navy-950">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      {/* Bandeau de promotion (créé dans l'administration) */}
      <PromoBanner />

      {/* Navigation par catégories */}
      <nav aria-label={t('Catégories')} className="border-t border-navy-800 bg-navy-900">
        <div className="container-page flex items-center gap-1">
          <SiteCategoryMenu
            categories={roots.map((category) => ({ id: category.id, slug: category.slug, name: category.name }))}
          />

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
            {promoCount > 0 ? (
              <li className="shrink-0">
                <Link href="/catalogue?promo=1" className="block whitespace-nowrap px-3 py-2.5 text-[13px] font-semibold text-accent-300 hover:bg-navy-800">
                  {t('Promotions')}
                </Link>
              </li>
            ) : null}
          </ul>

          <div className="ms-auto flex shrink-0 items-center gap-3">
            <Link href="/nous-trouver" className="hidden py-2.5 text-[13px] font-semibold text-accent-300 hover:text-accent-200 lg:block">
              {t('Nous trouver')}
            </Link>
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-1.5 py-2.5 text-[13px] font-semibold text-emerald-300 hover:text-emerald-200 lg:flex"
              >
                {t('Besoin d’aide ? WhatsApp')}
              </a>
            ) : (
              <Link href="/contact" className="hidden py-2.5 text-[13px] font-semibold text-navy-200 hover:text-white lg:block">
                {t('Besoin d’aide ?')}
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
