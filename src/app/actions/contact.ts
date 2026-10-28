'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { db } from '@/db';
import { contactMessages } from '@/db/schema';
import { getCurrentUser, clientIpFrom } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { newId } from '@/lib/utils';

export type ContactState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

const schema = z.object({
  name: z.string().trim().min(2, 'Indiquez votre nom (2 caractères minimum).').max(120),
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.').max(160),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((value) => (value ? value : undefined)),
  subject: z.string().trim().min(3, 'Précisez l’objet de votre demande.').max(160),
  message: z.string().trim().min(10, 'Décrivez votre demande (10 caractères minimum).').max(4000),
  orderNumber: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((value) => (value ? value.toUpperCase() : undefined)),
  consent: z.literal('on', { message: 'Vous devez accepter l’utilisation de vos données pour être recontacté.' }),
});

export async function sendContactMessage(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const parsed = schema.safeParse({
    name: formData.get('name') ?? '',
    email: formData.get('email') ?? '',
    phone: formData.get('phone') ?? '',
    subject: formData.get('subject') ?? '',
    message: formData.get('message') ?? '',
    orderNumber: formData.get('orderNumber') ?? '',
    consent: formData.get('consent') ?? '',
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: 'Vérifiez les champs signalés.', fieldErrors };
  }

  const h = await headers();
  const ip = clientIpFrom(h);
  const limited = rateLimit(`contact:${ip ?? 'anon'}`, 5, 10 * 60);
  if (!limited.allowed) {
    return { ok: false, message: 'Trop de messages envoyés. Réessayez dans quelques minutes.' };
  }

  const user = await getCurrentUser().catch(() => null);
  const data = parsed.data;

  try {
    await db.insert(contactMessages).values({
      id: newId('msg_'),
      userId: user?.id ?? null,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      subject: data.subject,
      message: data.message,
      orderNumber: data.orderNumber ?? null,
      ip,
    });
  } catch (error) {
    console.error('[contact] enregistrement impossible', error);
    return { ok: false, message: 'Votre message n’a pas pu être enregistré. Réessayez ou appelez la boutique.' };
  }

  return {
    ok: true,
    message:
      'Message reçu. La boutique vous répond par e-mail ou par téléphone pendant ses heures d’ouverture. Conservez votre numéro de commande si votre demande le concerne.',
  };
}
