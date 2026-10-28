import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { listUserOrders } from '@/lib/orders';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus } from '@/lib/order-status';
import { formatDateTime, formatFCFA } from '@/lib/utils';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Mes commandes', robots: { index: false, follow: false } };

export default async function MyOrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/connexion');
  const orders = await listUserOrders(user.id);

  if (orders.length === 0) {
    return (
      <EmptyState
        title="Aucune commande"
        description="Vos commandes passées apparaîtront ici, avec leur statut et leur historique."
        action={<ButtonLink href="/catalogue">Découvrir le catalogue</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">Mes commandes ({orders.length})</h2>
      {orders.map((order) => (
        <article key={order.id} className="rounded-xl border border-navy-100 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-sm font-bold">{order.number}</p>
              <p className="text-xs text-navy-500">{formatDateTime(order.createdAt)} · {order.city}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={order.status === 'DELIVERED' ? 'success' : order.status === 'CANCELLED' ? 'danger' : 'neutral'}>
                {ORDER_STATUS_LABELS[order.status as OrderStatus]}
              </Badge>
              <Badge tone={order.paymentStatus === 'PAID' ? 'success' : order.paymentStatus === 'AWAITING_VERIFICATION' ? 'warning' : 'neutral'}>
                {PAYMENT_STATUS_LABELS[order.paymentStatus]}
              </Badge>
              <span className="text-sm font-bold">{formatFCFA(order.total)}</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/compte/commandes/${order.number}`} className="rounded-lg border border-navy-200 px-3 py-1.5 text-xs font-semibold hover:bg-navy-50">
              Détail et suivi
            </Link>
            <Link href={`/commande/${order.number}?t=${encodeURIComponent(order.accessToken)}`} className="rounded-lg border border-navy-200 px-3 py-1.5 text-xs font-semibold hover:bg-navy-50">
              Paiement / référence
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
