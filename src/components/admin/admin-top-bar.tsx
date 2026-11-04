'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  Boxes,
  ClipboardList,
  CreditCard,
  Download,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tags,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';
import { setAdminLocaleAction } from '@/app/actions/admin-locale';
import { useAdminI18n } from '@/components/admin/admin-i18n';
import { cn } from '@/lib/utils';
import { drawerGeometry } from '@/lib/drawer';
import type { AdminLocale } from '@/lib/i18n/admin';

export type AdminNavItem = {
  href: string;
  label: string;
  icon:
    | 'dashboard'
    | 'orders'
    | 'payments'
    | 'messages'
    | 'products'
    | 'stock'
    | 'categories'
    | 'import'
    | 'delivery'
    | 'settings'
    | 'users'
    | 'audit'
    | 'stats'
    | 'promos'
    | 'cash'
    | 'notes'
    | 'guide'
    | 'ready';
  badge?: 'payments' | 'messages';
  /** Petite phrase qui explique le menu en mots simples. */
  hint?: string;
};

const ICONS = {
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  payments: CreditCard,
  messages: MessageSquare,
  products: Package,
  stock: Boxes,
  categories: ShoppingBag,
  import: Download,
  delivery: Truck,
  settings: Settings,
  users: Users,
  audit: ShieldCheck,
  stats: BarChart3,
  promos: Tags,
  cash: Wallet,
  notes: Truck,
  guide: BookOpen,
  ready: BadgeCheck,
} as const;

/** Bascule FR / AR, mémorisée par cookie et propre au back-office. */
function LocaleSwitcher({ locale }: { locale: AdminLocale }) {
  const { t } = useAdminI18n();
  const pathname = usePathname();
  const target: AdminLocale = locale === 'ar' ? 'fr' : 'ar';

  return (
    <form action={setAdminLocaleAction} className="shrink-0">
      <input type="hidden" name="locale" value={target} />
      <input type="hidden" name="next" value={pathname} />
      <button
        type="submit"
        lang={target}
        dir={target === 'ar' ? 'rtl' : 'ltr'}
        title={t('Changer de langue')}
        aria-label={`${t('Changer de langue')} — ${target === 'ar' ? 'العربية' : 'Français'}`}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-semibold text-navy-100 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
      >
        <Languages className="size-4" aria-hidden />
        <span className="text-xs">{target === 'ar' ? 'العربية' : 'Français'}</span>
      </button>
    </form>
  );
}

/**
 * Barre supérieure de l'administration.
 *
 * Toute la navigation est repliée derrière la puce à trois traits : un panneau
 * coulissant s'ouvre par-dessus la page. Aucun onglet n'est affiché en
 * permanence, sur mobile comme sur ordinateur.
 *
 * En arabe, la mise en page passe en RTL : le panneau s'ouvre depuis la droite
 * et les icônes directionnelles sont inversées.
 */
