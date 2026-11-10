'use server';

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { productStickers, stickers, type StickerIcon, type StickerTone } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { newId } from '@/lib/utils';
import {
  MAX_STICKERS_PER_PRODUCT,
  STICKER_ICONS,
  STICKER_TONES,
  applyStickerToProducts,
  removeStickerFromProduct,
  searchProductIds,
  setProductStickers,
} from '@/lib/stickers';

export type StickerState = { error?: string; success?: string };

const TONES = new Set<string>(STICKER_TONES);
const ICONS = new Set<string>(STICKER_ICONS);

function text(value: FormDataEntryValue | null): string {
  return String(value ?? '').trim();
}

function optional(value: FormDataEntryValue | null): string | null {
  const cleaned = text(value);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Date saisie dans un `<input type="date">` → minuit ou fin de journée.
 *
 * `endsAt` est poussé à 23:59:59 : un sticker qui se termine « le 30 » doit
 * rester visible toute la journée du 30, pas disparaître à minuit.
 */
function parseDate(value: FormDataEntryValue | null, endOfDay = false): Date | null {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(`${raw}T${endOfDay ? '23:59:59' : '00:00:00'}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function revalidateStorefront() {
  revalidatePath('/admin/stickers');
  revalidatePath('/');
  revalidatePath('/catalogue');
}

/**
 * Crée ou met à jour un sticker.
 *
 * Un sticker est une vignette réutilisable (« Garantie 12 mois », « -20 % ») :
 * il est défini une fois, puis affecté à des produits. Le libellé est ce que le
 * client lit sur la photo, d'où la limite de longueur.
 */
export async function saveStickerAction(_prev: StickerState, formData: FormData): Promise<StickerState> {
  let actor;
  try {
    actor = await requirePermission('products.write');
  } catch {
    return { error: 'Action réservée aux personnes qui gèrent les produits.' };
  }

  const id = optional(formData.get('id'));
  const label = text(formData.get('label'));
  const detail = optional(formData.get('detail'));
  const toneInput = text(formData.get('tone')) || 'GOLD';
  const iconInput = text(formData.get('icon')) || 'none';
  const startsAt = parseDate(formData.get('startsAt'));
  const endsAt = parseDate(formData.get('endsAt'), true);
  const isActive = formData.get('isActive') === 'on';

  if (label.length < 2) return { error: 'Le texte du sticker est trop court (2 caractères minimum).' };
  if (label.length > 40) return { error: 'Le texte du sticker ne doit pas dépasser 40 caractères : il doit rester lisible sur la photo.' };
  if (detail && detail.length > 60) return { error: 'Le détail ne doit pas dépasser 60 caractères.' };
  if (!TONES.has(toneInput)) return { error: 'Couleur inconnue.' };
  if (!ICONS.has(iconInput)) return { error: 'Symbole inconnu.' };
  if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
    return { error: 'La date de fin est antérieure à la date de début.' };
  }

  const values = {
    label,
    detail,
    tone: toneInput as StickerTone,
    icon: iconInput as StickerIcon,
    startsAt,
    endsAt,
    isActive,
    updatedAt: new Date(),
  };

  try {
    if (id) {
      const existing = await db.select({ id: stickers.id }).from(stickers).where(eq(stickers.id, id)).limit(1);
      if (!existing[0]) return { error: 'Ce sticker n’existe plus.' };
      await db.update(stickers).set(values).where(eq(stickers.id, id));
      await audit(actor, { action: 'sticker.updated', entity: 'stickers', entityId: id, metadata: { label } });
    } else {
      const newIdValue = newId('stk_');
      await db.insert(stickers).values({ id: newIdValue, createdByUserId: actor.id, ...values });
      await audit(actor, { action: 'sticker.created', entity: 'stickers', entityId: newIdValue, metadata: { label } });
    }
  } catch (error) {
    console.error('[stickers] enregistrement impossible', error);
    return { error: 'Le sticker n’a pas pu être enregistré. Réessayez.' };
  }

  revalidateStorefront();
  return { success: id ? 'Sticker mis à jour.' : 'Sticker créé. Affectez-le maintenant à des produits.' };
}

/** Active ou désactive un sticker sans le supprimer (il reste affecté). */
export async function toggleStickerAction(formData: FormData): Promise<void> {
  let actor;
  try {
    actor = await requirePermission('products.write');
  } catch {
    return;
  }
  const id = text(formData.get('id'));
  if (!id) return;

  const rows = await db.select({ isActive: stickers.isActive }).from(stickers).where(eq(stickers.id, id)).limit(1);
  if (!rows[0]) return;
  const next = !rows[0].isActive;
  await db.update(stickers).set({ isActive: next, updatedAt: new Date() }).where(eq(stickers.id, id));
  await audit(actor, { action: next ? 'sticker.activated' : 'sticker.deactivated', entity: 'stickers', entityId: id });
  revalidateStorefront();
}

/**
 * Supprime définitivement un sticker, en le retirant d'abord des produits.
 *
 * La suppression est volontairement en cascade : laisser des lignes orphelines
 * ferait apparaître un sticker fantôme sur des fiches produit.
 */
export async function deleteStickerAction(formData: FormData): Promise<void> {
  let actor;
  try {
    actor = await requirePermission('products.write');
  } catch {
    return;
  }
  const id = text(formData.get('id'));
  if (!id) return;

  await db.delete(productStickers).where(eq(productStickers.stickerId, id));
  await db.delete(stickers).where(eq(stickers.id, id));
  await audit(actor, { action: 'sticker.deleted', entity: 'stickers', entityId: id });
  revalidateStorefront();
}

/**
 * Affecte un sticker à une sélection de produits.
 *
 * `scope = 'all'` cible tous les produits publiés ; `scope = 'selection'` cible
 * les identifiants cochés (ou la recherche en cours). Le mode `add` respecte la
 * limite de deux stickers par produit ; `replace` écrase l'existant pour ne
 * garder que celui-ci.
 */
export async function assignStickerAction(_prev: StickerState, formData: FormData): Promise<StickerState> {
  let actor;
  try {
    actor = await requirePermission('products.write');
  } catch {
    return { error: 'Action réservée aux personnes qui gèrent les produits.' };
  }

  const stickerId = text(formData.get('stickerId'));
  const scope = text(formData.get('scope')) || 'selection';
  const mode = text(formData.get('mode')) === 'replace' ? 'replace' : 'add';
  const query = text(formData.get('query'));

  if (!stickerId) return { error: 'Choisissez d’abord un sticker.' };

  const stickerRows = await db.select({ id: stickers.id, label: stickers.label }).from(stickers).where(eq(stickers.id, stickerId)).limit(1);
  if (!stickerRows[0]) return { error: 'Ce sticker n’existe plus.' };

  let productIds: string[] = [];
  try {
    if (scope === 'all') {
      // Tous les produits publiés, hors archives : c'est le « applicable à tous
      // les produits » demandé par la boutique.
      const all = await db.execute(sql`SELECT id FROM products WHERE is_archived = false`);
      productIds = (all.rows as { id: string }[]).map((row) => row.id);
    } else if (scope === 'search' && query) {
      const found = await searchProductIds(query, 500);
      productIds = found.map((row) => row.id);
    } else {
      productIds = formData.getAll('productIds').map(String).filter(Boolean);
    }
  } catch (error) {
    console.error('[stickers] sélection de produits impossible', error);
    return { error: 'La sélection de produits n’a pas pu être lue.' };
  }

  if (productIds.length === 0) {
    return {
      error:
        scope === 'all'
          ? 'Aucun produit publié : ajoutez d’abord des produits au catalogue.'
          : 'Cochez au moins un produit (ou choisissez « tous les produits »).',
    };
  }

  try {
    const result = await applyStickerToProducts({ stickerId, productIds, mode });
    await audit(actor, {
      action: 'sticker.assigned',
      entity: 'stickers',
      entityId: stickerId,
      metadata: { scope, mode, applied: result.applied, skipped: result.skipped },
    });
    revalidateStorefront();

    const parts = [`« ${stickerRows[0].label} » appliqué à ${result.applied} produit(s).`];
    if (result.skipped > 0) {
      parts.push(
        `${result.skipped} produit(s) ignoré(s) : ils ont déjà ${MAX_STICKERS_PER_PRODUCT} stickers. Choisissez « remplacer » pour les écraser.`,
      );
    }
    return { success: parts.join(' ') };
  } catch (error) {
    console.error('[stickers] affectation impossible', error);
    return { error: 'L’affectation a échoué. Réessayez.' };
  }
}

/** Retire un sticker d'un produit précis (depuis la fiche produit). */
export async function unassignStickerAction(formData: FormData): Promise<void> {
  let actor;
  try {
    actor = await requirePermission('products.write');
  } catch {
    return;
  }
  const productId = text(formData.get('productId'));
  const stickerId = text(formData.get('stickerId'));
  if (!productId || !stickerId) return;

  await removeStickerFromProduct(productId, stickerId);
  await audit(actor, { action: 'sticker.unassigned', entity: 'products', entityId: productId, metadata: { stickerId } });
  revalidateStorefront();
  revalidatePath(`/admin/produits/${productId}`);
}

/**
 * Enregistre les (au plus deux) stickers d'un produit et leur position.
 *
 * `position 0` s'affiche en bas à gauche de la photo, `position 1` en bas à
 * droite : c'est ce que le client voit dans la grille du catalogue.
 */
export async function setProductStickersAction(_prev: StickerState, formData: FormData): Promise<StickerState> {
  let actor;
  try {
    actor = await requirePermission('products.write');
  } catch {
    return { error: 'Action réservée aux personnes qui gèrent les produits.' };
  }

  const productId = text(formData.get('productId'));
  if (!productId) return { error: 'Produit introuvable.' };

  const left = optional(formData.get('stickerLeft'));
  const right = optional(formData.get('stickerRight'));
  const chosen = [left, right].filter((value): value is string => Boolean(value));
  if (new Set(chosen).size !== chosen.length) {
    return { error: 'Le même sticker ne peut pas occuper les deux emplacements.' };
  }

  try {
    await setProductStickers(productId, chosen);
    await audit(actor, {
      action: 'sticker.product_updated',
      entity: 'products',
      entityId: productId,
      metadata: { stickers: chosen },
    });
    revalidateStorefront();
    revalidatePath(`/admin/produits/${productId}`);
    return { success: 'Stickers du produit enregistrés.' };
  } catch (error) {
    console.error('[stickers] produit non mis à jour', error);
    return { error: 'Les stickers du produit n’ont pas pu être enregistrés.' };
  }
}
