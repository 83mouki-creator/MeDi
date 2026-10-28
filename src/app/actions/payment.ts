'use server';

import { revalidatePath } from 'next/cache';
import { submitPaymentReference, OrderError } from '@/lib/orders';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { headers } from 'next/headers';
import { clientIpFrom } from '@/lib/auth';

export type PaymentReferenceState = { ok?: boolean; error?: string; message?: string };

/** Le client déclare sa référence de transaction : la commande reste « à vérifier ». */
export async function submitPaymentReferenceAction(
  _prev: PaymentReferenceState,
  formData: FormData,
): Promise<PaymentReferenceState> {
  const orderId = String(formData.get('orderId') ?? '');
  const reference = String(formData.get('reference') ?? '');
  const token = String(formData.get('token') ?? '');

  const h = await headers();
  const limit = rateLimit(`pay-ref:${clientIpFrom(h) ?? 'local'}`, 10, 300);
  if (!limit.allowed) return { error: 'Trop de tentatives. Réessayez dans quelques minutes.' };

  const user = await getCurrentUser();

  try {
    await submitPaymentReference({
      orderId,
      reference,
      expectedAccessToken: token || undefined,
      userId: user?.id ?? null,
    });
    revalidatePath('/suivi');
    return {
      ok: true,
      message:
        'Référence enregistrée. La commande reste « paiement à vérifier » jusqu’à contrôle du crédit réel sur le compte marchand. Une capture d’écran ne suffit pas.',
    };
  } catch (error) {
    if (error instanceof OrderError) return { error: error.message };
    console.error('[payment] référence non enregistrée', error);
    return { error: 'Impossible d’enregistrer la référence. Réessayez ou contactez la boutique.' };
  }
}
