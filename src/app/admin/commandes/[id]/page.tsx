import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Ban, MapPin, Phone, Truck, User } from 'lucide-react';
import { getOrderDetails, orderTotals } from '@/lib/orders';
import { getCurrentUser, can } from '@/lib/auth';
import { deliveryMethodLabels, paymentMethodLabels } from '@/lib/delivery';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, ALLOWED_TRANSITIONS, type OrderStatus } from '@/lib/order-status';
import { formatDateTime, formatFCFA } from '@/lib/utils';
import { Badge, Card } from '@/components/ui/primitives';
import { OrderTimeline } from '@/components/order-timeline';
import { OrderStatusForm, PaymentReviewForm, CancelOrderForm } from '@/components/admin/order-actions';
import { saveAdminNoteAction } from '@/app/actions/admin-orders';
import { Textarea } from '@/components/ui/form';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const details = await getOrderDetails(id);
  if (!details) notFound();

  const actor = await getCurrentUser();
  const { order, items, payments, history, shipments } = details;
  const totals = orderTotals(order);
  const payment = payments[0];
  const canConfirmPayment = can(actor?.role, 'payments.confirm');
  const canWrite = can(actor?.role, 'orders.write');
  const isCarrier = order.deliveryMethod === 'CARRIER';
  const paid = order.paymentStatus === 'PAID';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/admin/commandes" className="inline-flex items-center gap-1 text-xs font-medium text-navy-500 hover:text-accent-700">
            <ArrowLeft className="size-3.5" aria-hidden /> Commandes
          </Link>
          <h1 className="font-mono text-xl font-extrabold">{order.number}</h1>
          <p className="text-xs text-navy-500">Créée le {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={paid ? 'success' : order.paymentStatus === 'AWAITING_VERIFICATION' ? 'warning' : 'neutral'}>
            {PAYMENT_STATUS_LABELS[order.paymentStatus]}
          </Badge>
          <Badge tone={order.status === 'CANCELLED' ? 'danger' : isCarrier && !paid ? 'warning' : 'neutral'}>
            {ORDER_STATUS_LABELS[order.status as OrderStatus]}
          </Badge>
        </div>
      </div>

      {isCarrier && !paid ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Expédition hors Daloa : <strong>prépaiement obligatoire</strong>. Aucune expédition ne peut être enregistrée avant confirmation du paiement.
          {order.reservationExpiresAt ? ` La réservation expire le ${formatDateTime(order.reservationExpiresAt)}.` : ''}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-bold">Articles</h2>
            <ul className="divide-y divide-navy-100">
              {items.map((item) => (
                <li key={item.id} className="flex justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium">{item.nameSnapshot}</p>
                    <p className="text-xs text-navy-500">Réf. {item.skuSnapshot} · {item.quantity} × {formatFCFA(item.unitPrice)}</p>
                  </div>
                  <p className="font-semibold">{formatFCFA(item.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-2 space-y-1 border-t border-navy-100 pt-2 text-sm">
              <div className="flex justify-between"><dt className="text-navy-600">Sous-total</dt><dd>{formatFCFA(totals.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-navy-600">Livraison</dt><dd>{formatFCFA(totals.shippingFee)}</dd></div>
              <div className="flex justify-between font-bold"><dt>Total</dt><dd>{formatFCFA(totals.total)}</dd></div>
            </dl>
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-bold">Historique</h2>
            <OrderTimeline status={order.status as OrderStatus} history={history} />
          </Card>

          {canWrite ? (
            <Card className="p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold"><Truck className="size-4 text-navy-400" aria-hidden /> Faire évoluer la commande</h2>
              <OrderStatusForm
                orderId={order.id}
                currentStatus={order.status as OrderStatus}
                allowed={ALLOWED_TRANSITIONS[order.status as OrderStatus]}
                isCarrier={isCarrier}
                paid={paid}
              />
            </Card>
          ) : null}

          {canWrite && order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && order.status !== 'REFUNDED' ? (
            <Card className="border-rose-100 p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-rose-800"><Ban className="size-4" aria-hidden /> Annulation</h2>
              <CancelOrderForm orderId={order.id} />
            </Card>
          ) : null}

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-bold">Note interne</h2>
            <form action={saveAdminNoteAction} className="space-y-2">
              <input type="hidden" name="orderId" value={order.id} />
              <Textarea name="adminNote" rows={3} defaultValue={order.adminNote ?? ''} maxLength={2000} placeholder="Note visible uniquement par l’équipe…" />
              <Button type="submit" variant="outline" size="sm">Enregistrer la note</Button>
            </form>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold"><User className="size-4 text-navy-400" aria-hidden /> Client</h2>
            <p className="text-sm font-medium">{order.customerFirstName} {order.customerLastName}</p>
            <p className="flex items-center gap-1.5 text-xs text-navy-600"><Phone className="size-3.5" aria-hidden /> {order.phone}</p>
            {order.email ? <p className="text-xs text-navy-600">{order.email}</p> : null}
            {order.userId ? <p className="mt-1 text-[11px] text-navy-400">Compte client lié</p> : <p className="mt-1 text-[11px] text-navy-400">Commande invitée</p>}
            {order.customerNote ? <p className="mt-2 rounded bg-navy-50 p-2 text-xs text-navy-700">{order.customerNote}</p> : null}
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold"><MapPin className="size-4 text-navy-400" aria-hidden /> Livraison</h2>
            <dl className="space-y-1 text-xs text-navy-700">
              <div><dt className="inline font-semibold">Mode : </dt><dd className="inline">{deliveryMethodLabels[order.deliveryMethod]}</dd></div>
              <div><dt className="inline font-semibold">Ville : </dt><dd className="inline">{order.city}</dd></div>
              {order.commune ? <div><dt className="inline font-semibold">Commune : </dt><dd className="inline">{order.commune}</dd></div> : null}
              {order.addressLine ? <div><dt className="inline font-semibold">Adresse : </dt><dd className="inline">{order.addressLine}</dd></div> : null}
              {order.landmark ? <div><dt className="inline font-semibold">Repère : </dt><dd className="inline">{order.landmark}</dd></div> : null}
              {order.carrier ? <div><dt className="inline font-semibold">Transporteur : </dt><dd className="inline">{order.carrier}</dd></div> : null}
              {order.trackingNumber ? <div><dt className="inline font-semibold">Suivi : </dt><dd className="inline font-mono">{order.trackingNumber}</dd></div> : null}
              {order.shippedAt ? <div><dt className="inline font-semibold">Expédiée : </dt><dd className="inline">{formatDateTime(order.shippedAt)}</dd></div> : null}
              {order.deliveredAt ? <div><dt className="inline font-semibold">Livrée : </dt><dd className="inline">{formatDateTime(order.deliveredAt)}</dd></div> : null}
            </dl>
            {shipments.length > 0 ? (
              <ul className="mt-2 space-y-1 border-t border-navy-100 pt-2 text-[11px] text-navy-500">
                {shipments.map((shipment) => (
                  <li key={shipment.id}>{shipment.status} · {shipment.carrier ?? '—'} · {shipment.trackingNumber ?? 'sans n°'}</li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-bold">Paiement</h2>
            <p className="text-xs text-navy-600">{paymentMethodLabels[order.paymentMethod]}</p>
            {payment ? (
              <div className="mt-2">
                <p className="mb-2 text-xs text-navy-500">
                  Statut : <strong>{payment.status}</strong>
                  {payment.confirmedAt ? ` · confirmé le ${formatDateTime(payment.confirmedAt)}` : ''}
                </p>
                {payment.status !== 'CONFIRMED' && order.status !== 'CANCELLED' ? (
                  <PaymentReviewForm
                    paymentId={payment.id}
                    amountLabel={formatFCFA(payment.amount)}
                    reference={payment.clientReference}
                    customerReference={payment.customerReference}
                    canConfirm={canConfirmPayment}
                  />
                ) : null}
                {payment.status === 'CONFIRMED' ? (
                  <p className="rounded bg-emerald-50 p-2 text-xs text-emerald-800">Paiement confirmé — stock décrémenté.</p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-navy-500">Aucun enregistrement de paiement.</p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
