'use server';

import { headers } from 'next/headers';
import { clientIpFrom, requirePermission } from '@/lib/auth';
import { createPromoCampaign, stopPromoCampaign, PromoError, type PromoCampaignType } from '@/lib/promos';
import { refreshStorefront } from '@/lib/revalidate';

export type PromoActionState = { error?: string; success?: string };

function parseDate(value: FormDataEntryValue | null, endOfDay = false) {
  const text = String(value ?? '').trim();
  if (!text) return new Date(Number.NaN);
  // `<input type="date">` : on fixe le début à 00:00 et la fin à 23:59 locales.
  const date = new Date(`${text}T${endOfDay ? '23:59:59' : '00:00:00'}`);
  return date;
}

/** Crée une opération commerciale : remise appliquée tout de suite sur la vitrine. */
export async function createPromoAction(_prev: PromoActionState, formData: FormData): Promise<PromoActionState> {
  let actor;
  try {
    actor = await requirePermission('products.write');
  } catch {
    return { error: 'Action non autorisée pour votre rôle.' };
  }

  const type: PromoCampaignType = formData.get('type') === 'FIXED' ? 'FIXED' : 'PERCENT';
  const productIds = formData
    .getAll('productIds')
    .map((value) => String(value))
    .filter(Boolean);

  try {
    const result = await createPromoCampaign({
      name: String(formData.get('name') ?? ''),
      bannerText: String(formData.get('bannerText') ?? ''),
      type,
      value: Number(formData.get('value') ?? 0),
      startsAt: parseDate(formData.get('startsAt')),
      endsAt: parseDate(formData.get('endsAt'), true),
      productIds,
      actor,
    });
    refreshStorefront();
    return { success: `Opération créée : ${result.productCount} produit(s) en promotion, visible immédiatement sur le site.` };
  } catch (error) {
    if (error instanceof PromoError) return { error: error.message };
    console.error('[promo] création', error);
    return { error: 'Impossible de créer l’opération.' };
  }
}

/** Arrête une opération : les prix d'avant reviennent sur le site. */
export async function stopPromoAction(_prev: PromoActionState, formData: FormData): Promise<PromoActionState> {
  let actor;
  try {
    actor = await requirePermission('products.write');
  } catch {
    return { error: 'Action non autorisée pour votre rôle.' };
  }

  const campaignId = String(formData.get('campaignId') ?? '');
  if (!campaignId) return { error: 'Opération introuvable.' };

  try {
    const result = await stopPromoCampaign(campaignId, actor);
    refreshStorefront();
    return {
      success: result.alreadyStopped
        ? 'Cette opération était déjà arrêtée.'
        : `Opération arrêtée : ${result.productCount ?? 0} produit(s) revenu(s) au prix normal.`,
    };
  } catch (error) {
    if (error instanceof PromoError) return { error: error.message };
    console.error('[promo] arrêt', error);
    return { error: 'Impossible d’arrêter cette opération.' };
  }
}
