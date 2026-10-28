'use client';

import { useActionState } from 'react';
import { Field, Input, Textarea } from './ui/form';
import { Button } from './ui/button';
import { Alert } from './ui/primitives';
import { sendContactMessage, type ContactState } from '@/app/actions/contact';

const initial: ContactState = { ok: false, message: '' };

export function ContactForm({ defaultEmail, defaultName }: { defaultEmail?: string; defaultName?: string }) {
  const [state, action, pending] = useActionState(sendContactMessage, initial);

  if (state.ok) {
    return (
      <Alert tone="success" title="Message envoyé">
        {state.message}
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Votre nom" htmlFor="name" required error={state.fieldErrors?.name}>
          <Input id="name" name="name" autoComplete="name" defaultValue={defaultName} required maxLength={120} />
        </Field>
        <Field label="E-mail" htmlFor="email" required error={state.fieldErrors?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" defaultValue={defaultEmail} required />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Téléphone / WhatsApp" htmlFor="phone" hint="Pour être rappelé plus vite.">
          <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+225 …" />
        </Field>
        <Field label="Numéro de commande" htmlFor="orderNumber" hint="Si votre demande concerne une commande.">
          <Input id="orderNumber" name="orderNumber" placeholder="MED-2026-01024" />
        </Field>
      </div>

      <Field label="Objet" htmlFor="subject" required error={state.fieldErrors?.subject}>
        <Input id="subject" name="subject" required maxLength={160} placeholder="Disponibilité d’un produit, suivi, facture…" />
      </Field>

      <Field label="Votre message" htmlFor="message" required error={state.fieldErrors?.message}>
        <Textarea id="message" name="message" rows={5} required minLength={10} maxLength={4000} />
      </Field>

      <label className="flex items-start gap-2 text-sm text-navy-600">
        <input type="checkbox" name="consent" required className="mt-1 size-4 shrink-0 rounded border-navy-300" />
        <span>
          J’accepte que mes coordonnées soient utilisées pour traiter ma demande, conformément à la{' '}
          <a href="/confidentialite" className="font-medium text-accent-700 underline">politique de confidentialité</a>.
        </span>
      </label>
      {state.fieldErrors?.consent ? <p className="text-xs text-danger-500">{state.fieldErrors.consent}</p> : null}

      <Button type="submit" loading={pending}>Envoyer le message</Button>
    </form>
  );
}
