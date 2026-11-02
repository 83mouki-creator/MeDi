'use client';

import { useActionState, useState } from 'react';
import { activateStaffAccessAction, type StaffState } from '@/app/actions/admin-staff';
import { formatStaffCodeInput } from '@/lib/staff-access';
import { Button } from './ui/button';
import { Field, Input } from './ui/form';
import { PasswordInput } from './ui/password-input';
import { Alert } from './ui/primitives';

const initial: StaffState = {};

/**
 * Activation d'un accès agent : code d'accès + nom + téléphone, puis mot de passe.
 * Aucun compte ne se crée ici — le compte existe déjà, créé par un administrateur.
 */
export function StaffActivationForm() {
  const [state, formAction, pending] = useActionState(activateStaffAccessAction, initial);
  const [code, setCode] = useState('');
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field
        label="Code d’accès reçu par WhatsApp"
        htmlFor="code"
        required
        error={errors.code}
        hint="Format MEDI-XXXX-XXXX-XXXX. La casse et les tirets sont corrigés automatiquement."
      >
        <Input
          id="code"
          name="code"
          value={code}
          onChange={(event) => setCode(formatStaffCodeInput(event.target.value).slice(0, 19))}
          placeholder="MEDI-XXXX-XXXX-XXXX"
          autoComplete="one-time-code"
          spellCheck={false}
          required
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="staff-first-name" required error={errors.firstName}>
          <Input id="staff-first-name" name="firstName" autoComplete="given-name" required />
        </Field>
        <Field label="Nom" htmlFor="staff-last-name" required error={errors.lastName}>
          <Input id="staff-last-name" name="lastName" autoComplete="family-name" required />
        </Field>
      </div>

      <Field
        label="Téléphone ivoirien"
        htmlFor="staff-phone"
        required
        error={errors.phone}
        hint="Le numéro que l’administrateur a enregistré (ex. 07 08 90 48 91)."
      >
        <Input id="staff-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required />
      </Field>

      <Field
        label="Nouveau mot de passe"
        htmlFor="staff-password"
        required
        error={errors.password}
        hint="10 caractères minimum, avec au moins une lettre et un chiffre."
      >
        <PasswordInput id="staff-password" name="password" autoComplete="new-password" required minLength={10} />
      </Field>

      <Field label="Confirmer le mot de passe" htmlFor="staff-password-confirm" required>
        <PasswordInput id="staff-password-confirm" name="passwordConfirm" autoComplete="new-password" required minLength={10} />
      </Field>

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Activer mon accès
      </Button>
    </form>
  );
}
