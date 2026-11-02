import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentUser, isStaff, can, type Permission } from '@/lib/auth';
import { countContactMessages, expiringPaymentsCount } from '@/lib/admin';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { AdminTopBar, type AdminNavItem } from '@/components/admin/admin-top-bar';
import { AdminI18nProvider } from '@/components/admin/admin-i18n';

export const metadata: Metadata = {
  title: 'Administration MeDi',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** Libellé bilingue : la clé française sert de référence au dictionnaire. */
const NAV: (AdminNavItem & { permission?: Permission })[] = [
  { href: '/admin', label: 'Accueil', hint: 'Ce qui se passe aujourd’hui', icon: 'dashboard' },
  { href: '/admin/commandes', label: 'Commandes', hint: 'Qui a commandé quoi', icon: 'orders', permission: 'orders.read' },
  { href: '/admin/messages', label: 'Messages des clients', hint: 'Questions et demandes', icon: 'messages', permission: 'messages.handle', badge: 'messages' },
  { href: '/admin/paiements', label: 'Encaissements', hint: 'Vérifier l’argent reçu', icon: 'payments', permission: 'payments.read', badge: 'payments' },
  { href: '/admin/produits', label: 'Produits', hint: 'Fiches, prix et photos', icon: 'products', permission: 'products.read' },
  { href: '/admin/stock', label: 'Stock', hint: 'Combien il en reste', icon: 'stock', permission: 'products.read' },
  { href: '/admin/categories', label: 'Rayons et marques', hint: 'Ranger les produits', icon: 'categories', permission: 'products.write' },
  { href: '/admin/import', label: 'Photos et imports', hint: 'Ajouter en grand nombre', icon: 'import', permission: 'catalog.import' },
  { href: '/admin/livraison', label: 'Livraisons', hint: 'Zones, frais, transporteurs', icon: 'delivery', permission: 'delivery.manage' },
  { href: '/admin/parametres', label: 'Réglages', hint: 'Téléphone, adresse, horaires', icon: 'settings', permission: 'settings.write' },
  { href: '/admin/utilisateurs', label: 'Comptes et accès', hint: 'Qui travaille ici et ce qu’il peut faire', icon: 'users', permission: 'users.manage' },
  { href: '/admin/journal', label: 'Historique', hint: 'Qui a fait quoi, en clair', icon: 'audit', permission: 'audit.read' },
  { href: '/admin/statistiques', label: 'Chiffres', hint: 'Ventes et tendances', icon: 'stats', permission: 'stats.read' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/connexion?redirectTo=/admin');
  if (!isStaff(user.role)) redirect('/compte');

  const [{ locale, dir, t }, pendingPayments, messages] = await Promise.all([
    getAdminI18n(),
    expiringPaymentsCount().catch(() => 0),
    countContactMessages().catch(() => ({ newCount: 0, open: 0, total: 0 })),
  ]);

  const items: AdminNavItem[] = NAV.filter((item) => !item.permission || can(user.role, item.permission)).map(
    ({ href, label, icon, badge, hint }) => ({ href, label: t(label), icon, badge, hint: hint ? t(hint) : undefined }),
  );

  return (
    <AdminI18nProvider locale={locale}>
      <div lang={locale} dir={dir} className="min-h-dvh bg-slate-100">
        <AdminTopBar
          items={items}
          role={t(user.role)}
          task={user.staffTask ? t(user.staffTask) : null}
          email={user.email}
          pendingPayments={pendingPayments}
          newMessages={messages.newCount}
          locale={locale}
          dir={dir}
        />
        <main className="container-page py-5">{children}</main>
      </div>
    </AdminI18nProvider>
  );
}
