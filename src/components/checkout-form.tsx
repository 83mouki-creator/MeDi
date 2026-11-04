'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Store,
  Truck,
  Wallet,
} from 'lucide-react';
import { placeOrderAction, type CheckoutState } from '@/app/actions/checkout';
import { Button } from './ui/button';
import { Alert } from './ui/primitives';
import { Field, Input, Select } from './ui/form';
import { cn, formatFCFA } from '@/lib/utils';
import { useSiteI18n } from './site-i18n';
import { PurchaseNotice } from './purchase-notice';
import { DALOA_NEIGHBOURHOODS, pickLocalZone } from '@/lib/daloa';
import { PICKUP_HOLD_HOURS, OUTSIDE_DALOA_MAX_DAYS } from '@/lib/store-policy';
import { transportQuoteMessage, whatsappWithMessage } from '@/lib/store-location';

export type ZoneOption = {
  id: string;
  name: string;
  city: string;
  isLocal: boolean;
  isPickup: boolean;
  fee: number;
  freeAbove: number | null;
  estimatedDelay: string | null;
  neighbourhoods: string[];
};

type Props = {
  items: { productId: string; quantity: number }[];
  lines: { name: string; quantity: number }[];
  subtotal: number;
  zones: ZoneOption[];
  user: { firstName: string | null; lastName: string | null; phone: string | null; email: string } | null;
  store: {
    city: string;
    addressLine: string;
    gps: string;
    mapsUrl: string;
    directionsUrl: string;
    openingHours: string | null;
    whatsapp: string | null;
  };
  settings: { allowCod: boolean; codMaxAmount: number; allowPickup: boolean; allowLocalDelivery: boolean; city: string };
};

const initialState: CheckoutState = {};

const NEIGHBOURHOODS_SORTED = [...DALOA_NEIGHBOURHOODS].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

