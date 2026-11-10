import { ExternalLink, MapPin, PackageCheck, Truck } from 'lucide-react';
import { getSiteI18n } from '@/lib/i18n/site-server';
import { COLIS_EXPRESS_LABEL, COLIS_EXPRESS_STEPS, stepIndexForStatus } from '@/lib/colis-express';
import { shipmentForOrder, customerTrackingLink, type ShipmentStatus } from '@/lib/shipments';
import { formatDateTime } from '@/lib/utils';

/**
 * Le colis, tel que le client le vit.
 *
 * Un client qui attend une commande hors Daloa ne se demande pas « où en est le
 * statut de ma commande » mais « où est mon colis ». Ce bloc répond à cette
 * question avec les mots du transporteur (« Expédié », « En transit », « Arrivé »,
 * « Retiré »), le code de suivi et le lien pour le suivre soi-même.
 *
 * Rien ne s'affiche tant qu'aucune expédition n'est enregistrée : pas de faux
 * suivi, pas de frise vide.
 */
export async function ShipmentTracker({ orderId }: { orderId: string }) {
  const [shipment, { t }] = await Promise.all([shipmentForOrder(orderId), getSiteI18n()]);
  if (!shipment) return null;

  const url = customerTrackingLink(shipment);
  const currentStep = stepIndexForStatus(shipment.status as ShipmentStatus);
  const isReturned = shipment.status === 'RETURNED';

  return (
    <div className="rounded-xl border border-accent-200 bg-accent-50/40 p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold text-navy-900">
        <PackageCheck className="size-4 text-accent-600" aria-hidden /> {t('Où est mon colis ?')}
      </h2>

      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy-700">
        <span className="inline-flex items-center gap-1">
          <Truck className="size-3.5" aria-hidden /> {COLIS_EXPRESS_LABEL}
        </span>
        {shipment.trackingNumber ? (
          <span className="font-mono font-semibold" dir="ltr">
            {shipment.trackingNumber}
          </span>
        ) : null}
        {shipment.destinationCity ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden /> {shipment.destinationCity}
          </span>
        ) : null}
      </p>

      {isReturned ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          {t('Le colis nous est revenu. Écrivez-nous sur WhatsApp : nous le renvoyons dès que possible.')}
        </p>
      ) : (
        <ol className="mt-3 grid grid-cols-4 gap-1 text-center">
          {COLIS_EXPRESS_STEPS.map((step, index) => {
            const done = currentStep >= index;
            return (
              <li key={step} className="flex flex-col items-center gap-1">
                <span
                  className={
                    done
                      ? 'size-2.5 rounded-full bg-emerald-600 ring-2 ring-emerald-200'
                      : 'size-2.5 rounded-full bg-navy-200'
                  }
                  aria-hidden
                />
                <span className={done ? 'text-[11px] font-semibold text-navy-900' : 'text-[11px] text-navy-500'}>
                  {t(step)}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {shipment.providerStatus ? (
        <p className="mt-2 text-[11px] text-navy-600">
          {t('Dernière information du transporteur :')} <strong>{shipment.providerStatus}</strong>
          {shipment.providerCheckedAt ? ` · ${formatDateTime(shipment.providerCheckedAt)}` : ''}
        </p>
      ) : null}

      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-xs font-bold text-white hover:bg-navy-800"
        >
          {t('Suivre mon colis chez {carrier}', { carrier: COLIS_EXPRESS_LABEL })}
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      ) : null}

      <p className="mt-2 text-[11px] text-navy-500">
        {t('Le suivi est mis à jour par le transporteur. Munissez-vous du code ci-dessus si vous nous écrivez.')}
      </p>
    </div>
  );
}
