'use client';

import { useActionState } from 'react';
import { saveAddressAction, updateProfileAction, resetPasswordAction, type AuthState } from '@/app/actions/auth';
import { Button } from './ui/button';
import { Field, Input } from './ui/form';
import { Alert } from './ui/primitives';

const initial: AuthState = {};

export function ProfileForm({
  user,
}: {
  user: { firstName: string | null; lastName: string | null; phone: string | null; email: string };
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="firstName" required error={state.fieldErrors?.firstName}>
          <Input id="firstName" name="firstName" defaultValue={user.firstName ?? ''} required />
        </Field>
        <Field label="Nom" htmlFor="lastName" required error={state.fieldErrors?.lastName}>
          <Input id="lastName" name="lastName" defaultValue={user.lastName ?? ''} required />
        </Field>
      </div>
      <Field label="Téléphone" htmlFor="phone" required error={state.fieldErrors?.phone}>
        <Input id="phone" name="phone" type="tel" defaultValue={user.phone ?? ''} required />
      </Field>
      <Field label="Adresse e-mail" htmlFor="email" required error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" defaultValue={user.email} required />
      </Field>
      <Button type="submit" loading={pending}>Enregistrer</Button>
    </form>
  );
}

export function AddressForm({
  address,
}: {
  address?: {
    id: string;
    label: string | null;
    recipientName: string;
    phone: string;
    city: string;
    commune: string | null;
    addressLine: string;
    landmark: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(saveAddressAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      {address ? <input type="hidden" name="id" value={address.id} /> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Libellé (facultatif)" htmlFor="label">
          <Input id="label" name="label" placeholder="Maison, bureau…" defaultValue={address?.label ?? ''} />
        </Field>
        <Field label="Destinataire" htmlFor="recipientName" required error={state.fieldErrors?.recipientName}>
          <Input id="recipientName" name="recipientName" defaultValue={address?.recipientName ?? ''} required />
        </Field>
        <Field label="Téléphone" htmlFor="phone" required error={state.fieldErrors?.phone}>
          <Input id="phone" name="phone" type="tel" defaultValue={address?.phone ?? ''} required />
        </Field>
        <Field label="Ville" htmlFor="city" required error={state.fieldErrors?.city}>
          <Input id="city" name="city" defaultValue={address?.city ?? 'Daloa'} required />
        </Field>
        <Field label="Commune / quartier" htmlFor="commune">
          <Input id="commune" name="commune" defaultValue={address?.commune ?? ''} />
        </Field>
        <Field label="Point de repère" htmlFor="landmark">
          <Input id="landmark" name="landmark" defaultValue={address?.landmark ?? ''} />
        </Field>
      </div>
      <Field label="Adresse" htmlFor="addressLine" required error={state.fieldErrors?.addressLine}>
        <Input id="addressLine" name="addressLine" defaultValue={address?.addressLine ?? ''} required />
      </Field>
      <Button type="submit" loading={pending}>{address ? 'Mettre à jour' : 'Ajouter l’adresse'}</Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field label="Nouveau mot de passe" htmlFor="password" required error={state.fieldErrors?.password} hint="10 caractères minimum, lettres et chiffres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>Définir le mot de passe</Button>
    </form>
  );
}
