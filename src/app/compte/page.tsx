import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Package } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { listUserOrders } from '@/lib/orders';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/order-status';
import { formatDate, formatFCFA } from '@/lib/utils';
import { Badge, Card } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Mon compte', robots: { index: false, follow: false } };

export default async function AccountOverview() {
  const user = await getCurrentUser();
  if (!user) redirect('/connexion');
  const orders = await listUserOrders(user.id);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="text-lg font-bold">Bonjour {user.firstName ?? ''}</h2>
        <p className="mt-1 text-sm text-navy-600">
          Retrouvez ici l&apos;historique de vos commandes, vos adresses et vos informations personnelles.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Link href="/compte/commandes" className="rounded-lg border border-navy-100 p-3 hover:border-accent-300 hover:bg-accent-50/40">
            <p className="text-2xl font-extrabold">{orders.length}</p>
            <p className="text-xs text-navy-600">Commande(s) passée(s)</p>
          </Link>
          <Link href="/suivi" className="rounded-lg border border-navy-100 p-3 hover:border-accent-300 hover:bg-accent-50/40">
            <p className="text-sm font-semibold">Suivre une commande</p>
            <p className="text-xs text-navy-600">Par numéro de commande</p>
          </Link>
          <Link href="/catalogue" className="rounded-lg border border-navy-100 p-3 hover:border-accent-300 hover:bg-accent-50/40">
            <p className="text-sm font-semibold">Reprendre mes achats</p>
            <p className="text-xs text-navy-600">Parcourir le catalogue</p>
          </Link>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-navy-100 bg-navy-50 px-4 py-2.5">
          <h2 className="text-sm font-bold">Dernières commandes</h2>
          <Link href="/compte/commandes" className="text-xs font-semibold text-accent-700 hover:underline">Tout voir</Link>
        </div>
        {orders.length === 0 ? (
          <div className="p-6 text-center">
            <Package className="mx-auto size-8 text-navy-300" aria-hidden />
            <p className="mt-2 text-sm text-navy-600">Aucune commande pour le moment.</p>
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
                      {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                    </Badge>
                    <span className="text-sm font-bold">{formatFCFA(order.total)}</span>
                    <ArrowRight className="size-4 text-navy-400" aria-hidden />
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
