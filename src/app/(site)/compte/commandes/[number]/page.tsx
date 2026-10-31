import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getOrderByNumber, getOrderDetails, orderTotals } from '@/lib/orders';
import { deliveryMethodLabels, paymentMethodLabels } from '@/lib/delivery';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus } from '@/lib/order-status';
import { formatDateTime, formatFCFA } from '@/lib/utils';
import { Badge, Card } from '@/components/ui/primitives';
import { OrderTimeline } from '@/components/order-timeline';

export const metadata: Metadata = { title: 'Détail de commande', robots: { index: false, follow: false } };

export default async function AccountOrderDetail({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/connexion');

  const order = await getOrderByNumber(number);
  if (!order) notFound();
  // Contrôle d'accès : un client ne voit que ses propres commandes.
  if (order.userId !== user.id) notFound();

  const details = await getOrderDetails(order.id);
  if (!details) notFound();
  const totals = orderTotals(order);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-mono text-lg font-bold">{order.number}</h2>
          <p className="text-xs text-navy-500">Passée le {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          <Badge tone="neutral">{ORDER_STATUS_LABELS[order.status as OrderStatus]}</Badge>
          <Badge tone={order.paymentStatus === 'PAID' ? 'success' : 'warning'}>{PAYMENT_STATUS_LABELS[order.paymentStatus]}</Badge>
        </div>
      </div>

      <Card className="p-4">
        <OrderTimeline status={order.status as OrderStatus} history={details.history} />
      </Card>

      <Card className="overflow-hidden">
        <h3 className="border-b border-navy-100 bg-navy-50 px-4 py-2 text-sm font-bold">Articles</h3>
        <ul className="divide-y divide-navy-100">
          {details.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{item.nameSnapshot}</p>
                <p className="text-xs text-navy-500">{item.quantity} × {formatFCFA(item.unitPrice)}</p>
              </div>
              <p className="font-semibold">{formatFCFA(item.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t border-navy-100 px-4 py-3 text-sm">
          <div className="flex justify-between"><dt className="text-navy-600">Sous-total</dt><dd>{formatFCFA(totals.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-navy-600">Livraison</dt><dd>{formatFCFA(totals.shippingFee)}</dd></div>
          <div className="flex justify-between font-bold"><dt>Total</dt><dd>{formatFCFA(totals.total)}</dd></div>
        </dl>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4 text-sm">
          <h3 className="mb-2 font-bold">Livraison</h3>
          <p>{deliveryMethodLabels[order.deliveryMethod]}</p>
          <p className="text-xs text-navy-600">{order.addressLine ? `${order.addressLine}, ` : ''}{order.city}</p>
          {order.trackingNumber ? <p className="mt-1 text-xs">N° de suivi : <strong>{order.trackingNumber}</strong></p> : null}
        </Card>
        <Card className="p-4 text-sm">
          <h3 className="mb-2 font-bold">Paiement</h3>
          <p>{paymentMethodLabels[order.paymentMethod]}</p>
          {details.payments.map((payment) => (
            <p key={payment.id} className="mt-1 text-xs text-navy-600">
              {payment.status} {payment.customerReference ? `· réf. ${payment.customerReference}` : ''}
              {payment.providerTransactionId ? ` · transaction ${payment.providerTransactionId}` : ''}
            </p>
          ))}
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/commande/${order.number}?t=${encodeURIComponent(order.accessToken)}`} className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600">
          Payer / déclarer une référence
        </Link>
        <Link href="/compte/commandes" className="rounded-lg border border-navy-200 px-4 py-2 text-sm font-semibold hover:bg-navy-50">
          Retour à mes commandes
        </Link>
      </div>
    </div>
  );
}