export function CheckoutForm({ items, lines, subtotal, zones, user, store, settings }: Props) {
  const { t } = useSiteI18n();
  const [state, formAction, pending] = useActionState(placeOrderAction, initialState);
  const [deliveryMethod, setDeliveryMethod] = useState<'PICKUP' | 'LOCAL_DELIVERY' | 'CARRIER'>(
    settings.allowPickup ? 'PICKUP' : 'LOCAL_DELIVERY',
  );
  const [zoneId, setZoneId] = useState<string>('');
  const [neighbourhood, setNeighbourhood] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'WAVE' | 'CASH_ON_DELIVERY' | 'CASH_IN_STORE'>('WAVE');

  const localZones = useMemo(
    () =>
      zones
        .filter((zone) => zone.isLocal && !zone.isPickup)
        .map((zone) => ({
          id: zone.id,
          name: zone.name,
          fee: zone.fee,
          neighbourhoods: zone.neighbourhoods,
        })),
    [zones],
  );

  const carrierZones = useMemo(() => zones.filter((zone) => !zone.isLocal && !zone.isPickup), [zones]);

  // À Daloa, c'est le quartier qui détermine le tarif — exactement comme côté serveur.
  const localZone = useMemo(
    () => (neighbourhood ? pickLocalZone(localZones, neighbourhood) ?? null : null),
    [localZones, neighbourhood],
  );

  const carrierZone = carrierZones.find((zone) => zone.id === zoneId) ?? null;

  const shippingFee = useMemo(() => {
    if (deliveryMethod === 'PICKUP') return 0;
    if (deliveryMethod === 'CARRIER') return null; // à convenir sur WhatsApp
    if (!localZone) return null;
    if (localZone.fee === 0) return 0;
    return localZone.fee;
  }, [deliveryMethod, localZone]);

  const total = subtotal + (shippingFee ?? 0);
  const isLocal = deliveryMethod !== 'CARRIER';

  const paymentOptions = useMemo(() => {
    const options: { value: 'WAVE' | 'CASH_ON_DELIVERY' | 'CASH_IN_STORE'; label: string; description: string; icon: typeof Wallet }[] = [
      {
        value: 'WAVE',
        label: t('Wave'),
        description: t('Paiement mobile. Vérifié avant préparation de la commande.'),
        icon: Wallet,
      },
    ];
    if (isLocal && deliveryMethod === 'PICKUP') {
      options.push({
        value: 'CASH_IN_STORE',
        label: t('Paiement en boutique'),
        description: t('Vous payez au retrait, à la boutique de {city}.', { city: store.city }),
        icon: Store,
      });
    }
    if (isLocal && deliveryMethod !== 'PICKUP' && settings.allowCod && settings.codMaxAmount > 0 && total <= settings.codMaxAmount) {
      options.push({
        value: 'CASH_ON_DELIVERY',
        label: t('Paiement à la livraison'),
        description: t('Autorisé par la boutique pour cette livraison et ce montant.'),
        icon: Truck,
      });
    }
    return options;
  }, [isLocal, deliveryMethod, settings.allowCod, settings.codMaxAmount, total, t, store.city]);

  const effectivePayment = paymentOptions.some((o) => o.value === paymentMethod) ? paymentMethod : 'WAVE';
  const err = (key: string) => state.fieldErrors?.[key];

  const transportLink = store.whatsapp
    ? whatsappWithMessage(
        { whatsapp: store.whatsapp },
        transportQuoteMessage({
          city: carrierZone?.city ?? store.city,
          items: lines,
          subtotal,
          customerName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined,
          phone: user?.phone ?? undefined,
        }),
      )
    : null;

  const displayFee = (fee: number) => (fee === 0 ? t('Gratuit') : formatFCFA(fee));

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="deliveryMethod" value={deliveryMethod} />
      <input type="hidden" name="zoneId" value={deliveryMethod === 'CARRIER' ? zoneId : ''} />
      <input type="hidden" name="city" value={carrierZone?.city ?? settings.city} />
      <input type="hidden" name="neighbourhood" value={deliveryMethod === 'LOCAL_DELIVERY' ? neighbourhood : ''} />
      <input type="hidden" name="paymentMethod" value={effectivePayment} />

      <div className="space-y-5">
        {state.error ? (
          <Alert tone="danger" title={t('Commande non enregistrée')}>
            {state.error}
          </Alert>
        ) : null}

        {/* 1. Coordonnées */}
        <section className="rounded-xl border border-navy-100 bg-white p-4" aria-labelledby="coordonnees">
          <h2 id="coordonnees" className="mb-3 flex items-center gap-2 text-base font-bold">
            <span className="grid size-6 place-items-center rounded-full bg-navy-900 text-xs font-bold text-white">1</span>
            {t('Vos coordonnées')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('Prénom')} htmlFor="firstName" required error={err('firstName')}>
              <Input id="firstName" name="firstName" autoComplete="given-name" defaultValue={user?.firstName ?? ''} required />
            </Field>
            <Field label={t('Nom')} htmlFor="lastName" required error={err('lastName')}>
              <Input id="lastName" name="lastName" autoComplete="family-name" defaultValue={user?.lastName ?? ''} required />
            </Field>
            <Field
              label={t('Téléphone')}
              htmlFor="phone"
              required
              error={err('phone')}
              hint={t('Nous vous appelons pour confirmer la commande.')}
            >
              <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0701020304" defaultValue={user?.phone ?? ''} required />
            </Field>
            <Field label={t('E-mail (facultatif)')} htmlFor="email" error={err('email')}>
              <Input id="email" name="email" type="email" autoComplete="email" defaultValue={user?.email ?? ''} />
            </Field>
          </div>
          {!user ? (
            <p className="mt-2 text-xs text-navy-500">
              {t('Commande possible sans compte.')}{' '}
              <Link href="/connexion" className="font-semibold text-accent-700 hover:underline">
                {t('Se connecter')}
              </Link>{' '}
              {t('pour retrouver vos commandes.')}
            </p>
          ) : null}
        </section>

        {/* 2. Livraison */}
        <section className="rounded-xl border border-navy-100 bg-white p-4" aria-labelledby="livraison">
          <h2 id="livraison" className="mb-3 flex items-center gap-2 text-base font-bold">
            <span className="grid size-6 place-items-center rounded-full bg-navy-900 text-xs font-bold text-white">2</span>
            {t('Livraison')}
          </h2>

          <div className="grid gap-2 sm:grid-cols-3">
            {settings.allowPickup ? (
              <MethodButton
                active={deliveryMethod === 'PICKUP'}
                onClick={() => {
                  setDeliveryMethod('PICKUP');
                  setZoneId('');
                }}
                icon={<Store className="size-4" aria-hidden />}
                title={t('Retrait boutique')}
                subtitle={t('Gratuit · sous {hours} h', { hours: PICKUP_HOLD_HOURS })}
              />
            ) : null}
            {settings.allowLocalDelivery ? (
              <MethodButton
                active={deliveryMethod === 'LOCAL_DELIVERY'}
                onClick={() => {
                  setDeliveryMethod('LOCAL_DELIVERY');
                  setZoneId('');
                }}
                icon={<Truck className="size-4" aria-hidden />}
                title={t('Livraison à Daloa')}
                subtitle={t('Vous choisissez votre quartier')}
              />
            ) : null}
            <MethodButton
              active={deliveryMethod === 'CARRIER'}
              onClick={() => {
                setDeliveryMethod('CARRIER');
                setNeighbourhood('');
              }}
              icon={<MapPin className="size-4" aria-hidden />}
              title={t('Hors Daloa')}
              subtitle={t('7 jours max · transport sur WhatsApp')}
            />
          </div>

          {/* Retrait en boutique */}
          {deliveryMethod === 'PICKUP' ? (
            <div className="mt-4 space-y-3">
              <ScheduleCard
                icon={<Store className="size-4" aria-hidden />}
                title={t('Retrait en boutique')}
                detail={
                  store.openingHours
                    ? t('Aux heures d’ouverture : {hours}', { hours: store.openingHours })
                    : t('Aux heures d’ouverture de la boutique (à confirmer par téléphone)')
                }
                badge={t('Gardé {hours} h maximum', { hours: PICKUP_HOLD_HOURS })}
              />
              <div className="rounded-lg bg-navy-50 p-3 text-sm text-navy-700">
                <p className="font-medium">{t('Boutique MeDi Shop — {city}', { city: store.city })}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-navy-600">
                  <span className="inline-flex items-center gap-1 font-semibold text-navy-800">
                    <Navigation className="size-3.5 text-accent-600" aria-hidden /> {store.gps}
                  </span>
                  <a href={store.mapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-700 underline">
                    {t('Voir sur Google Maps')}
                  </a>
                  <a href={store.directionsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-700 underline">
                    {t('Itinéraire')}
                  </a>
                </p>
              </div>
            </div>
          ) : null}

          {/* Livraison à Daloa : le quartier remplace l'adresse */}
          {deliveryMethod === 'LOCAL_DELIVERY' ? (
            <div className="mt-4 space-y-3">
              <Field
                label={t('Votre quartier à Daloa')}
                htmlFor="neighbourhood"
                required
                error={err('neighbourhood')}
                hint={t('La liste reprend les quartiers de Daloa. Le prix de la livraison dépend du quartier.')}
              >
                <Select
                  id="neighbourhood"
                  value={neighbourhood}
                  onChange={(event) => setNeighbourhood(event.target.value)}
                  required
                >
                  <option value="">{t('Choisissez votre quartier…')}</option>
                  {NEIGHBOURHOODS_SORTED.map((entry) => (
                    <option key={entry.name} value={entry.name}>
                      {entry.name}
                    </option>
                  ))}
                </Select>
              </Field>

              {neighbourhood ? (
                <p className="rounded-lg bg-accent-50 px-3 py-2 text-sm font-semibold text-navy-900">
                  {t('Livraison {quartier} : {fee}', {
                    quartier: neighbourhood,
                    fee: localZone ? displayFee(localZone.fee) : t('à confirmer'),
                  })}
                </p>
              ) : null}

              <ScheduleCard
                icon={<CalendarClock className="size-4" aria-hidden />}
                title={t('Jours et heures de livraison')}
                detail={
                  store.openingHours
                    ? t('Du lundi au samedi, pendant les heures d’ouverture : {hours}', { hours: store.openingHours })
                    : t('Du lundi au samedi (horaires à confirmer par téléphone)')
                }
                badge={t('À Daloa : livraison le jour même ou le lendemain')}
              />
            </div>
          ) : null}

          {/* Hors Daloa : une semaine max, transport négocié sur WhatsApp */}
          {deliveryMethod === 'CARRIER' ? (
            <div className="mt-4 space-y-3">
              <Field
                label={t('Ville de livraison')}
                htmlFor="zone"
                required
                error={err('zoneId')}
                hint={t('Le prix du transport se discute sur WhatsApp, selon la ville.')}
              >
                <Select id="zone" value={zoneId} onChange={(event) => setZoneId(event.target.value)} required>
                  <option value="">{t('Choisissez votre ville…')}</option>
                  {carrierZones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.city}
                    </option>
                  ))}
                </Select>
              </Field>

              <ScheduleCard
                icon={<Truck className="size-4" aria-hidden />}
                title={t('Délai hors Daloa')}
                detail={t('{days} jours maximum après confirmation, selon la ville.', { days: OUTSIDE_DALOA_MAX_DAYS })}
                badge={t('Transport à convenir sur WhatsApp')}
              />

              <Alert tone="warning" title={t('Le transport se règle avec la boutique')}>
                {t(
                  'Nous n’ajoutons aucun frais de transport au montant affiché : écrivez-nous sur WhatsApp, nous vous donnons le prix et le délai pour votre ville.',
                )}
              </Alert>

              {transportLink ? (
                <a
                  href={transportLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 sm:w-auto"
                >
                  <MessageCircle className="size-4" aria-hidden />
                  {t('Demander le prix du transport sur WhatsApp')}
                </a>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* 3. Paiement */}
        <section className="rounded-xl border border-navy-100 bg-white p-4" aria-labelledby="paiement">
          <h2 id="paiement" className="mb-3 flex items-center gap-2 text-base font-bold">
            <span className="grid size-6 place-items-center rounded-full bg-navy-900 text-xs font-bold text-white">3</span>
            {t('Paiement')}
          </h2>

          <div className="space-y-2">
            {paymentOptions.map((option) => {
              const Icon = option.icon;
              return (
                <label
                  key={option.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                    effectivePayment === option.value ? 'border-accent-400 bg-accent-50/50' : 'border-navy-200 hover:bg-navy-50',
                  )}
                >
                  <input
                    type="radio"
                    name="paymentChoice"
                    value={option.value}
                    checked={effectivePayment === option.value}
                    onChange={() => setPaymentMethod(option.value)}
                    className="mt-1 accent-accent-500"
                  />
                  <span className="flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                      <Icon className="size-4 text-accent-600" aria-hidden /> {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-navy-600">{option.description}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <PurchaseNotice className="mt-3" />
        </section>
      </div>

      {/* Récapitulatif */}
      <aside className="lg:sticky lg:top-40 lg:self-start">
        <div className="rounded-xl border border-navy-100 bg-white p-4">
          <h2 className="text-base font-bold">{t('Votre commande')}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-navy-600">{t('Sous-total')}</dt>
              <dd className="font-semibold">{formatFCFA(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-navy-600">{t('Livraison')}</dt>
              <dd className="font-semibold">
                {shippingFee === null ? (
                  <span className="text-xs text-navy-500">
                    {deliveryMethod === 'CARRIER' ? t('À convenir sur WhatsApp') : t('Choisissez votre quartier')}
                  </span>
                ) : shippingFee === 0 ? (
                  t('Gratuit')
                ) : (
                  formatFCFA(shippingFee)
                )}
              </dd>
            </div>
            <div className="flex justify-between border-t border-navy-100 pt-2 text-base">
              <dt className="font-bold">{t('Total à payer')}</dt>
              <dd className="font-extrabold text-navy-950">{formatFCFA(total)}</dd>
            </div>
          </dl>

          {deliveryMethod === 'CARRIER' ? (
            <p className="mt-3 rounded-lg bg-accent-50 p-2 text-xs text-navy-800">
              <MessageCircle className="me-1 inline size-3.5" aria-hidden />
              {t('Le transport s’ajoute et se règle après accord sur WhatsApp : aucun frais caché.')}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="mt-4 w-full" loading={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t('Valider la commande')}
          </Button>

          <p className="mt-2 text-center text-[11px] leading-relaxed text-navy-500">
            {t('En validant, vous acceptez les')}{' '}
            <Link href="/cgv" className="underline hover:text-accent-700">
              {t('conditions générales de vente')}
            </Link>{' '}
            {t('et la')}{' '}
            <Link href="/confidentialite" className="underline hover:text-accent-700">
              {t('politique de confidentialité')}
            </Link>
            .
          </p>
        </div>
      </aside>
    </form>
  );
}

function MethodButton({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-col items-start gap-1 rounded-lg border p-3 text-start transition-colors',
        active ? 'border-accent-400 bg-accent-50/60' : 'border-navy-200 hover:bg-navy-50',
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold text-navy-900">
        {icon}
        {title}
      </span>
      <span className="text-xs text-navy-600">{subtitle}</span>
    </button>
  );
}

function ScheduleCard({
  icon,
  title,
  detail,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  badge?: string;
}) {
  return (
    <div className="rounded-lg border border-accent-200 bg-accent-50/60 p-3">
      <p className="flex items-center gap-2 text-sm font-bold text-navy-900">
        <span className="text-accent-700">{icon}</span>
        {title}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-navy-700">{detail}</p>
      {badge ? (
        <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-navy-800 ring-1 ring-accent-300">
          <CalendarClock className="size-3 text-accent-600" aria-hidden />
          {badge}
        </p>
      ) : null}
    </div>
  );
}
