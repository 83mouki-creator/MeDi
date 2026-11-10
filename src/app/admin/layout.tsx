import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentUser, isStaff, can, type Permission } from '@/lib/auth';
import { countContactMessages, expiringPaymentsCount } from '@/lib/admin';
import { pendingReviewCount } from '@/lib/reviews';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { AdminTopBar, type AdminNavItem } from '@/components/admin/admin-top-bar';
import { AdminI18nProvider } from '@/components/admin/admin-i18n';
import { BRAND, STORE_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Administration ${STORE_NAME}`,
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** Libellé bilingue : la clé française sert de référence au dictionnaire. */
const NAV: (AdminNavItem & { permission?: Permission })[] = [
  { href: '/admin', label: 'Accueil', hint: 'Ce qui se passe aujourd’hui', icon: 'dashboard' },
  { href: '/admin/guide', label: 'Guide du site', hint: 'Comment utiliser la boutique, pas à pas', icon: 'guide' },
  { href: '/admin/pret-a-vendre', label: 'Prêt à vendre', hint: 'Ce qui manque pour vendre', icon: 'ready', permission: 'settings.write' },
  { href: '/admin/commandes', label: 'Commandes', hint: 'Qui a commandé quoi', icon: 'orders', permission: 'orders.read' },
  { href: '/admin/messages', label: 'Messages des clients', hint: 'Questions et demandes', icon: 'messages', permission: 'messages.handle', badge: 'messages' },
  { href: '/admin/avis', label: 'Avis clients', hint: 'Notes sur les produits et la livraison', icon: 'reviews', permission: 'messages.handle', badge: 'reviews' },
  { href: '/admin/paiements', label: 'Encaissements', hint: 'Vérifier l’argent reçu', icon: 'payments', permission: 'payments.read', badge: 'payments' },
  { href: '/admin/produits', label: 'Produits', hint: 'Fiches, prix et photos', icon: 'products', permission: 'products.read' },
  { href: '/admin/stock', label: 'Stock', hint: 'Combien il en reste', icon: 'stock', permission: 'products.read' },
  { href: '/admin/promotions', label: 'Promotions', hint: 'Baisser les prix pour un temps', icon: 'promos', permission: 'products.write' },
  { href: '/admin/stickers', label: 'Stickers', hint: 'Garantie, réduction sur les produits', icon: 'stickers', permission: 'products.write' },
  { href: '/admin/caisse', label: 'Caisse', hint: 'Ouvrir et fermer la journée', icon: 'cash', permission: 'payments.read' },
  { href: '/admin/bons', label: 'Bons de livraison', hint: 'Papiers à donner au livreur', icon: 'notes', permission: 'delivery.manage' },
  { href: '/admin/categories', label: 'Rayons et marques', hint: 'Ranger les produits', icon: 'categories', permission: 'products.write' },
  { href: '/admin/import', label: 'Photos et imports', hint: 'Ajouter en grand nombre', icon: 'import', permission: 'catalog.import' },
  { href: '/admin/expeditions', label: 'Expéditions', hint: 'Colis Express : envoyer et suivre les colis', icon: 'shipments', permission: 'delivery.manage' },
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

  const [{ t }, pendingPayments, messages, reviewsPending] = await Promise.all([
    getAdminI18n(),
    expiringPaymentsCount().catch(() => 0),
    countContactMessages().catch(() => ({ newCount: 0, open: 0, total: 0 })),
    pendingReviewCount().catch(() => 0),
  ]);

  const items: AdminNavItem[] = NAV.filter((item) => !item.permission || can(user.role, item.permission)).map(
    ({ href, label, icon, badge, hint }) => ({ href, label: t(label), icon, badge, hint: hint ? t(hint) : undefined }),
  );

  return (
    <AdminI18nProvider>
      <div lang="fr" dir="ltr" className="relative min-h-dvh bg-slate-100">
        {/*
          Emblème Perokado en filigrane : il habille l'espace de gestion sans gêner la
          lecture (4,5 % d'opacité, jamais cliquable, jamais imprimé).
        */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 bg-center bg-no-repeat opacity-[0.045] print:hidden"
          style={{ backgroundImage: `url('${BRAND.emblem3d}')`, backgroundSize: 'min(72vw, 540px)' }}
        />
        <div className="relative z-10">
        <AdminTopBar
          items={items}
          role={t(user.role)}
          task={user.staffTask ? t(user.staffTask) : null}
          email={user.email}
          pendingPayments={pendingPayments}
          newMessages={messages.newCount}
          pendingReviews={reviewsPending}
        />
        <main className="container-page py-5">{children}</main>
        </div>
      </div>
    </AdminI18nProvider>
  );
}
