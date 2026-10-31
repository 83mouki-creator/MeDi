'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { clientIpFrom, createSession } from '@/lib/auth';
import { createFirstOwner } from '@/lib/admin-activation';
import { audit } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';

export type ActivationState = { error?: string; fieldErrors?: Record<string, string> };

/**
 * Crée le premier compte propriétaire puis ouvre la session.
 * Le jeton est vérifié de nouveau ici : la page ne peut pas être contournée
 * en appelant directement l'action.
 */
export async function activateOwnerAction(_prev: ActivationState, formData: FormData): Promise<ActivationState> {
  const h = await headers();
  const ip = clientIpFrom(h);
  const limit = rateLimit(`activation-admin:${ip ?? 'local'}`, 8, 600);
  if (!limit.allowed) return { error: 'Trop de tentatives. Réessayez dans quelques minutes.' };

  const result = await createFirstOwner({
    token: String(formData.get('token') ?? ''),
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    passwordConfirm: String(formData.get('passwordConfirm') ?? ''),
  });

  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors };

  await createSession(result.userId);
  await audit(
    { id: result.userId, email: result.email, firstName: result.name, lastName: '', phone: null, role: 'OWNER' },
    { action: 'admin.owner_created', entity: 'user', entityId: result.userId, ip },
  );

  redirect('/admin');
}