export function AdminTopBar({
  items,
  role,
  task,
  email,
  pendingPayments,
  newMessages,
  locale,
  dir,
}: {
  items: AdminNavItem[];
  role: string;
  /** Tâche assignée par l'administrateur (facultative). */
  task?: string | null;
  email: string;
  pendingPayments: number;
  newMessages: number;
  locale: AdminLocale;
  dir: 'ltr' | 'rtl';
}) {
  const { t } = useAdminI18n();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  // Fermeture au clavier + blocage du défilement de la page derrière le panneau.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  // Un changement de page referme le panneau.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

  // Ancrage et glissade en coordonnées physiques : voir `lib/drawer`.
  const geometry = drawerGeometry(dir);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-navy-800 bg-navy-950 text-white">
        <div className="container-page flex items-center gap-2 py-2.5 sm:gap-3">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="menu-administration"
            aria-label={t('Ouvrir le menu de l’administration')}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            <span className="hidden sm:inline">{t('Menu')}</span>
            {pendingPayments > 0 && !open ? (
              <span className="grid min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[11px] font-bold text-navy-950">
                {pendingPayments}
              </span>
            ) : null}
          </button>

          <Link href="/admin" className="flex items-baseline gap-2 text-sm font-extrabold tracking-tight">
            {t('MeDi Shop')} <span className="hidden font-normal text-navy-300 sm:inline">/ {t('Administration')}</span>
          </Link>

          <span className="hidden rounded-full bg-accent-500/15 px-2 py-0.5 text-[11px] font-semibold text-accent-200 md:inline">
            {role}
          </span>
          {task ? (
            <span className="hidden rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-navy-100 lg:inline">
              {task}
            </span>
          ) : null}

          <div className="ms-auto flex items-center gap-1 text-xs sm:gap-2">
            <LocaleSwitcher locale={locale} />
            <Link
              href="/admin/guide"
              title={t('Comment utiliser le site')}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-semibold text-navy-100 hover:bg-white/10 hover:text-white"
            >
              <BookOpen className="size-4" aria-hidden /> <span className="hidden lg:inline">{t('Guide')}</span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-semibold text-navy-100 hover:bg-white/10 hover:text-white"
            >
              <Store className="size-4" aria-hidden /> <span className="hidden lg:inline">{t('Voir la boutique')}</span>
            </Link>
            <span className="hidden text-navy-400 xl:inline" dir="ltr">
              {email}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label={t('Déconnexion')}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-semibold text-navy-100 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />{' '}
                <span className="hidden lg:inline">{t('Déconnexion')}</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Voile : masqué et inerte dès que le panneau est fermé. */}
      <div onClick={close} aria-hidden className="drawer-veil" data-open={open} />

      {/* Panneau coulissant — ouvert depuis la gauche en français, la droite en arabe */}
      <div
        id="menu-administration"
        ref={panelRef}
        role="dialog"
        aria-modal={open ? true : undefined}
        aria-label={t('Navigation de l’administration')}
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
        data-side={geometry.side}
        data-open={open}
        className="drawer-panel w-[min(20rem,85vw)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3">
          <p className="text-sm font-extrabold text-navy-950">{t('Administration')}</p>
          <button
            type="button"
            onClick={close}
            aria-label={t('Fermer le menu')}
            className="grid size-9 place-items-center rounded-lg text-navy-500 hover:bg-navy-50 hover:text-navy-900"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-0.5">
            {items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium',
                      active ? 'bg-accent-50 text-accent-800 ring-1 ring-accent-200' : 'text-navy-700 hover:bg-navy-50',
                    )}
                  >
                    <Icon className={cn('size-4 shrink-0', active ? 'text-accent-600' : 'text-navy-400')} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block">{item.label}</span>
                      {item.hint ? (
                        <span className={cn('block text-[11px] font-normal', active ? 'text-accent-700' : 'text-navy-500')}>
                          {item.hint}
                        </span>
                      ) : null}
                    </span>
                    {item.badge === 'payments' && pendingPayments > 0 ? (
                      <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold text-navy-950">
                        {pendingPayments}
                      </span>
                    ) : null}
                    {item.badge === 'messages' && newMessages > 0 ? (
                      <span className="rounded-full bg-navy-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {newMessages}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-navy-100 p-3">
          <Link
            href="/admin/guide"
            onClick={close}
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-accent-800 hover:bg-accent-50"
          >
            <BookOpen className="size-4 text-accent-600" aria-hidden /> {t('Comment utiliser le site')}
          </Link>
          <Link
            href="/"
            onClick={close}
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-navy-700 hover:bg-navy-50"
          >
            <Store className="size-4 text-navy-400" aria-hidden /> {t('Voir la boutique')}
          </Link>
          <p className="mt-2 px-1 text-[11px] leading-relaxed text-navy-500">
            {t('Les actions sensibles (prix, stock, paiement) sont journalisées avec l’identité de l’opérateur.')}
          </p>
        </div>
      </div>
    </>
  );
}
