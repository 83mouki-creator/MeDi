import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  Download,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Users,
} from 'lucide-react';
import type { Metadata } from 'next';
import { getCurrentUser, isStaff, can, type Permission } from '@/lib/auth';
import { expiringPaymentsCount } from '@/lib/admin';
import { logoutAction } from '@/app/actions/auth';
import { Badge } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'Administration MeDi',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const NAV: { href: string; label: string; icon: typeof LayoutDashboard; permission?: Permission; badge?: 'payments' }[] = [
  { href: '/admin', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/admin/commandes', label: 'Commandes', icon: ClipboardList, permission: 'orders.read' },
  { href: '/admin/paiements', label: 'Paiements à vérifier', icon: CreditCard, permission: 'orders.read', badge: 'payments' },
  { href: '/admin/produits', label: 'Produits', icon: Package, permission: 'products.read' },
  { href: '/admin/stock', label: 'Stock', icon: Boxes, permission: 'products.read' },
  { href: '/admin/categories', label: 'Catégories & marques', icon: ShoppingBag, permission: 'products.write' },
  { href: '/admin/import', label: 'Import catalogue & photos', icon: Download, permission: 'products.write' },
  { href: '/admin/livraison', label: 'Livraison', icon: Truck, permission: 'settings.write' },
  { href: '/admin/parametres', label: 'Paramètres boutique', icon: Settings, permission: 'settings.write' },
  { href: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users, permission: 'users.manage' },
  { href: '/admin/journal', label: 'Journal d’activité', icon: ShieldCheck, permission: 'audit.read' },
  { href: '/admin/statistiques', label: 'Statistiques', icon: BarChart3, permission: 'orders.read' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/connexion?redirectTo=/admin');
  if (!isStaff(user.role)) redirect('/compte');

  const pendingPayments = await expiringPaymentsCount().catch(() => 0);
  const visible = NAV.filter((item) => !item.permission || can(user.role, item.permission));

  return (
    <div className="bg-slate-100">
      <div className="border-b border-navy-800 bg-navy-950 text-white">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm font-extrabold tracking-tight">
              MeDi <span className="font-normal text-navy-300">/ administration</span>
            </Link>
            <Badge tone="accent">{user.role}</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link href="/" className="text-navy-200 hover:text-white">Voir la boutique</Link>
            <span className="text-navy-500">·</span>
            <span className="text-navy-200">{user.email}</span>
            <form action={logoutAction}>
              <button type="submit" className="inline-flex items-center gap-1 text-navy-200 hover:text-white">
                <LogOut className="size-3.5" aria-hidden /> Déconnexion
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="container-page grid gap-5 py-5 lg:grid-cols-[230px_1fr]">
        <aside>
          <nav aria-label="Navigation administration" className="rounded-xl border border-navy-100 bg-white p-2">
            <ul className="space-y-0.5">
              {visible.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link href={item.href} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-navy-700 hover:bg-navy-50">
                      <Icon className="size-4 text-navy-400" aria-hidden />
                      <span className="flex-1">{item.label}</span>
                      {item.badge === 'payments' && pendingPayments > 0 ? (
                        <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{pendingPayments}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <p className="mt-3 px-1 text-[11px] leading-relaxed text-navy-500">
            Les actions sensibles (confirmation de paiement, prix, stock) sont journalisées avec l’identité de l’opérateur.
          </p>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
