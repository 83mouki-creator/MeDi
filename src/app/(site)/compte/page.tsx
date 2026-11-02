import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, LayoutDashboard, Package } from 'lucide-react';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { listUserOrders } from '@/lib/orders';
import { type OrderStatus } from '@/lib/order-status';
import { getSiteI18n } from '@/lib/i18n/site-server';
import { siteOrderStatusLabel } from '@/lib/i18n/order-labels';
import { formatDate, formatFCFA } from '@/lib/utils';
import { Badge, Card } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Mon compte', robots: { index: false, follow: false } };

export default async function AccountOverview() {
  const user = await getCurrentUser();
  if (!user) redirect('/connexion');
  const orders = await listUserOrders(user.id);
  const { t } = await getSiteI18n();

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="text-lg font-bold">{t('Bonjour {name}', { name: user.firstName ?? '' })}</h2>
        <p className="mt-1 text-sm text-navy-600">
          {t('Retrouvez ici l’historique de vos commandes, vos adresses et vos informations personnelles.')}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Link href="/compte/commandes" className="rounded-lg border border-navy-100 p-3 hover:border-accent-300 hover:bg-accent-50/40">
            <p className="text-2xl font-extrabold">{orders.length}</p>
            <p className="text-xs text-navy-600">{t('Commande(s) passée(s)')}</p>
          </Link>
          <Link href="/suivi" className="rounded-lg border border-navy-100 p-3 hover:border-accent-300 hover:bg-accent-50/40">
            <p className="text-sm font-semibold">{t('Suivre une commande')}</p>
            <p className="text-xs text-navy-600">{t('Par numéro de commande')}</p>
          </Link>
          <Link href="/catalogue" className="rounded-lg border border-navy-100 p-3 hover:border-accent-300 hover:bg-accent-50/40">
            <p className="text-sm font-semibold">{t('Reprendre mes achats')}</p>
            <p className="text-xs text-navy-600">{t('Parcourir le catalogue')}</p>
          </Link>
        </div>
      </Card>

      {isStaff(user.role) ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-accent-200 bg-accent-50 p-4">
          <div>
            <p className="text-sm font-bold text-navy-900">{t('Espace administration')}</p>
            <p className="text-xs text-navy-600">{t('Produits, stock, commandes, paiements et réglages de la boutique.')}</p>
          </div>
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-bold text-navy-950 hover:bg-accent-400"
          >
            <LayoutDashboard className="size-4" aria-hidden /> {t('Ouvrir l’administration')}
          </Link>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-navy-100 bg-navy-50 px-4 py-2.5">
          <h2 className="text-sm font-bold">{t('Dernières commandes')}</h2>
          <Link href="/compte/commandes" className="text-xs font-semibold text-accent-700 hover:underline">{t('Tout voir')}</Link>
        </div>
        {orders.length === 0 ? (
          <div className="p-6 text-center">
            <Package className="mx-auto size-8 text-navy-300" aria-hidden />
            <p className="mt-2 text-sm text-navy-600">{t('Aucune commande pour le moment.')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-navy-100">
            {orders.slice(0, 5).map((order) => (
              <li key={order.id}>
                <Link href={`/compte/commandes/${order.number}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-navy-50">
                  <div>
                    <p className="font-mono text-sm font-semibold">{order.number}</p>
                    <p className="text-xs text-navy-500">{formatDate(order.createdAt)} · {order.city}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={order.status === 'DELIVERED' ? 'success' : order.status === 'CANCELLED' ? 'danger' : 'neutral'}>
                      {siteOrderStatusLabel(t, order.status as OrderStatus)}
                    </Badge>
                    <span className="text-sm font-bold">{formatFCFA(order.total)}</span>
                    <ArrowRight className="size-4 text-navy-400 rtl:rotate-180" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
