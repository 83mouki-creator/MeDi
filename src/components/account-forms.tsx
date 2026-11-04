'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  deleteAccountAction,
  saveAddressAction,
  updateProfileAction,
  resetPasswordAction,
  type AuthState,
} from '@/app/actions/auth';
import { Button } from './ui/button';
import { Field, Input } from './ui/form';
import { Alert } from './ui/primitives';
import { useSiteT } from './site-i18n';

const initial: AuthState = {};

export function ProfileForm({
  user,
}: {
  user: { firstName: string | null; lastName: string | null; phone: string | null; email: string };
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initial);
  const t = useSiteT();

  return (
    <form action={formAction} className="space-y-3">
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('Prénom')} htmlFor="firstName" required error={state.fieldErrors?.firstName}>
          <Input id="firstName" name="firstName" defaultValue={user.firstName ?? ''} required />
        </Field>
        <Field label={t('Nom')} htmlFor="lastName" required error={state.fieldErrors?.lastName}>
          <Input id="lastName" name="lastName" defaultValue={user.lastName ?? ''} required />
        </Field>
      </div>
      <Field label={t('Téléphone')} htmlFor="phone" required error={state.fieldErrors?.phone}>
        <Input id="phone" name="phone" type="tel" defaultValue={user.phone ?? ''} required />
      </Field>
      <Field label={t('Adresse e-mail')} htmlFor="email" required error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" defaultValue={user.email} required />
      </Field>
      <Button type="submit" loading={pending}>{t('Enregistrer')}</Button>
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
  const t = useSiteT();

  return (
    <form action={formAction} className="space-y-3">
      {address ? <input type="hidden" name="id" value={address.id} /> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('Libellé (facultatif)')} htmlFor="label">
          <Input id="label" name="label" placeholder={t('Maison, bureau…')} defaultValue={address?.label ?? ''} />
        </Field>
        <Field label={t('Destinataire')} htmlFor="recipientName" required error={state.fieldErrors?.recipientName}>
          <Input id="recipientName" name="recipientName" defaultValue={address?.recipientName ?? ''} required />
        </Field>
        <Field label={t('Téléphone')} htmlFor="phone" required error={state.fieldErrors?.phone}>
          <Input id="phone" name="phone" type="tel" defaultValue={address?.phone ?? ''} required />
        </Field>
        <Field label={t('Ville')} htmlFor="city" required error={state.fieldErrors?.city}>
          <Input id="city" name="city" defaultValue={address?.city ?? 'Daloa'} required />
        </Field>
        <Field label={t('Commune / quartier')} htmlFor="commune">
          <Input id="commune" name="commune" defaultValue={address?.commune ?? ''} />
        </Field>
        <Field label={t('Point de repère')} htmlFor="landmark">
          <Input id="landmark" name="landmark" defaultValue={address?.landmark ?? ''} />
        </Field>
      </div>
      <Field label={t('Adresse')} htmlFor="addressLine" required error={state.fieldErrors?.addressLine}>
        <Input id="addressLine" name="addressLine" defaultValue={address?.addressLine ?? ''} required />
      </Field>
      <Button type="submit" loading={pending}>{address ? t('Mettre à jour') : t('Ajouter l’adresse')}</Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initial);
  const t = useSiteT();

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field label={t('Nouveau mot de passe')} htmlFor="password" required error={state.fieldErrors?.password} hint={t('10 caractères minimum, lettres et chiffres.')}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>{t('Définir le mot de passe')}</Button>
    </form>
  );
}

/**
 * Suppression du compte par le client (exigence Google Play pour l'app Android).
 *
 * Le formulaire demande de recopier SUPPRIMER et le mot de passe : deux gestes
 * volontaires pour une action irréversible. En cas de succès, l'action serveur
 * efface le compte puis redirige vers la page de confirmation.
 */
export function DeleteAccountForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, formAction, pending] = useActionState(deleteAccountAction, initial);
  const t = useSiteT();

  return (
    <form action={formAction} className="space-y-3">
      <Alert tone="danger">
        {t('Cette action est définitive et immédiate : votre compte ne pourra pas être restauré.')}
      </Alert>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field
        label={t('Écrivez SUPPRIMER en majuscules')}
        htmlFor="confirmation"
        required
        error={state.fieldErrors?.confirmation}
        hint={t('Ce mot confirme que la demande est bien volontaire.')}
      >
        <Input id="confirmation" name="confirmation" autoComplete="off" required />
      </Field>
      {hasPassword ? (
        <Field label={t('Votre mot de passe')} htmlFor="delete-password" required error={state.fieldErrors?.password}>
          <Input id="delete-password" name="password" type="password" autoComplete="current-password" required />
        </Field>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="danger" loading={pending}>
          {t('Supprimer définitivement mon compte')}
        </Button>
        <Link href="/compte" className="text-sm font-medium text-navy-700 underline">
          {t('Annuler et revenir à mon compte')}
        </Link>
      </div>
    </form>
  );
}
