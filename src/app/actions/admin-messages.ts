'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { contactMessages } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { audit } from '@/lib/audit';

const ALLOWED = new Set(['NEW', 'IN_PROGRESS', 'CLOSED']);

/**
 * Fait avancer une demande client reçue via le formulaire de contact.
 * Le statut est validé côté serveur, l'action est journalisée.
 */
export async function setMessageStatusAction(formData: FormData): Promise<void> {
  const user = await requirePermission('orders.write');

  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  const replyNote = String(formData.get('replyNote') ?? '').trim().slice(0, 2000);

  if (!id || !ALLOWED.has(status)) return;

  const existing = await db
    .select({ id: contactMessages.id, status: contactMessages.status })
    .from(contactMessages)
    .where(eq(contactMessages.id, id))
    .limit(1);
  if (existing.length === 0) return;

  await db
    .update(contactMessages)
    .set({
      status,
      replyNote: replyNote || null,
      handledBy: user.id,
      handledAt: status === 'NEW' ? null : new Date(),
    })
    .where(eq(contactMessages.id, id));

  await audit(user, {
    action: 'contact.message_status',
    entity: 'contact_message',
    entityId: id,
    metadata: { from: existing[0].status, to: status },
  });

  revalidatePath('/admin/messages');
}
