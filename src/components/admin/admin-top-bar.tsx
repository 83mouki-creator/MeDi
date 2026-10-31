'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  Download,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Menu,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

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
    | 'stats';
  badge?: 'payments' | 'messages';
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
} as const;

/**
 * Barre supérieure de l'administration.
 *
 * Toute la navigation est repliée derrière la puce à trois traits : un panneau
 * coulissant s'ouvre par-dessus la page. Aucun onglet n'est affiché en
 * permanence, sur mobile comme sur ordinateur.
 */
export function AdminTopBar({
  items,
  role,
  email,
  pendingPayments,
  newMessages,
}: {
  items: AdminNavItem[];
  role: string;
  email: string;
  pendingPayments: number;
  newMessages: number;
}) {
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

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-navy-800 bg-navy-950 text-white">
        <div className="container-page flex items-center gap-3 py-2.5">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="menu-administration"
            aria-label="Ouvrir le menu de l’administration"
            className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            <span className="hidden sm:inline">Menu</span>
            {pendingPayments > 0 && !open ? (
              <span className="grid min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[11px] font-bold text-white">
                {pendingPayments}
              </span>
            ) : null}
          </button>

          <Link href="/admin" className="flex items-baseline gap-2 text-sm font-extrabold tracking-tight">
            MeDi <span className="hidden font-normal text-navy-300 sm:inline">/ administration</span>
          </Link>

          <span className="ml-1 hidden rounded-full bg-accent-500/15 px-2 py-0.5 text-[11px] font-semibold text-accent-200 md:inline">
            {role}
          </span>

          <div className="ml-auto flex items-center gap-2 text-xs">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-semibold text-navy-100 hover:bg-white/10 hover:text-white"
            >
              <Store className="size-4" aria-hidden /> <span className="hidden sm:inline">Voir la boutique</span>
            </Link>
            <span className="hidden text-navy-400 md:inline">{email}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-semibold text-navy-100 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="size-4" aria-hidden /> <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Voile */}
      <div
        onClick={close}
        aria-hidden
        className={cn(
          'fixed inset-0 z-40 bg-navy-950/60 transition-opacity duration-200',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/* Panneau coulissant */}
      <div
        id="menu-administration"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation de l’administration"
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(20rem,85vw)] flex-col bg-white shadow-2xl transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3">
          <p className="text-sm font-extrabold text-navy-950">Administration</p>
          <button
            type="button"
            onClick={close}
            aria-label="Fermer le menu"
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
                    <Icon className={cn('size-4', active ? 'text-accent-600' : 'text-navy-400')} aria-hidden />
                    <span className="flex-1">{item.label}</span>
                    {item.badge === 'payments' && pendingPayments > 0 ? (
                      <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
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
            href="/"
            onClick={close}
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-navy-700 hover:bg-navy-50"
          >
            <Store className="size-4 text-navy-400" aria-hidden /> Voir la boutique
          </Link>
          <p className="mt-2 px-1 text-[11px] leading-relaxed text-navy-500">
            Les actions sensibles (prix, stock, paiement) sont journalisées avec l’identité de l’opérateur.
          </p>
        </div>
      </div>
    </>
  );
}
