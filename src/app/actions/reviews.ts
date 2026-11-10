'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { requirePermission, clientIpFrom, getCurrentUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';
import {
  ReviewError,
  REVIEW_STATUSES,
  moderateReview,
  submitDeliveryReview,
  submitProductReview,
} from '@/lib/reviews';
import type { ReviewStatus } from '@/lib/review-shared';

export type ReviewFormState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

const ratingSchema = z.coerce.number().int().min(1, 'Choisissez une note de 1 à 5 étoiles.').max(5);

const productReviewSchema = z.object({
  orderId: z.string().min(1),
  orderNumber: z.string().min(1),
  token: z.string().optional(),
  productId: z.string().min(1),
  rating: ratingSchema,
  title: z.string().trim().max(120).optional(),
  comment: z.string().trim().max(2000).optional(),
  authorName: z.string().trim().max(60).optional(),
});

const deliveryReviewSchema = z.object({
  orderId: z.string().min(1),
  orderNumber: z.string().min(1),
  token: z.string().optional(),
  rating: ratingSchema,
  comment: z.string().trim().max(2000).optional(),
  onTime: z.enum(['yes', 'no']).optional(),
});

/**
 * Dépôt d'un avis produit, depuis le suivi de commande.
 *
 * L'accès est prouvé par le numéro de commande **et** le jeton de suivi (ou par
 * le compte connecté) : c'est le même mécanisme que la page `/suivi/[numero]`.
 * Aucun compte n'est créé pour laisser un avis — un client qui a commandé par
 * WhatsApp n'a pas de mot de passe et ne doit pas en inventer un.
 */
export async function submitProductReviewAction(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const parsed = productReviewSchema.safeParse({
    orderId: formData.get('orderId') ?? '',
    orderNumber: formData.get('orderNumber') ?? '',
    token: formData.get('token') || undefined,
    productId: formData.get('productId') ?? '',
    rating: formData.get('rating') ?? 0,
    title: formData.get('title') ?? '',
    comment: formData.get('comment') ?? '',
    authorName: formData.get('authorName') ?? '',
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: 'Vérifiez la note et le commentaire.', fieldErrors };
  }

  const ip = clientIpFrom(await headers());
  const limited = rateLimit(`review:${ip ?? 'anon'}`, 8, 60 * 60);
  if (!limited.allowed) {
    return {
      ok: false,
      message: 'Trop d’avis envoyés depuis cette connexion. Réessayez plus tard ou écrivez-nous sur WhatsApp.',
    };
  }

  const user = await getCurrentUser().catch(() => null);
  const data = parsed.data;

  try {
    // Le jeton de suivi est accepté ; à défaut, un client connecté sur sa
    // propre commande passe par le contrôle de propriété ci-dessous.
    const token = data.token ?? (user ? await tokenForOwnOrder(data.orderId, user.id) : null);

    await submitProductReview({
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      token,
      productId: data.productId,
      rating: data.rating,
      title: data.title,
      comment: data.comment,
      authorName: data.authorName,
      userId: user?.id ?? null,
    });

    revalidatePath(`/suivi/${data.orderNumber}`);
    revalidatePath('/admin/avis');
    return {
      ok: true,
      message: 'Merci ! Votre avis est enregistré. Il sera publié après relecture par la boutique.',
    };
  } catch (error) {
    if (error instanceof ReviewError) return { ok: false, message: error.message };
    console.error('[avis] dépôt impossible', error);
    return { ok: false, message: 'Enregistrement impossible pour le moment. Réessayez dans un instant.' };
  }
}

export async function submitDeliveryReviewAction(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const parsed = deliveryReviewSchema.safeParse({
    orderId: formData.get('orderId') ?? '',
    orderNumber: formData.get('orderNumber') ?? '',
    token: formData.get('token') || undefined,
    rating: formData.get('rating') ?? 0,
    comment: formData.get('comment') ?? '',
    onTime: (formData.get('onTime') as string) || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: 'Choisissez une note de 1 à 5 étoiles pour la livraison.' };
  }

  const ip = clientIpFrom(await headers());
  const limited = rateLimit(`review:${ip ?? 'anon'}`, 8, 60 * 60);
  if (!limited.allowed) {
    return { ok: false, message: 'Trop d’avis envoyés depuis cette connexion. Réessayez plus tard.' };
  }

  const user = await getCurrentUser().catch(() => null);
  const data = parsed.data;

  try {
    const token = data.token ?? (user ? await tokenForOwnOrder(data.orderId, user.id) : null);

    await submitDeliveryReview({
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      token,
      rating: data.rating,
      comment: data.comment,
      onTime: data.onTime === 'yes' ? true : data.onTime === 'no' ? false : null,
    });

    revalidatePath(`/suivi/${data.orderNumber}`);
    revalidatePath('/admin/avis');
    return { ok: true, message: 'Merci ! Votre avis sur la livraison est enregistré.' };
  } catch (error) {
    if (error instanceof ReviewError) return { ok: false, message: error.message };
    console.error('[avis] livraison', error);
    return { ok: false, message: 'Enregistrement impossible pour le moment.' };
  }
}

/**
 * Jeton de suivi d'une commande appartenant à l'utilisateur connecté.
 *
 * Évite d'exiger le jeton dans l'URL quand le client est déjà reconnu par sa
 * session : la commande listée dans « Mes commandes » s'ouvre sans paramètre.
 */
async function tokenForOwnOrder(orderId: string, userId: string): Promise<string | null> {
  const { db } = await import('@/db');
  const { orders } = await import('@/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const [row] = await db
    .select({ accessToken: orders.accessToken })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  return row?.accessToken ?? null;
}

// ─────────────────────────────── Administration ───────────────────────────────

export type ModerationState = { error?: string; success?: string };

/**
 * Publier, masquer ou répondre à un avis.
 *
 * Les avis sont modérés par le service client et les administrateurs. Une
 * réponse est publique : elle porte le nom de la boutique, pas celui de l'agent.
 */
export async function moderateReviewAction(_prev: ModerationState, formData: FormData): Promise<ModerationState> {
  try {
    await requirePermission('messages.handle');
  } catch {
    return { error: 'Action réservée au service client et aux administrateurs.' };
  }

  const kind = String(formData.get('kind') ?? '') === 'delivery' ? 'delivery' : 'product';
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '') as ReviewStatus;
  const replyRaw = formData.get('reply');

  if (!id) return { error: 'Avis introuvable.' };
  if (status && !REVIEW_STATUSES.includes(status)) return { error: 'Statut inconnu.' };

  try {
    const actor = await getCurrentUser();
    await moderateReview({
      kind,
      id,
      status: status || 'PENDING',
      reply: replyRaw === null ? undefined : String(replyRaw),
      actor,
    });

    await audit(actor, {
      action: status === 'PUBLISHED' ? 'review.published' : status === 'HIDDEN' ? 'review.hidden' : 'review.updated',
      entity: kind === 'delivery' ? 'order_review' : 'product_review',
      entityId: id,
      metadata: { status, replied: replyRaw !== null },
      ip: clientIpFrom(await headers()),
    }).catch(() => undefined);

    revalidatePath('/admin/avis');
    revalidatePath('/');
    return { success: 'Avis mis à jour.' };
  } catch (error) {
    if (error instanceof ReviewError) return { error: error.message };
    console.error('[avis] modération', error);
    return { error: 'Mise à jour impossible.' };
  }
}
