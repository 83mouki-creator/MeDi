'use client';

import { useActionState } from 'react';
import { createManagedUserAction, type AuthState } from '@/app/actions/auth';
import { Button } from '../ui/button';
import { Field, Input, Select } from '../ui/form';
import { Alert } from '../ui/primitives';

const initial: AuthState = {};

export function ManagedUserForm() {
  const [state, formAction, pending] = useActionState(createManagedUserAction, initial);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {state.success ? <div className="sm:col-span-2 lg:col-span-3"><Alert tone="success">{state.success}</Alert></div> : null}
      {state.error ? <div className="sm:col-span-2 lg:col-span-3"><Alert tone="danger">{state.error}</Alert></div> : null}
      <Field label="E-mail" htmlFor="new-user-email" required error={state.fieldErrors?.email}>
        <Input id="new-user-email" name="email" type="email" required />
      </Field>
      <Field label="Prénom" htmlFor="new-user-first">
        <Input id="new-user-first" name="firstName" />
      </Field>
      <Field label="Nom" htmlFor="new-user-last">
        <Input id="new-user-last" name="lastName" />
      </Field>
      <Field label="Rôle" htmlFor="new-user-role" required>
        <Select id="new-user-role" name="role" defaultValue="ORDER_MANAGER">
          <option value="ADMIN">Administrateur</option>
          <option value="STOCK_MANAGER">Gestionnaire de stock</option>
          <option value="ORDER_MANAGER">Gestionnaire des commandes</option>
          <option value="OWNER">Propriétaire</option>
        </Select>
      </Field>
      <Field label="Mot de passe temporaire" htmlFor="new-user-password" required error={state.fieldErrors?.password} hint="12 caractères minimum. À changer à la première connexion.">
        <Input id="new-user-password" name="password" type="password" required minLength={12} autoComplete="new-password" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" loading={pending}>Créer le compte</Button>
      </div>
    </form>
  );
}
