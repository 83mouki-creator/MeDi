'use client';

import { useActionState } from 'react';
import { activateOwnerAction, type ActivationState } from '@/app/actions/admin-activation';
import { Button } from './ui/button';
import { Field, Input } from './ui/form';
import { Alert } from './ui/primitives';

const initial: ActivationState = {};

export function AdminActivationForm({ token, defaultName }: { token: string; defaultName: string }) {
  const [state, formAction, pending] = useActionState(activateOwnerAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field label="Nom affiché" htmlFor="name" required error={state.fieldErrors?.name} hint="Le nom qui apparaît dans l’en-tête du site et dans le journal d’activité.">
        <Input id="name" name="name" defaultValue={defaultName} autoComplete="organization" required minLength={2} />
      </Field>

      <Field label="Adresse e-mail" htmlFor="email" required error={state.fieldErrors?.email} hint="C’est l’identifiant de connexion à l’administration.">
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>

      <Field
        label="Mot de passe"
        htmlFor="password"
        required
        error={state.fieldErrors?.password}
        hint="10 caractères minimum, avec au moins une lettre et un chiffre. Il n’est jamais communiqué à personne."
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>

      <Field label="Confirmer le mot de passe" htmlFor="passwordConfirm" required error={state.fieldErrors?.passwordConfirm}>
        <Input id="passwordConfirm" name="passwordConfirm" type="password" autoComplete="new-password" required minLength={10} />
      </Field>

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Créer mon compte propriétaire
      </Button>
    </form>
  );
}
