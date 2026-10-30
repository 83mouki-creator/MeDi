'use client';

import { useActionState } from 'react';
import { saveSettingsAction, type SettingsState } from '@/app/actions/admin-settings';
import { Button } from '../ui/button';
import { Field, Input, Textarea } from '../ui/form';
import { Alert, Card } from '../ui/primitives';

const initial: SettingsState = {};

export function SettingsForm({
  settings,
}: {
  settings: {
    storeName: string;
    tagline: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    addressLine: string | null;
    city: string;
    openingHours: string | null;
    waveNumber: string | null;
    waveMerchantName: string | null;
    allowCod: boolean;
    codMaxAmount: number;
    allowPickup: boolean;
    allowLocalDelivery: boolean;
    lowStockThreshold: number;
    reservationMinutes: number;
    freeDeliveryAbove: number | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    legalNotice: string | null;
    returnPolicy: string | null;
    latitudeInput: string | null;
    longitudeInput: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-bold">Identité et coordonnées</h2>
        <p className="text-xs text-navy-500">
          Ces informations sont affichées telles quelles sur le site. Laissez vide plutôt que d’inventer une donnée : les pages
          afficheront « à compléter ».
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom de la boutique" htmlFor="storeName">
            <Input id="storeName" name="storeName" defaultValue={settings.storeName} maxLength={80} />
          </Field>
          <Field label="Ville" htmlFor="city">
            <Input id="city" name="city" defaultValue={settings.city} maxLength={80} />
          </Field>
          <Field label="Slogan / accroche" htmlFor="tagline" className="sm:col-span-2">
            <Input id="tagline" name="tagline" defaultValue={settings.tagline ?? ''} maxLength={200} />
          </Field>
          <Field label="Téléphone" htmlFor="phone">
            <Input id="phone" name="phone" type="tel" defaultValue={settings.phone ?? ''} placeholder="+225 ..." />
          </Field>
          <Field label="WhatsApp" htmlFor="whatsapp" hint="Format international, ex. +2250701020304">
            <Input id="whatsapp" name="whatsapp" type="tel" defaultValue={settings.whatsapp ?? ''} />
          </Field>
          <Field label="E-mail" htmlFor="email">
            <Input id="email" name="email" type="email" defaultValue={settings.email ?? ''} />
          </Field>
          <Field label="Adresse de la boutique" htmlFor="addressLine">
            <Input id="addressLine" name="addressLine" defaultValue={settings.addressLine ?? ''} maxLength={200} />
          </Field>
          <Field label="Horaires d’ouverture" htmlFor="openingHours" className="sm:col-span-2">
            <Input id="openingHours" name="openingHours" defaultValue={settings.openingHours ?? ''} maxLength={200} placeholder="Lun–Sam 8h–18h" />
          </Field>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-bold">Géolocalisation de la boutique</h2>
        <p className="text-xs text-navy-500">
          Coordonnées exactes du magasin, relevées sur place (application Plans, GPS du téléphone…). Elles alimentent la carte
          « Nous trouver » et les données structurées pour les moteurs de recherche. Tant que les deux champs sont vides, le site
          n’affiche aucune carte et annonce simplement que la position est en attente : rien n’est estimé.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Latitude" htmlFor="latitude" hint="Entre -90 et 90, ex. 6.877520">
            <Input
              id="latitude"
              name="latitude"
              inputMode="decimal"
              defaultValue={settings.latitudeInput ?? ''}
              placeholder="6.877520"
            />
          </Field>
          <Field label="Longitude" htmlFor="longitude" hint="Entre -180 et 180, ex. -6.450220">
            <Input
              id="longitude"
              name="longitude"
              inputMode="decimal"
              defaultValue={settings.longitudeInput ?? ''}
              placeholder="-6.450220"
            />
          </Field>
        </div>
        <p className="text-xs text-navy-500">
          Les deux champs vont ensemble : une coordonnée seule est refusée à l’enregistrement. Laissez les deux vides pour
          désactiver l’affichage de la carte.
        </p>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-bold">Paiement</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Numéro Wave marchand" htmlFor="waveNumber" hint="Affiché aux clients pour le paiement manuel.">
            <Input id="waveNumber" name="waveNumber" defaultValue={settings.waveNumber ?? ''} placeholder="+225 ..." />
          </Field>
          <Field label="Nom du compte Wave" htmlFor="waveMerchantName">
            <Input id="waveMerchantName" name="waveMerchantName" defaultValue={settings.waveMerchantName ?? ''} />
          </Field>
          <Field label="Plafond paiement à la livraison (FCFA)" htmlFor="codMaxAmount" hint="0 ou case décochée = paiement à la livraison désactivé.">
            <Input id="codMaxAmount" name="codMaxAmount" type="number" min={0} step={500} defaultValue={settings.codMaxAmount} />
          </Field>
          <Field label="Franche livraison au-delà de (FCFA, local)" htmlFor="freeDeliveryAbove">
            <Input id="freeDeliveryAbove" name="freeDeliveryAbove" type="number" min={0} step={500} defaultValue={settings.freeDeliveryAbove ?? ''} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allowCod" defaultChecked={settings.allowCod} className="size-4 accent-accent-500" />
          Autoriser le paiement à la livraison (zone locale uniquement)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allowPickup" defaultChecked={settings.allowPickup} className="size-4 accent-accent-500" />
          Autoriser le retrait en boutique
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allowLocalDelivery" defaultChecked={settings.allowLocalDelivery} className="size-4 accent-accent-500" />
          Autoriser la livraison à domicile à Daloa
        </label>
        <p className="text-xs text-navy-500">
          Hors de Daloa, le prépaiement Wave reste obligatoire indépendamment de ces options.
        </p>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-bold">Stock et réservations</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Seuil de stock faible par défaut" htmlFor="lowStockThreshold">
            <Input id="lowStockThreshold" name="lowStockThreshold" type="number" min={0} step={1} defaultValue={settings.lowStockThreshold} />
          </Field>
          <Field label="Durée de réservation du stock (minutes)" htmlFor="reservationMinutes" hint="Au-delà, la réservation est libérée automatiquement.">
            <Input id="reservationMinutes" name="reservationMinutes" type="number" min={15} step={15} defaultValue={settings.reservationMinutes} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-bold">Pages légales et réseaux</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Page Facebook" htmlFor="facebookUrl">
            <Input id="facebookUrl" name="facebookUrl" defaultValue={settings.facebookUrl ?? ''} />
          </Field>
          <Field label="Page Instagram" htmlFor="instagramUrl">
            <Input id="instagramUrl" name="instagramUrl" defaultValue={settings.instagramUrl ?? ''} />
          </Field>
        </div>
        <Field label="Mentions légales / informations commerciales" htmlFor="legalNotice">
          <Textarea id="legalNotice" name="legalNotice" rows={4} defaultValue={settings.legalNotice ?? ''} maxLength={4000} />
        </Field>
        <Field label="Politique de retour" htmlFor="returnPolicy">
          <Textarea id="returnPolicy" name="returnPolicy" rows={4} defaultValue={settings.returnPolicy ?? ''} maxLength={4000} />
        </Field>
      </Card>

      <Button type="submit" size="lg" loading={pending}>Enregistrer les paramètres</Button>
    </form>
  );
}
