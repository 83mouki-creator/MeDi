'use client';

import { useActionState } from 'react';
import { useAdminI18n } from '@/components/admin/admin-i18n';
import { createStaffAction, type StaffState } from '@/app/actions/admin-staff';
import { Button } from '../ui/button';
import { Field, Input, Select } from '../ui/form';
import { Alert } from '../ui/primitives';
import { StaffCodeCard } from './staff-code-card';

const initial: StaffState = {};

export type RoleOption = { value: string; label: string; description: string; home: string };

/**
 * Création d'un agent par un administrateur.
 *
 * Il n'y a **pas** de mot de passe ici : l'administrateur saisit l'identité, le
 * téléphone ivoirien et la tâche ; MeDi génère un code à usage unique, l'envoie
 * par WhatsApp et l'affiche une seule fois pour transmission manuelle.
 */
export function StaffForm({ roles }: { roles: RoleOption[] }) {
  const { t } = useAdminI18n();
  const [state, formAction, pending] = useActionState(createStaffAction, initial);
  const errors = state.fieldErrors ?? {};

  if (state.invitation) {
    return (
      <div className="space-y-3">
        <Alert tone="success">{state.success ?? ''}</Alert>
        <StaffCodeCard invitation={state.invitation} />
        <p className="text-xs text-navy-500">
          {t('Le code n’est plus affiché par la suite : il est stocké chiffré. En cas d’oubli, générez-en un nouveau depuis la liste.')}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {state.error ? (
        <div className="sm:col-span-2 lg:col-span-3">
          <Alert tone="danger">{state.error}</Alert>
        </div>
      ) : null}

      <Field label={t('Prénom')} htmlFor="staff-first-name" required error={errors.firstName}>
        <Input id="staff-first-name" name="firstName" autoComplete="off" required minLength={2} />
      </Field>
      <Field label={t('Nom')} htmlFor="staff-last-name" required error={errors.lastName}>
        <Input id="staff-last-name" name="lastName" autoComplete="off" required minLength={2} />
      </Field>
      <Field
        label={t('Téléphone (Côte d’Ivoire)')}
        htmlFor="staff-phone"
        required
        error={errors.phone}
        hint={t('Format ivoirien : 07 08 90 48 91 ou +225 07 08 90 48 91.')}
      >
        <Input id="staff-phone" name="phone" type="tel" inputMode="tel" placeholder="07 08 90 48 91" required />
      </Field>

      <Field
        label={t('Tâche assignée')}
        htmlFor="staff-task"
        required
        error={errors.staffTask}
        hint={t('Ex. « Caisse du matin », « Réception des livraisons », « Saisie du catalogue ».')}
      >
        <Input id="staff-task" name="staffTask" required minLength={3} />
      </Field>

      <Field
        label={t('Rôle')}
        htmlFor="staff-role"
        required
        error={errors.role}
        hint={t('Le rôle fixe les écrans et les actions autorisés.')}
      >
        <Select id="staff-role" name="role" defaultValue="CASHIER" required>
          {roles.map((role) => (
            <option key={role.value} value={role.value}>
              {t(role.label)}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={t('Adresse e-mail (facultatif)')}
        htmlFor="staff-email"
        error={errors.email}
        hint={t('Laissez vide : l’agent se connecte avec son numéro de téléphone.')}
      >
        <Input id="staff-email" name="email" type="email" autoComplete="off" />
      </Field>

      <div className="flex items-end sm:col-span-2 lg:col-span-3">
        <Button type="submit" loading={pending}>
          {t('Créer l’agent et générer son code')}
        </Button>
      </div>
    </form>
  );
}
