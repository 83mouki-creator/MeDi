'use client';

import { useActionState, useState } from 'react';
import { BadgeCheck, CheckCircle2, MessageSquareQuote, Star, ThumbsUp, Truck } from 'lucide-react';
import { submitDeliveryReviewAction, submitProductReviewAction, type ReviewFormState } from '@/app/actions/reviews';
import { Alert, Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { cn, formatDate } from '@/lib/utils';
import { useSiteI18n } from '@/components/site-i18n';
import { REVIEW_STATUS_LABELS } from '@/lib/review-shared';
import type { OrderReviewContext, PublicProductReview, RatingSummary, ReviewStatus } from '@/lib/review-shared';

const initial: ReviewFormState = { ok: false, message: '' };

const STATUS_LABELS: Record<ReviewStatus, string> = REVIEW_STATUS_LABELS;

// ────────────────────────────── Affichage des étoiles ──────────────────────────────

/**
 * Cinq étoiles, dont `value` remplies.
 *
 * Purement décoratif : la note est toujours écrite à côté (« 4,5 sur 5 »), donc
 * une couleur qui passerait mal en impression ne fait perdre l'information à
 * personne.
 */
export function Stars({
  value,
  size = 16,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-hidden>
      {[1, 2, 3, 4, 5].map((star) => {
        const full = rounded >= star;
        const half = !full && rounded >= star - 0.5;
        return (
          <span key={star} className="relative inline-block" style={{ width: size, height: size }}>
            <Star
              className="absolute inset-0 text-amber-300"
              style={{ width: size, height: size }}
              strokeWidth={1.5}
            />
            {(full || half) && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: full ? size : size / 2 }}
              >
                <Star
                  className="fill-amber-400 text-amber-400"
                  style={{ width: size, height: size }}
                  strokeWidth={1.5}
                />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** Note + nombre d'avis, en une ligne : « ★★★★☆ 4,5 (12 avis) ». */
export function RatingLine({
  summary,
  className,
  showCount = true,
}: {
  summary: RatingSummary;
  className?: string;
  showCount?: boolean;
}) {
  const { t } = useSiteI18n();
  if (summary.count === 0) return null;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-navy-600', className)}>
      <Stars value={summary.average} size={14} />
      <span className="font-semibold text-navy-900">{summary.average.toFixed(1).replace('.', ',')}</span>
      {showCount ? <span>· {t('{count} avis', { count: summary.count })}</span> : null}
    </span>
  );
}

// ────────────────────────────── Bloc avis sur la fiche produit ──────────────────────────────

/**
 * Avis publiés d'un article.
 *
 * Rien ne s'affiche tant qu'aucun avis n'a été publié : une fiche sans avis n'a
 * pas à porter un cadre vide « 0 avis », qui donne l'impression d'un échec. La
 * note est alors simplement absente — comme avant que le module existe.
 */
export function ProductReviews({
  reviews,
  summary,
}: {
  reviews: PublicProductReview[];
  summary: RatingSummary;
}) {
  const { t } = useSiteI18n();
  if (reviews.length === 0) return null;

  return (
    <section aria-labelledby="avis-title" className="mt-6 rounded-xl border border-navy-100 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="avis-title" className="flex items-center gap-2 text-lg font-bold">
          <MessageSquareQuote className="size-4 text-accent-600" aria-hidden /> {t('Avis des clients')}
        </h2>
        <RatingLine summary={summary} />
      </div>
      <p className="mt-1 text-xs text-navy-500">
        {t('Uniquement des clients dont la commande a été livrée : chaque avis est rattaché à un achat vérifié.')}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-[150px_1fr]">
        <div className="rounded-lg bg-navy-50 p-3 text-center">
          <p className="text-3xl font-extrabold text-navy-950">{summary.average.toFixed(1).replace('.', ',')}</p>
          <Stars value={summary.average} size={16} className="mt-1 justify-center" />
          <p className="mt-1 text-[11px] text-navy-500">{t('{count} avis vérifiés', { count: summary.count })}</p>
        </div>
        <ul className="space-y-1 text-xs text-navy-600">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const count = summary.distribution[star];
            const percent = summary.count ? Math.round((count / summary.count) * 100) : 0;
            return (
              <li key={star} className="flex items-center gap-2">
                <span className="w-8 shrink-0 tabular-nums">{star} ★</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-100">
                  <span className="block h-full rounded-full bg-amber-400" style={{ width: `${percent}%` }} />
                </span>
                <span className="w-8 shrink-0 text-right tabular-nums">{count}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <ul className="mt-4 divide-y divide-navy-100">
        {reviews.map((review) => (
          <li key={review.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Stars value={review.rating} size={14} />
              <span className="text-xs font-semibold text-navy-900">
                {review.rating} / 5
              </span>
              <Badge tone="success" className="gap-1">
                <BadgeCheck className="size-3" aria-hidden /> {t('Achat vérifié')}
              </Badge>
              <span className="text-[11px] text-navy-400">{formatDate(review.createdAt)}</span>
            </div>
            {review.title ? <p className="mt-1 text-sm font-semibold text-navy-900">{review.title}</p> : null}
            {review.comment ? <p className="mt-1 whitespace-pre-line text-sm text-navy-700">{review.comment}</p> : null}
            <p className="mt-1 text-[11px] text-navy-500">{review.authorName}</p>
            {review.reply ? (
              <div className="mt-2 rounded-lg border border-navy-100 bg-navy-50/60 p-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-navy-500">
                  {t('Réponse de la boutique')}
                </p>
                <p className="mt-0.5 whitespace-pre-line text-xs text-navy-700">{review.reply}</p>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ────────────────────────────── Formulaire client ──────────────────────────────

function StarPicker({ name, defaultValue }: { name: string; defaultValue?: number }) {
  const { t } = useSiteI18n();
  const [value, setValue] = useState(defaultValue ?? 0);

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center gap-1" role="radiogroup" aria-label={t('Votre note')}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={t('{count} étoile(s)', { count: star })}
            onClick={() => setValue(star)}
            className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-400"
          >
            <Star
              className="size-7"
              style={{}}
              fill={value >= star ? '#fbbf24' : 'none'}
              stroke={value >= star ? '#f59e0b' : '#94a3b8'}
              strokeWidth={1.5}
            />
          </button>
        ))}
        <span className="ml-2 text-xs text-navy-500">
          {value === 0
            ? t('Choisissez une note')
            : value <= 2
              ? t('Dites-nous ce qui n’a pas été')
              : value === 3
                ? t('Correct')
                : value === 4
                  ? t('Très bien')
                  : t('Excellent')}
        </span>
      </div>
    </div>
  );
}

/** Formulaire d'avis sur un article reçu. */
export function ProductReviewForm({
  orderId,
  orderNumber,
  token,
  productId,
  productName,
  existing,
  defaultAuthor,
}: {
  orderId: string;
  orderNumber: string;
  token?: string | null;
  productId: string;
  productName: string;
  existing?: { rating: number; comment: string | null; status: ReviewStatus; title?: string | null } | null;
  defaultAuthor?: string | null;
}) {
  const { t } = useSiteI18n();
  const [state, formAction, pending] = useActionState(submitProductReviewAction, initial);

  if (state.ok) {
    return (
      <Alert tone="success" title={t('Merci pour votre avis')}>
        {state.message}
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="orderNumber" value={orderNumber} />
      {token ? <input type="hidden" name="token" value={token} /> : null}
      <input type="hidden" name="productId" value={productId} />

      <p className="text-sm font-semibold text-navy-900">{productName}</p>
      {existing ? (
        <p className="text-[11px] text-navy-500">
          {t('Votre avis actuel :')} {existing.rating}/5 · {STATUS_LABELS[existing.status]}
          {' — '}
          {t('vous pouvez le corriger ci-dessous.')}
        </p>
      ) : null}

      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <StarPicker name="rating" defaultValue={existing?.rating} />

      <Field label={t('Titre (facultatif)')} htmlFor={`title-${productId}`} hint={t('Ex. « Solide et conforme à la photo ».')}>
        <Input id={`title-${productId}`} name="title" maxLength={120} defaultValue={existing?.title ?? ''} />
      </Field>

      <Field
        label={t('Votre commentaire')}
        htmlFor={`comment-${productId}`}
        hint={t('Ce qui vous a plu, ce qui vous a gêné, la qualité réelle de l’article.')}
      >
        <Textarea
          id={`comment-${productId}`}
          name="comment"
          rows={3}
          maxLength={2000}
          defaultValue={existing?.comment ?? ''}
          placeholder={t('Ex. Livré en deux jours à Daloa, la perceuse fonctionne très bien.')}
        />
      </Field>

      <Field label={t('Nom affiché (facultatif)')} htmlFor={`author-${productId}`} hint={t('Prénom suffisant : nous n’affichons jamais votre nom complet.')}>
        <Input id={`author-${productId}`} name="authorName" maxLength={60} defaultValue={defaultAuthor ?? ''} placeholder="Awa K." />
      </Field>

      <Button type="submit" size="sm" loading={pending}>
        {existing ? t('Mettre à jour mon avis') : t('Envoyer mon avis')}
      </Button>
      <p className="text-[11px] text-navy-500">
        {t('Votre avis est relu avant publication. Il sera visible sur la fiche du produit.')}
      </p>
    </form>
  );
}

/** Formulaire d'avis sur la livraison d'une commande. */
export function DeliveryReviewForm({
  orderId,
  orderNumber,
  token,
  existing,
}: {
  orderId: string;
  orderNumber: string;
  token?: string | null;
  existing?: { rating: number; comment: string | null; status: ReviewStatus; onTime: boolean | null } | null;
}) {
  const { t } = useSiteI18n();
  const [state, formAction, pending] = useActionState(submitDeliveryReviewAction, initial);

  if (state.ok) {
    return (
      <Alert tone="success" title={t('Merci pour votre retour')}>
        {state.message}
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="orderNumber" value={orderNumber} />
      {token ? <input type="hidden" name="token" value={token} /> : null}

      <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
        <Truck className="size-4 text-accent-600" aria-hidden /> {t('Comment s’est passée la livraison ?')}
      </p>
      {existing ? (
        <p className="text-[11px] text-navy-500">
          {t('Votre note actuelle :')} {existing.rating}/5 · {STATUS_LABELS[existing.status]}
        </p>
      ) : null}

      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <StarPicker name="rating" defaultValue={existing?.rating} />

      <Field label={t('Le délai annoncé a-t-il été tenu ?')} htmlFor={`onTime-${orderNumber}`}>
        <div className="flex gap-4 text-sm text-navy-700">
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="onTime" value="yes" defaultChecked={existing?.onTime === true} /> {t('Oui')}
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="onTime" value="no" defaultChecked={existing?.onTime === false} /> {t('Non')}
          </label>
        </div>
      </Field>

      <Field label={t('Un mot sur le livreur, le colis ou l’accueil (facultatif)')} htmlFor={`delivery-comment-${orderNumber}`}>
        <Textarea
          id={`delivery-comment-${orderNumber}`}
          name="comment"
          rows={2}
          maxLength={2000}
          defaultValue={existing?.comment ?? ''}
          placeholder={t('Ex. Le livreur a appelé avant de passer, colis en bon état.')}
        />
      </Field>

      <Button type="submit" size="sm" variant="outline" loading={pending}>
        {existing ? t('Mettre à jour ma note') : t('Envoyer ma note')}
      </Button>
    </form>
  );
}

// ────────────────────────────── Bloc « donner mon avis » après livraison ──────────────────────────────

/**
 * Panneau affiché dans le suivi d'une commande livrée.
 *
 * Tant qu'il manque un avis, il est ouvert et visible en haut du suivi. Une
 * fois tout noté, il se replie en une ligne de remerciement : le client n'a plus
 * rien à faire, et la page ne garde pas un formulaire vide en travers.
 */
export function ReviewRequestPanel({
  context,
  token,
  defaultAuthor,
}: {
  context: OrderReviewContext;
  token?: string | null;
  defaultAuthor?: string | null;
}) {
  const { t } = useSiteI18n();
  const [open, setOpen] = useState(context.pending);

  if (!context.delivered) {
    return (
      <div className="rounded-xl border border-navy-100 bg-navy-50/60 p-3 text-xs text-navy-600">
        {t('Vous pourrez noter les articles et la livraison dès que la commande sera marquée comme livrée.')}
      </div>
    );
  }

  const done = context.items.filter((item) => item.review).length + (context.deliveryReview ? 1 : 0);
  const total = context.items.length + 1;

  return (
    <section aria-labelledby="avis-commande" className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="avis-commande" className="flex items-center gap-2 text-sm font-bold text-navy-900">
            <ThumbsUp className="size-4 text-amber-600" aria-hidden /> {t('Votre avis nous aide')}
          </h2>
          <p className="mt-0.5 text-xs text-navy-600">
            {done < total
              ? t('Commande livrée : dites-nous ce que vous pensez des articles et de la livraison. Cela prend une minute.')
              : t('Merci, vous avez noté cette commande. Vous pouvez encore corriger vos avis.')}
          </p>
        </div>
        <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-navy-700">
          {done}/{total}
        </span>
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 text-xs font-semibold text-accent-700 underline"
        >
          {t('Modifier mes avis')}
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-navy-100 bg-white p-3">
            <DeliveryReviewForm
              orderId={context.orderId}
              orderNumber={context.orderNumber}
              token={token}
              existing={context.deliveryReview}
            />
          </div>
          {context.items.map((item) => (
            <div key={item.productId} className="rounded-lg border border-navy-100 bg-white p-3">
              <ProductReviewForm
                orderId={context.orderId}
                orderNumber={context.orderNumber}
                token={token}
                productId={item.productId}
                productName={item.name}
                existing={item.review}
                defaultAuthor={defaultAuthor}
              />
            </div>
          ))}
          {done >= total ? (
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-navy-500 underline">
              {t('Replier')}
            </button>
          ) : null}
        </div>
      )}

      {context.pending && done >= total ? (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-emerald-700">
          <CheckCircle2 className="size-3.5" aria-hidden /> {t('Tous les avis de cette commande sont enregistrés.')}
        </p>
      ) : null}
    </section>
  );
}

// ────────────────────────────── Avis livraison publics (accueil / livraison) ──────────────────────────────

export function DeliveryReviewList({
  reviews,
  summary,
}: {
  reviews: { id: string; authorName: string; rating: number; comment: string | null; createdAt: Date; onTime: boolean | null }[];
  summary: RatingSummary;
}) {
  const { t } = useSiteI18n();
  if (reviews.length === 0) return null;

  return (
    <section className="rounded-xl border border-navy-100 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Truck className="size-4 text-accent-600" aria-hidden /> {t('Ce que disent les clients livrés')}
        </h2>
        <RatingLine summary={summary} />
      </div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {reviews.map((review) => (
          <li key={review.id} className="rounded-lg border border-navy-100 bg-navy-50/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Stars value={review.rating} size={14} />
              <span className="text-xs font-semibold text-navy-900">{review.rating}/5</span>
              {review.onTime === true ? (
                <Badge tone="success">{t('Délai tenu')}</Badge>
              ) : review.onTime === false ? (
                <Badge tone="warning">{t('En retard')}</Badge>
              ) : null}
            </div>
            {review.comment ? <p className="mt-1 text-sm text-navy-700">{review.comment}</p> : null}
            <p className="mt-1 text-[11px] text-navy-500">
              {review.authorName} · {formatDate(review.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
