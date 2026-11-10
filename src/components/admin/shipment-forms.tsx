'use client';

import { useActionState } from 'react';
import { Check, Copy, ExternalLink, Loader2, RefreshCw, Send, Truck } from 'lucide-react';
import { useAdminI18n } from '@/components/admin/admin-i18n';
import { addShipmentAction, syncShipmentAction, updateShipmentStatusAction, type ShipmentActionState } from '@/app/actions/shipments';
import { SHIPMENT_STATUS_LABELS } from '@/lib/colis-express';
import type { ShipmentStatus } from '@/lib/shipments';
import { Alert } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';

const initial: ShipmentActionState = {};

/**
 * Formulaire « ce colis part chez le client ».
 *
 * Un seul champ obligatoire : le code de suivi donné par Colis Express. Le tarif
 * du transport est prérempli avec les frais de livraison de la commande pour ne
 * pas avoir à le retrouver, et reste modifiable.
 */
export function DispatchForm({
  orderId,
  orderNumber,
  customerName,
  city,
  defaultFee,
}: {
  orderId: string;
  orderNumber: string;
  customerName: string;
  city: string;
  defaultFee: number;
}) {
  const { t } = useAdminI18n();
  const [state, formAction, pending] = useActionState(addShipmentAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-navy-900">
          {orderNumber} · {customerName}
        </p>
        <p className="text-xs text-navy-500">{city}</p>
      </div>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Field
          label={t('Code de suivi Colis Express')}
          htmlFor={`tracking-${orderId}`}
          required
          hint={t('Le code figure sur le reçu du guichet : CLI-AB12CD.')}
        >
          <Input
            id={`tracking-${orderId}`}
            name="trackingNumber"
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="CLI-AB12CD"
            className="font-mono uppercase"
          />
        </Field>
        <Field label={t('Frais de transport (FCFA)')} htmlFor={`fee-${orderId}`} hint={t('Prérempli avec les frais de la commande.')}>
          <Input id={`fee-${orderId}`} name="fee" type="number" min={0} step={100} defaultValue={defaultFee} />
        </Field>
      </div>

      <Field label={t('Note (facultatif)')} htmlFor={`notes-${orderId}`}>
        <Input id={`notes-${orderId}`} name="notes" placeholder={t('Ex. agence Daloa, remis à M. Koné')} />
      </Field>

      <Button type="submit" disabled={pending} size="sm">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Truck className="size-4" aria-hidden />}
        {t('Marquer comme expédié')}
      </Button>
    </form>
  );
}

/** Changer l'étape d'une expédition (retour WhatsApp du transporteur, retrait client…). */
export function ShipmentStatusForm({
  shipmentId,
  current,
  label,
}: {
  shipmentId: string;
  current: ShipmentStatus;
  label: string;
}) {
  const { t } = useAdminI18n();
  const [state, formAction, pending] = useActionState(updateShipmentStatusAction, initial);
  const statuses = Object.keys(SHIPMENT_STATUS_LABELS) as ShipmentStatus[];

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="shipmentId" value={shipmentId} />
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 text-xs">
          <span className="mb-1 block font-medium text-navy-700">{label}</span>
          <Select name="status" defaultValue={current} className="w-full">
            {statuses.map((status) => (
              <option key={status} value={status}>
                {t(SHIPMENT_STATUS_LABELS[status])}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          {t('Enregistrer')}
        </Button>
      </div>
    </form>
  );
}

/** Demander son statut à Colis Express (quand l'API est configurée). */
export function SyncShipmentButton({ shipmentId, configured }: { shipmentId: string; configured: boolean }) {
  const { t } = useAdminI18n();
  const [state, formAction, pending] = useActionState(syncShipmentAction, initial);

  return (
    <form action={formAction} className="mt-1">
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending} title={configured ? undefined : t('Synchronisation non configurée')}>
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
        {t('Actualiser le statut')}
      </Button>
      {state.error ? <p className="mt-1 text-[11px] text-amber-800">{state.error}</p> : null}
      {state.success ? <p className="mt-1 text-[11px] text-emerald-800">{state.success}</p> : null}
    </form>
  );
}

/** Copier le lien de suivi pour l'envoyer au client sur WhatsApp. */
export function CopyTrackingLink({ url }: { url: string }) {
  const { t } = useAdminI18n();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-semibold text-accent-700 hover:underline"
      >
        <ExternalLink className="size-3.5" aria-hidden /> {t('Ouvrir le suivi')}
      </a>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(url);
        }}
        className="inline-flex items-center gap-1 text-xs font-medium text-navy-600 hover:text-navy-900"
      >
        <Copy className="size-3.5" aria-hidden /> {t('Copier le lien')}
      </button>
    </div>
  );
}

/** Bouton d'envoi du lien de suivi par WhatsApp, message déjà rédigé. */
export function WhatsAppTrackingLink({ href }: { href: string }) {
  const { t } = useAdminI18n();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
    >
      <Send className="size-3.5" aria-hidden /> {t('Envoyer sur WhatsApp')}
    </a>
  );
}
