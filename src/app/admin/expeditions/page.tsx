import Link from 'next/link';
import { ArrowRight, ExternalLink, Package, PackageCheck, Truck } from 'lucide-react';
import { requirePagePermission } from '@/lib/auth';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { listShipments, ordersToDispatch, shipmentCounts, customerTrackingLink, type ShipmentStatus } from '@/lib/shipments';
import { COLIS_EXPRESS_LABEL, SHIPMENT_STATUS_LABELS, providerHomeUrl } from '@/lib/colis-express';
import { env } from '@/lib/env';
import { getStoreSettings, whatsappLink } from '@/lib/settings';
import { formatDateTime, formatFCFA, toFcfa } from '@/lib/utils';
import { Badge, Card } from '@/components/ui/primitives';
import { DispatchForm, ShipmentStatusForm, SyncShipmentButton, CopyTrackingLink, WhatsAppTrackingLink } from '@/components/admin/shipment-forms';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Expéditions — Colis Express',
};

const STATUS_TONE: Record<ShipmentStatus, 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'neutral',
  DISPATCHED: 'accent',
  IN_TRANSIT: 'accent',
  ARRIVED: 'warning',
  DELIVERED: 'success',
  RETURNED: 'danger',
};

const FILTERS: { value: ShipmentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'IN_TRANSIT', label: 'En transit' },
  { value: 'ARRIVED', label: 'Arrivées en agence' },
  { value: 'DELIVERED', label: 'Retirées' },
  { value: 'RETURNED', label: 'Retours' },
];

/**
 * Expéditions — le seul écran nécessaire pour livrer hors de Daloa.
 *
 * Deux blocs, dans l'ordre du travail réel :
 *  1. les commandes payées qui attendent un transporteur (rien d'autre à faire) ;
 *  2. les expéditions en cours, avec leur code de suivi et le lien à envoyer au
 *     client.
 *
 * Le prestataire (Colis Express) intervient **hors du site** : c'est lui qui
 * remet un code de suivi au guichet. On ne prétend donc pas créer le colis ici ;
 * on enregistre le code qu'il a donné et on le rend visible au client.
 */
