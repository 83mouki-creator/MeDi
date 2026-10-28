'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { CreditCard, Loader2, MapPin, Store, Truck, Wallet } from 'lucide-react';
import { placeOrderAction, type CheckoutState } from '@/app/actions/checkout';
import { Button } from './ui/button';
import { Alert } from './ui/primitives';
import { Field, Input, Select, Textarea } from './ui/form';
import { cn, formatFCFA } from '@/lib/utils';

export type ZoneOption = {
  id: string;
  name: string;
  city: string;
  isLocal: boolean;
  isPickup: boolean;
  fee: number;
  freeAbove: number | null;
  estimatedDelay: string | null;
};

type Props = {
  items: { productId: string; quantity: number }[];
  subtotal: number;
  zones: ZoneOption[];
  user: { firstName: string | null; lastName: string | null; phone: string | null; email: string } | null;
  settings: { allowCod: boolean; codMaxAmount: number; allowPickup: boolean; allowLocalDelivery: boolean; city: string };
};

const initialState: CheckoutState = {};

export function CheckoutForm({ items, subtotal, zones, user, settings }: Props) {
  const [state, formAction, pending] = useActionState(placeOrderAction, initialState);
  const [deliveryMethod, setDeliveryMethod] = useState<'PICKUP' | 'LOCAL_DELIVERY' | 'CARRIER'>(
    settings.allowPickup ? 'PICKUP' : 'LOCAL_DELIVERY',
  );
  const [zoneId, setZoneId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'WAVE' | 'CASH_ON_DELIVERY' | 'CASH_IN_STORE'>('WAVE');

  const eligibleZones = useMemo(() => {
    if (deliveryMethod === 'PICKUP') return zones.filter((z) => z.isPickup);
    if (deliveryMethod === 'LOCAL_DELIVERY') return zones.filter((z) => z.isLocal && !z.isPickup);
    return zones.filter((z) => !z.isLocal);
  }, [deliveryMethod, zones]);

  const zone = zones.find((z) => z.id === zoneId) ?? (eligibleZones.length === 1 ? eligibleZones[0] : undefined);

  const shippingFee = useMemo(() => {
    if (deliveryMethod === 'PICKUP') return 0;
    if (!zone) return null;
    if (deliveryMethod === 'LOCAL_DELIVERY' && zone.freeAbove !== null && subtotal >= zone.freeAbove) return 0;
    return zone.fee;
  }, [deliveryMethod, zone, subtotal]);

  const total = subtotal + (shippingFee ?? 0);
  const isLocal = deliveryMethod !== 'CARRIER';

  const paymentOptions = useMemo(() => {
    const options: { value: 'WAVE' | 'CASH_ON_DELIVERY' | 'CASH_IN_STORE'; label: string; description: string; icon: typeof Wallet }[] = [
      { value: 'WAVE', label: 'Wave', description: 'Paiement mobile. Vérifié avant préparation de la commande.', icon: Wallet },
    ];
    if (isLocal && deliveryMethod === 'PICKUP') {
      options.push({ value: 'CASH_IN_STORE', label: 'Paiement en boutique', description: 'Vous payez au retrait, à la boutique de Daloa.', icon: Store });
    }
    if (isLocal && deliveryMethod !== 'PICKUP' && settings.allowCod && settings.codMaxAmount > 0 && total <= settings.codMaxAmount) {
      options.push({ value: 'CASH_ON_DELIVERY', label: 'Paiement à la livraison', description: 'Autorisé par la boutique pour cette zone et ce montant.', icon: Truck });
    }
    return options;
  }, [isLocal, deliveryMethod, settings.allowCod, settings.codMaxAmount, total]);

  const effectivePayment = paymentOptions.some((o) => o.value === paymentMethod) ? paymentMethod : 'WAVE';

  const err = (key: string) => state.fieldErrors?.[key];

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="deliveryMethod" value={deliveryMethod} />
      <input type="hidden" name="zoneId" value={zone?.id ?? ''} />
      <input type="hidden" name="city" value={zone?.city ?? settings.city} />
      <input type="hidden" name="paymentMethod" value={effectivePayment} />

      <div className="space-y-5">
        {state.error ? <Alert tone="danger" title="Commande non enregistrée">{state.error}</Alert> : null}

        <section className="rounded-xl border border-navy-100 bg-white p-4" aria-labelledby="coordonnees">
          <h2 id="coordonnees" className="mb-3 flex items-center gap-2 text-base font-bold">
            <span className="grid size-6 place-items-center rounded-full bg-navy-900 text-xs font-bold text-white">1</span>
            Vos coordonnées
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Prénom" htmlFor="firstName" required error={err('firstName')}>
              <Input id="firstName" name="firstName" autoComplete="given-name" defaultValue={user?.firstName ?? ''} required />
            </Field>
            <Field label="Nom" htmlFor="lastName" required error={err('lastName')}>
              <Input id="lastName" name="lastName" autoComplete="family-name" defaultValue={user?.lastName ?? ''} required />
            </Field>
            <Field label="Téléphone" htmlFor="phone" required error={err('phone')} hint="Nous vous appelons pour confirmer la commande.">
              <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0701020304" defaultValue={user?.phone ?? ''} required />
            </Field>
            <Field label="E-mail (facultatif)" htmlFor="email" error={err('email')}>
              <Input id="email" name="email" type="email" autoComplete="email" defaultValue={user?.email ?? ''} />
            </Field>
          </div>
          {!user ? (
            <p className="mt-2 text-xs text-navy-500">
              Commande possible sans compte. <Link href="/connexion" className="font-semibold text-accent-700 hover:underline">Se connecter</Link> pour retrouver vos commandes.
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-navy-100 bg-white p-4" aria-labelledby="livraison">
          <h2 id="livraison" className="mb-3 flex items-center gap-2 text-base font-bold">
            <span className="grid size-6 place-items-center rounded-full bg-navy-900 text-xs font-bold text-white">2</span>
            Livraison
          </h2>

          <div className="grid gap-2 sm:grid-cols-3">
            {settings.allowPickup ? (
              <MethodButton
                active={deliveryMethod === 'PICKUP'}
                onClick={() => { setDeliveryMethod('PICKUP'); setZoneId(''); }}
                icon={<Store className="size-4" aria-hidden />}
                title="Retrait boutique"
                subtitle={`Gratuit · ${settings.city}`}
              />
            ) : null}
            {settings.allowLocalDelivery ? (
              <MethodButton
                active={deliveryMethod === 'LOCAL_DELIVERY'}
                onClick={() => { setDeliveryMethod('LOCAL_DELIVERY'); setZoneId(''); }}
                icon={<Truck className="size-4" aria-hidden />}
                title="Livraison locale"
                subtitle={`${settings.city} et environs`}
              />
            ) : null}
            <MethodButton
              active={deliveryMethod === 'CARRIER'}
              onClick={() => { setDeliveryMethod('CARRIER'); setZoneId(''); }}
              icon={<MapPin className="size-4" aria-hidden />}
              title="Hors Daloa"
              subtitle="Expédition · prépaiement"
            />
          </div>

          {deliveryMethod !== 'PICKUP' ? (
            <div className="mt-4 grid gap-3">
              <Field label="Zone de destination" htmlFor="zone" required error={err('zoneId')}>
                <Select
                  id="zone"
                  value={zone?.id ?? ''}
                  onChange={(event) => setZoneId(event.target.value)}
                  required
                >
                  <option value="">Sélectionnez une zone…</option>
                  {eligibleZones.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} — {formatFCFA(option.fee)}
                      {option.estimatedDelay ? ` · ${option.estimatedDelay}` : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={deliveryMethod === 'CARRIER' ? 'Commune / quartier' : 'Quartier'} htmlFor="commune" required={deliveryMethod === 'CARRIER'} error={err('commune')}>
                  <Input id="commune" name="commune" placeholder="Ex. Tazibouo" />
                </Field>
                <Field label="Point de repère" htmlFor="landmark" hint="Facilite la livraison.">
                  <Input id="landmark" name="landmark" placeholder="Face à la pharmacie…" />
                </Field>
              </div>

              <Field label={deliveryMethod === 'CARRIER' ? 'Adresse du destinataire' : 'Adresse de livraison'} htmlFor="addressLine" required error={err('addressLine')}>
                <Textarea id="addressLine" name="addressLine" rows={2} placeholder="Rue, numéro, indications d'accès…" />
              </Field>

              {deliveryMethod === 'CARRIER' ? (
                <Field
                  label="Transporteur souhaité"
                  htmlFor="carrier"
                  required
                  error={err('carrier')}
                  hint="La boutique confirme le transporteur et le numéro de suivi après paiement."
                >
                  <Input id="carrier" name="carrier" placeholder="Ex. car, transporteur, gare routière…" />
                </Field>
              ) : null}

              {deliveryMethod === 'CARRIER' ? (
                <Alert tone="warning" title="Prépaiement obligatoire hors Daloa">
                  Les frais de transport sont ajoutés au total ci-contre. La commande ne sera préparée qu&apos;après confirmation
                  effective du paiement par la boutique.
                </Alert>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 rounded-lg bg-navy-50 p-3 text-sm text-navy-700">
              <p className="font-medium">Retrait à la boutique MeDi — {settings.city}</p>
              <p className="mt-1 text-xs text-navy-600">
                Vous serez contacté dès que la commande est prête. Aucun frais de livraison.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-navy-100 bg-white p-4" aria-labelledby="paiement">
          <h2 id="paiement" className="mb-3 flex items-center gap-2 text-base font-bold">
            <span className="grid size-6 place-items-center rounded-full bg-navy-900 text-xs font-bold text-white">3</span>
            Paiement
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

          <Field label="Note pour la boutique (facultatif)" htmlFor="customerNote" className="mt-3">
            <Textarea id="customerNote" name="customerNote" rows={2} maxLength={500} placeholder="Précisions sur la commande, heure de retrait…" />
          </Field>
        </section>
      </div>

      {/* Récapitulatif */}
      <aside className="lg:sticky lg:top-40 lg:self-start">
        <div className="rounded-xl border border-navy-100 bg-white p-4">
          <h2 className="text-base font-bold">Votre commande</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-navy-600">Sous-total</dt>
              <dd className="font-semibold">{formatFCFA(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-navy-600">{deliveryMethod === 'CARRIER' ? 'Frais de transport' : 'Livraison'}</dt>
              <dd className="font-semibold">
                {shippingFee === null ? <span className="text-xs text-navy-400">Choisissez une zone</span> : shippingFee === 0 ? 'Gratuit' : formatFCFA(shippingFee)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-navy-100 pt-2 text-base">
              <dt className="font-bold">Total à payer</dt>
              <dd className="font-extrabold text-navy-950">{formatFCFA(total)}</dd>
            </div>
          </dl>

          {!isLocal ? (
            <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
              <CreditCard className="mr-1 inline size-3.5" aria-hidden />
              Paiement Wave obligatoire avant expédition. La commande passe en préparation après vérification du paiement.
            </p>
          ) : null}

          <Button type="submit" size="lg" className="mt-4 w-full" loading={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Valider la commande
          </Button>

          <p className="mt-2 text-center text-[11px] leading-relaxed text-navy-500">
            En validant, vous acceptez les{' '}
            <Link href="/cgv" className="underline hover:text-accent-700">conditions générales de vente</Link> et la{' '}
            <Link href="/confidentialite" className="underline hover:text-accent-700">politique de confidentialité</Link>.
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
        'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
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
