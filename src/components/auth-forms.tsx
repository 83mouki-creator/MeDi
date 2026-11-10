'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction, registerAction, requestPasswordResetAction, changePasswordAction, type AuthState } from '@/app/actions/auth';
import { Button } from './ui/button';
import { Field, Input } from './ui/form';
import { PasswordInput } from './ui/password-input';
import { Alert } from './ui/primitives';
import { useSiteT } from './site-i18n';

const initial: AuthState = {};

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initial);
  const t = useSiteT();

  return (
    <form action={formAction} className="space-y-3">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field
        label={t('Adresse e-mail ou téléphone')}
        htmlFor="identifier"
        required
        error={state.fieldErrors?.identifier}
        hint={t('Agents : votre numéro ivoirien suffit (ex. 05 44 01 41 82).')}
      >
        <Input id="identifier" name="identifier" autoComplete="username" required />
      </Field>
      <Field label={t('Mot de passe')} htmlFor="password" required error={state.fieldErrors?.password}>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t('Se connecter')}
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initial);
  const t = useSiteT();

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('Prénom')} htmlFor="firstName" required error={state.fieldErrors?.firstName}>
          <Input id="firstName" name="firstName" autoComplete="given-name" required />
        </Field>
        <Field label={t('Nom')} htmlFor="lastName" required error={state.fieldErrors?.lastName}>
          <Input id="lastName" name="lastName" autoComplete="family-name" required />
        </Field>
      </div>
      <Field label={t('Adresse e-mail')} htmlFor="email" required error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label={t('Téléphone')} htmlFor="phone" required error={state.fieldErrors?.phone} hint={t('Ex. 0701020304')}>
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required />
      </Field>
      <Field
        label={t('Mot de passe')}
        htmlFor="password"
        required
        error={state.fieldErrors?.password}
        hint={t('10 caractères minimum, avec au moins une lettre et un chiffre.')}
      >
        <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <label className="flex items-start gap-2 text-sm text-navy-700">
        <input type="checkbox" name="acceptTerms" className="mt-0.5 size-4 accent-accent-500" required />
        <span>
          {t('J’accepte les')}{' '}
          <Link href="/cgv" className="font-medium text-accent-700 underline">{t('conditions générales de vente')}</Link> {t('et la')}{' '}
          <Link href="/confidentialite" className="font-medium text-accent-700 underline">{t('politique de confidentialité')}</Link>.
        </span>
      </label>
      {state.fieldErrors?.acceptTerms ? <p className="text-xs text-danger-500">{state.fieldErrors.acceptTerms}</p> : null}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t('Créer mon compte')}
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initial);
  const t = useSiteT();

  return (
    <form action={formAction} className="space-y-3">
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field
        label={t('E-mail ou téléphone du compte')}
        htmlFor="identifier"
        required
        error={state.fieldErrors?.identifier}
        hint={t('Le lien de réinitialisation est envoyé par e-mail si le service est configuré ; sinon la boutique vous le transmet par WhatsApp.')}
      >
        <Input id="identifier" name="identifier" required />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>
        {t('Envoyer la demande')}
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initial);
  const t = useSiteT();

  return (
    <form action={formAction} className="space-y-3">
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field label={t('Mot de passe actuel')} htmlFor="currentPassword" required error={state.fieldErrors?.currentPassword}>
        <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" required />
      </Field>
      <Field label={t('Nouveau mot de passe')} htmlFor="newPassword" required error={state.fieldErrors?.newPassword}>
        <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" required minLength={10} />
      </Field>
      <Button type="submit" loading={pending}>{t('Modifier le mot de passe')}</Button>
    </form>
  );
}
