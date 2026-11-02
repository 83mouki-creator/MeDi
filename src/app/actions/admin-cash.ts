'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { clientIpFrom, requirePermission } from '@/lib/auth';
import { CashError, closeCashSession, getOpenCashSession, openCashSession } from '@/lib/cash';

export type CashActionState = { error?: string; success?: string };

/** Ouvre la caisse du jour avec le fond de caisse compté. */
export async function openCashAction(_prev: CashActionState, formData: FormData): Promise<CashActionState> {
  let actor;
  try {
    actor = await requirePermission('payments.confirm');
  } catch {
    return { error: 'Action non autorisée pour votre rôle.' };
  }

  const openingFloat = Number(formData.get('openingFloat') ?? 0);
  const note = String(formData.get('note') ?? '').trim() || null;

  try {
    await openCashSession({ openingFloat, note, actor });
    void clientIpFrom(await headers());
    revalidatePath('/admin/caisse');
    return { success: 'Caisse ouverte. Bonne journée !' };
  } catch (error) {
    if (error instanceof CashError) return { error: error.message };
    console.error('[caisse] ouverture', error);
    return { error: 'Impossible d’ouvrir la caisse.' };
  }
}

/** Ferme la caisse en enregistrant le comptage réel et l'écart. */
export async function closeCashAction(_prev: CashActionState, formData: FormData): Promise<CashActionState> {
  let actor;
  try {
    actor = await requirePermission('payments.confirm');
  } catch {
    return { error: 'Action non autorisée pour votre rôle.' };
  }

  const session = await getOpenCashSession();
  if (!session) return { error: 'Aucune caisse n’est ouverte.' };

  const countedCash = Number(formData.get('countedCash') ?? 0);
  const note = String(formData.get('note') ?? '').trim() || null;

  try {
    const result = await closeCashSession({ sessionId: session.id, countedCash, note, actor });
    revalidatePath('/admin/caisse');
    const gap = result.difference;
    return {
      success:
        `Caisse fermée. Attendu ${result.expected} FCFA, compté ${result.counted} FCFA — ` +
        (gap === 0 ? 'caisse juste.' : gap > 0 ? `excédent de ${gap} FCFA.` : `manque de ${Math.abs(gap)} FCFA.`),
    };
  } catch (error) {
    if (error instanceof CashError) return { error: error.message };
    console.error('[caisse] fermeture', error);
    return { error: 'Impossible de fermer la caisse.' };
  }
}
