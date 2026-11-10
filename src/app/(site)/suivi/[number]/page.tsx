import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Package, Truck } from 'lucide-react';
import { getOrderByNumber, getOrderDetails, orderTotals } from '@/lib/orders';
import { getCurrentUser } from '@/lib/auth';
import { deliveryMethodLabels, paymentMethodLabels } from '@/lib/delivery';
import { PAYMENT_STATUS_LABELS, type OrderStatus } from '@/lib/order-status';
import { getSiteI18n } from '@/lib/i18n/site-server';
import { siteOrderStatusLabel } from '@/lib/i18n/order-labels';
import { formatDateTime, formatFCFA } from '@/lib/utils';
import { Alert, Badge, Card } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { OrderTimeline } from '@/components/order-timeline';
import { ShipmentTracker } from '@/components/shipment-tracker';
import { ReviewRequestPanel } from '@/components/reviews';
import { reviewContextForOrder, publicAuthorName } from '@/lib/reviews';

export const metadata: Metadata = { title: 'Suivi de commande', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function TrackOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { number } = await params;
  const query = await searchParams;
  const token = typeof query.t === 'string' ? query.t : undefined;

  const order = await getOrderByNumber(number);
  if (!order) notFound();

  const user = await getCurrentUser();
  const authorised = (user && order.userId === user.id) || (token && token === order.accessToken);
  if (!authorised) notFound();

  const details = await getOrderDetails(order.id);
  if (!details) notFound();
  const totals = orderTotals(order);
  const [{ t }, reviewContext] = await Promise.all([getSiteI18n(), reviewContextForOrder(order.id).catch(() => null)]);

  return (
    <div className="container-page max-w-3xl py-8">
      <Link href="/suivi" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-navy-600 hover:text-accent-700">
        <ArrowLeft className="size-4" aria-hidden /> {t('Autre commande')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-extrabold">{order.number}</h1>
          <p className="text-sm text-navy-600">{t('Passée le {date}', { date: formatDateTime(order.createdAt) })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">{siteOrderStatusLabel(t, order.status as OrderStatus)}</Badge>
          <Badge tone={order.paymentStatus === 'PAID' ? 'success' : 'warning'}>{t(PAYMENT_STATUS_LABELS[order.paymentStatus])}</Badge>
        </div>
      </div>

      {order.deliveryMethod === 'CARRIER' && order.paymentStatus !== 'PAID' ? (
        <Alert tone="warning" title={t('Expédition en attente de paiement')} className="mt-4">
          {t(
            'Cette commande est destinée à {city}, hors de Daloa. Elle ne sera expédiée qu’après confirmation effective du paiement par la boutique.',
            { city: order.city },
          )}
        </Alert>
      ) : null}

      <Card className="mt-4 p-4">
        <h2 className="mb-3 text-sm font-bold">{t('Progression')}</h2>
        <OrderTimeline status={order.status as OrderStatus} history={details.history} />
      </Card>

      {/* Colis confié à un transporteur : le client voit où il en est. */}
      <div className="mt-4">
        <ShipmentTracker orderId={order.id} />
      </div>

      {/*
        Avis après livraison : le client est déjà sur la page qui prouve son
        achat (numéro de commande + téléphone, ou lien reçu à la validation),
        c'est donc ici — et nulle part ailleurs — que le formulaire a du sens.
      */}
      {reviewContext ? (
        <div className="mt-4">
          <ReviewRequestPanel
            context={reviewContext}
            token={token}
            defaultAuthor={publicAuthorName(order.customerFirstName, order.customerLastName)}
          />
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card className="p-4 text-sm">
          <h2 className="mb-2 flex items-center gap-2 font-bold"><Truck className="size-4 text-accent-600" aria-hidden /> {t('Livraison')}</h2>
          <p>{t(deliveryMethodLabels[order.deliveryMethod])}</p>
          <p className="text-xs text-navy-600">
            {order.addressLine ? `${order.addressLine}, ` : ''}
            {order.commune ? `${order.commune}, ` : ''}
            {order.city}
          </p>
          {order.carrier ? <p className="mt-1 text-xs">{t('Transporteur :')} {order.carrier}</p> : null}
          {order.trackingNumber ? (
            <p className="mt-1 text-xs font-semibold">{t('N° de suivi :')} <span dir="ltr">{order.trackingNumber}</span></p>
          ) : null}
        </Card>

        <Card className="p-4 text-sm">
          <h2 className="mb-2 flex items-center gap-2 font-bold"><Package className="size-4 text-accent-600" aria-hidden /> {t('Commande')}</h2>
          <ul className="space-y-1 text-xs">
            {details.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">{item.quantity} × {item.nameSnapshot}</span>
                <span className="shrink-0 font-medium">{formatFCFA(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-navy-100 pt-2 text-sm font-bold">{t('Total')} : {formatFCFA(totals.total)}</p>
          <p className="text-xs text-navy-500">{t(paymentMethodLabels[order.paymentMethod])}</p>
        </Card>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {order.paymentStatus !== 'PAID' ? (
          <ButtonLink href={`/commande/${order.number}?t=${encodeURIComponent(order.accessToken)}`}>
            {t('Payer / déclarer une référence')}
          </ButtonLink>
        ) : null}
        <ButtonLink href="/contact" variant="outline">{t('Signaler un problème')}</ButtonLink>
      </div>
    </div>
  );
}
