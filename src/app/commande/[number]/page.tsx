import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, CheckCircle2, Home, MapPin, Phone, Receipt, Truck } from 'lucide-react';
import { getOrderByNumber, getOrderDetails, orderTotals } from '@/lib/orders';
import { getStoreSettings } from '@/lib/settings';
import { getCurrentUser } from '@/lib/auth';
import { waveStatus } from '@/lib/wave';
import { env } from '@/lib/env';
import { formatFCFA } from '@/lib/utils';
import { deliveryMethodLabels, paymentMethodLabels } from '@/lib/delivery';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus } from '@/lib/order-status';
import { Alert, Badge, Card } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { PaymentInstructions } from '@/components/payment-instructions';
import { WavePayButton } from '@/components/wave-pay-button';
import { OrderTimeline } from '@/components/order-timeline';

export const metadata: Metadata = { title: 'Confirmation de commande', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ number: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OrderConfirmationPage({ params, searchParams }: Props) {
  const { number } = await params;
  const query = await searchParams;
  const token = typeof query.t === 'string' ? query.t : undefined;

  const order = await getOrderByNumber(number);
  if (!order) notFound();

  const user = await getCurrentUser();
  const authorised = (user && order.userId === user.id) || (token && token === order.accessToken);
  if (!authorised) {
    return (
      <div className="container-page max-w-xl py-12">
        <Card className="p-6 text-center">
          <h1 className="text-xl font-bold">Accès à la commande protégé</h1>
          <p className="mt-2 text-sm text-navy-600">
            Pour consulter la commande {number}, utilisez le lien de suivi reçu à la validation, ou vérifiez votre identité depuis
            la page de suivi.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <ButtonLink href="/suivi">Suivre ma commande</ButtonLink>
            <ButtonLink href="/connexion" variant="outline">Se connecter</ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  const details = await getOrderDetails(order.id);
  if (!details) notFound();
  const settings = await getStoreSettings();
  const totals = orderTotals(order);
  const wave = waveStatus();
  const payment = details.payments[0];
  const returnTo = `/commande/${order.number}?t=${encodeURIComponent(order.accessToken)}`;
  const waveParam = typeof query.wave === 'string' ? query.wave : null;

  return (
    <div className="container-page max-w-4xl py-8">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-600" aria-hidden />
        <h1 className="mt-2 text-2xl font-extrabold text-emerald-950">Commande enregistrée</h1>
        <p className="mt-1 text-sm text-emerald-900">
          Numéro <strong className="font-mono">{order.number}</strong> · {ORDER_STATUS_LABELS[order.status as OrderStatus]}
        </p>
      </div>

      {waveParam === 'unavailable' ? (
        <Alert tone="warning" title="Paiement automatique indisponible" className="mt-4">
          La session Wave n&apos;a pas pu être créée. Suivez les instructions de paiement ci-dessous ; la boutique vérifiera votre
          règlement manuellement.
        </Alert>
      ) : null}
      {waveParam === 'success' ? (
        <Alert tone="info" title="Retour depuis Wave" className="mt-4">
          Si votre paiement a bien été validé, la confirmation apparaît ici dans quelques instants. Actualisez la page.
        </Alert>
      ) : null}
      {waveParam === 'error' ? (
        <Alert tone="danger" title="Paiement interrompu" className="mt-4">
          Le paiement n&apos;a pas abouti. Vous pouvez réessayer ou contacter la boutique.
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {order.paymentStatus !== 'PAID' ? (
            <PaymentInstructions
              orderId={order.id}
              orderNumber={order.number}
              token={order.accessToken}
              amountLabel={formatFCFA(totals.total)}
              waveNumber={settings.waveNumber}
              waveMerchantName={settings.waveMerchantName}
              autoMode={wave.mode === 'AUTO'}
              paymentStatus={order.paymentStatus}
              customerReference={payment?.customerReference ?? null}
            />
          ) : (
            <Alert tone="success" title="Paiement confirmé">
              Votre commande est en préparation. Vous serez contacté au {order.phone} pour la livraison ou le retrait.
            </Alert>
          )}

          {wave.mode === 'AUTO' && order.paymentStatus !== 'PAID' ? (
            <Card className="p-4">
              <p className="text-sm font-semibold text-navy-900">Paiement automatique sécurisé</p>
              <p className="mt-1 text-xs text-navy-600">
                Vous êtes redirigé vers Wave pour régler le montant exact de votre commande.
              </p>
              <div className="mt-3">
                <WavePayButton orderId={order.id} returnTo={returnTo} />
              </div>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <h2 className="border-b border-navy-100 bg-navy-50 px-4 py-2.5 text-sm font-bold">Articles commandés</h2>
            <ul className="divide-y divide-navy-100">
              {details.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-navy-900">{item.nameSnapshot}</p>
                    <p className="text-xs text-navy-500">
                      Réf. {item.skuSnapshot} · {item.quantity} × {formatFCFA(item.unitPrice)}
                    </p>
                  </div>
                  <p className="font-semibold">{formatFCFA(item.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-navy-100 px-4 py-3 text-sm">
              <div className="flex justify-between"><dt className="text-navy-600">Sous-total</dt><dd>{formatFCFA(totals.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-navy-600">Livraison</dt><dd>{totals.shippingFee === 0 ? 'Gratuit' : formatFCFA(totals.shippingFee)}</dd></div>
              <div className="flex justify-between border-t border-navy-100 pt-1.5 text-base font-bold"><dt>Total</dt><dd>{formatFCFA(totals.total)}</dd></div>
            </dl>
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-bold">Suivi de la commande</h2>
            <OrderTimeline status={order.status as OrderStatus} history={details.history} />
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-bold">Récapitulatif</h2>
            <dl className="mt-2 space-y-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-navy-400">Paiement</dt>
                <dd className="font-medium">{paymentMethodLabels[order.paymentMethod]}</dd>
                <dd className="mt-0.5">
                  <Badge tone={order.paymentStatus === 'PAID' ? 'success' : order.paymentStatus === 'AWAITING_VERIFICATION' ? 'warning' : 'neutral'}>
                    {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-navy-400">Livraison</dt>
                <dd className="font-medium">{deliveryMethodLabels[order.deliveryMethod]}</dd>
                <dd className="text-xs text-navy-600">
                  {order.addressLine ? `${order.addressLine}, ` : ''}
                  {order.commune ? `${order.commune}, ` : ''}
                  {order.city}
                  {order.landmark ? ` (${order.landmark})` : ''}
                </dd>
                {order.carrier ? <dd className="text-xs text-navy-600">Transporteur : {order.carrier}</dd> : null}
                {order.trackingNumber ? <dd className="text-xs font-medium text-navy-800">Suivi : {order.trackingNumber}</dd> : null}
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-navy-400">Contact</dt>
                <dd className="flex items-center gap-1.5 text-xs text-navy-700"><Phone className="size-3.5" aria-hidden /> {order.phone}</dd>
                {order.email ? <dd className="text-xs text-navy-700">{order.email}</dd> : null}
              </div>
            </dl>
          </Card>

          <Card className="p-4 text-sm">
            <h2 className="flex items-center gap-2 font-bold"><MapPin className="size-4 text-accent-600" aria-hidden /> Où retirer ?</h2>
            <p className="mt-1 text-xs text-navy-600">
              {settings.addressLine ? `${settings.addressLine}, ${settings.city}` : `Boutique MeDi à ${settings.city}`}
            </p>
            {settings.openingHours ? <p className="text-xs text-navy-600">{settings.openingHours}</p> : null}
            {settings.phone ? <p className="mt-1 text-xs text-navy-600">{settings.phone}</p> : null}
          </Card>

          <div className="rounded-xl border border-navy-100 bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-bold"><Truck className="size-4 text-accent-600" aria-hidden /> Conservez ce lien</p>
            <p className="mt-1 text-xs break-all text-navy-600">{`${env.appUrl.replace(/\/$/, '')}/commande/${order.number}?t=${order.accessToken}`}</p>
            <Link
              href={`/suivi/${order.number}?t=${encodeURIComponent(order.accessToken)}`}
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent-700 hover:underline"
            >
              <Receipt className="size-4" aria-hidden /> Page de suivi <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>

          <ButtonLink href="/" variant="outline" className="w-full">
            <Home className="size-4" aria-hidden /> Retour à l&apos;accueil
          </ButtonLink>
        </aside>
      </div>
    </div>
  );
}
