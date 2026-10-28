'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction, registerAction, requestPasswordResetAction, changePasswordAction, type AuthState } from '@/app/actions/auth';
import { Button } from './ui/button';
import { Field, Input } from './ui/form';
import { Alert } from './ui/primitives';

const initial: AuthState = {};

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field label="Adresse e-mail" htmlFor="email" required error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Mot de passe" htmlFor="password" required error={state.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Se connecter
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="firstName" required error={state.fieldErrors?.firstName}>
          <Input id="firstName" name="firstName" autoComplete="given-name" required />
        </Field>
        <Field label="Nom" htmlFor="lastName" required error={state.fieldErrors?.lastName}>
          <Input id="lastName" name="lastName" autoComplete="family-name" required />
        </Field>
      </div>
      <Field label="Adresse e-mail" htmlFor="email" required error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Téléphone" htmlFor="phone" required error={state.fieldErrors?.phone} hint="Ex. 0701020304">
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required />
      </Field>
      <Field
        label="Mot de passe"
        htmlFor="password"
        required
        error={state.fieldErrors?.password}
        hint="10 caractères minimum, avec au moins une lettre et un chiffre."
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <label className="flex items-start gap-2 text-sm text-navy-700">
        <input type="checkbox" name="acceptTerms" className="mt-0.5 size-4 accent-accent-500" required />
        <span>
          J&apos;accepte les{' '}
          <Link href="/cgv" className="font-medium text-accent-700 underline">conditions générales de vente</Link> et la{' '}
          <Link href="/confidentialite" className="font-medium text-accent-700 underline">politique de confidentialité</Link>.
        </span>
      </label>
      {state.fieldErrors?.acceptTerms ? <p className="text-xs text-danger-500">{state.fieldErrors.acceptTerms}</p> : null}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Créer mon compte
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field label="Adresse e-mail du compte" htmlFor="email" required error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" required />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>
        Envoyer la demande
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field label="Mot de passe actuel" htmlFor="currentPassword" required error={state.fieldErrors?.currentPassword}>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="Nouveau mot de passe" htmlFor="newPassword" required error={state.fieldErrors?.newPassword}>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Button type="submit" loading={pending}>Modifier le mot de passe</Button>
    </form>
  );
}