export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePagePermission('delivery.manage');
  const [{ t }, params, settings] = await Promise.all([getAdminI18n(), searchParams, getStoreSettings()]);

  const filter = (typeof params.statut === 'string' ? params.statut : 'all') as ShipmentStatus | 'all';
  const [counts, toDispatch, shipments] = await Promise.all([
    shipmentCounts(),
    ordersToDispatch(),
    listShipments({ status: filter }),
  ]);

  // Message WhatsApp prérempli : le client n'a qu'à appuyer sur « envoyer ».
  const whatsappFor = (phone: string, code: string, url: string) =>
    whatsappLink(settings, `Bonjour, votre commande Perokado est en route. Suivez votre colis avec le code ${code} : ${url}`)?.replace(
      /wa\.me\/\d+/,
      `wa.me/${phone.replace(/\D/g, '')}`,
    ) ?? null;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">{t('Expéditions')}</h1>
        <p className="text-sm text-navy-600">
          {t(
            'Les commandes hors Daloa partent avec {carrier}. Vous saisissez ici le code de suivi remis au guichet : le client le voit dans son suivi de commande et peut suivre son colis lui-même.',
            { carrier: COLIS_EXPRESS_LABEL },
          )}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-500">{t('À expédier')}</p>
          <p className="text-2xl font-extrabold text-navy-950">{counts.toShip}</p>
          <p className="text-[11px] text-navy-500">{t('payées, en attente de transporteur')}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-500">{t('En route')}</p>
          <p className="text-2xl font-extrabold text-navy-950">{counts.IN_TRANSIT + counts.DISPATCHED}</p>
          <p className="text-[11px] text-navy-500">{t('expédiées, pas encore arrivées')}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-500">{t('En agence')}</p>
          <p className="text-2xl font-extrabold text-navy-950">{counts.ARRIVED}</p>
          <p className="text-[11px] text-navy-500">{t('arrivées, à retirer par le client')}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-500">{t('Livrées')}</p>
          <p className="text-2xl font-extrabold text-navy-950">{counts.DELIVERED}</p>
          <p className="text-[11px] text-navy-500">{t('retirées par le client')}</p>
        </Card>
      </div>

      <Card className="border-accent-200 bg-accent-50/40 p-3">
        <p className="flex flex-wrap items-center gap-2 text-xs text-navy-700">
          <Truck className="size-4 shrink-0 text-accent-700" aria-hidden />
          {t('Ouvrez le guichet {carrier} pour créer un colis et obtenir son code, puis revenez le saisir ici.', {
            carrier: COLIS_EXPRESS_LABEL,
          })}
          <a
            href={providerHomeUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-accent-700 hover:underline"
          >
            {COLIS_EXPRESS_LABEL} <ExternalLink className="size-3" aria-hidden />
          </a>
        </p>
        {!env.colisExpress.configured ? (
          <p className="mt-1 text-[11px] text-navy-500">
            {t(
              'La synchronisation automatique des statuts n’est pas branchée : le lien de suivi ci-dessous reste la source exacte. Renseignez COLIS_EXPRESS_API_BASE pour l’activer.',
            )}
          </p>
        ) : null}
      </Card>

      {/* ── 1. Commandes à expédier ─────────────────────────────────────── */}
      <section aria-labelledby="a-expedier" className="space-y-2">
        <h2 id="a-expedier" className="flex items-center gap-2 text-sm font-bold">
          <Package className="size-4 text-accent-600" aria-hidden /> {t('Commandes à expédier')}
          <Badge tone={toDispatch.length > 0 ? 'warning' : 'neutral'}>{toDispatch.length}</Badge>
        </h2>

        {toDispatch.length === 0 ? (
          <Card className="p-4 text-sm text-navy-600">
            {t('Aucune commande payée n’attend de transporteur. C’est bon signe.')}
          </Card>
        ) : (
          <div className="space-y-2">
            {toDispatch.map((order) => (
              <Card key={order.id} className="p-4">
                <DispatchForm
                  orderId={order.id}
                  orderNumber={order.number}
                  customerName={`${order.customerFirstName} ${order.customerLastName}`.trim()}
                  city={order.city}
                  defaultFee={toFcfa(order.shippingFee)}
                />
                <p className="mt-2 flex flex-wrap items-center gap-3 border-t border-navy-100 pt-2 text-[11px] text-navy-500">
                  <Link href={`/admin/commandes/${order.id}`} className="inline-flex items-center gap-1 font-semibold text-accent-700 hover:underline">
                    {t('Ouvrir la commande')} <ArrowRight className="size-3" aria-hidden />
                  </Link>
                  <span>{order.phone}</span>
                  <span>
                    {t('Total')} {formatFCFA(order.total)}
                  </span>
                  <span>{order.addressLine ?? order.commune ?? order.city}</span>
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── 2. Expéditions en cours ─────────────────────────────────────── */}
      <section aria-labelledby="en-cours" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="en-cours" className="flex items-center gap-2 text-sm font-bold">
            <PackageCheck className="size-4 text-accent-600" aria-hidden /> {t('Mes expéditions')}
          </h2>
          <nav className="flex flex-wrap gap-1" aria-label={t('Filtrer les expéditions')}>
            {FILTERS.map((item) => (
              <Link
                key={item.value}
                href={item.value === 'all' ? '/admin/expeditions' : `/admin/expeditions?statut=${item.value}`}
                className={
                  filter === item.value
                    ? 'rounded-md bg-navy-900 px-2.5 py-1 text-xs font-semibold text-white'
                    : 'rounded-md bg-white px-2.5 py-1 text-xs font-medium text-navy-700 ring-1 ring-navy-200 hover:bg-navy-50'
                }
              >
                {t(item.label)}
              </Link>
            ))}
          </nav>
        </div>

        {shipments.length === 0 ? (
          <Card className="p-4 text-sm text-navy-600">
            {filter === 'all'
              ? t('Aucune expédition enregistrée pour le moment.')
              : t('Aucune expédition dans cette catégorie.')}
          </Card>
        ) : (
          <ul className="space-y-2">
            {shipments.map((shipment) => {
              const url = customerTrackingLink(shipment);
              const whatsapp = url && shipment.trackingNumber ? whatsappFor(shipment.phone, shipment.trackingNumber, url) : null;
              return (
                <li key={shipment.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                          <Link href={`/admin/commandes/${shipment.orderId}`} className="font-mono hover:text-accent-700">
                            {shipment.orderNumber}
                          </Link>
                          <Badge tone={STATUS_TONE[shipment.status]}>{t(SHIPMENT_STATUS_LABELS[shipment.status])}</Badge>
                          {shipment.trackingNumber ? (
                            <span className="font-mono text-xs text-navy-600" dir="ltr">
                              {shipment.trackingNumber}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-navy-600">
                          {shipment.customerName} · {shipment.phone} · {shipment.city} · {formatFCFA(shipment.fee)}
                        </p>
                        <p className="text-[11px] text-navy-500">
                          {shipment.dispatchedAt ? `${t('Expédié le')} ${formatDateTime(shipment.dispatchedAt)}` : null}
                          {shipment.providerStatus ? ` · ${COLIS_EXPRESS_LABEL} : ${shipment.providerStatus}` : null}
                        </p>
                      </div>

                      <div className="flex flex-col items-start gap-1 sm:items-end">
                        {url ? <CopyTrackingLink url={url} /> : null}
                        {whatsapp ? <WhatsAppTrackingLink href={whatsapp} /> : null}
                      </div>
                    </div>

                    <div className="mt-2 border-t border-navy-100 pt-2">
                      <ShipmentStatusForm shipmentId={shipment.id} current={shipment.status} label={t('Étape du colis')} />
                      <SyncShipmentButton shipmentId={shipment.id} configured={env.colisExpress.configured} />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
