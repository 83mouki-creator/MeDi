import Link from 'next/link';
import { BadgeCheck, MessageSquareQuote, Truck } from 'lucide-react';
import { requirePagePermission } from '@/lib/auth';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { listOrderReviewsForAdmin, listProductReviewsForAdmin } from '@/lib/reviews';
import { REVIEW_STATUS_LABELS, type ReviewStatus } from '@/lib/review-shared';
import { ReviewModerationForm } from '@/components/admin/review-moderation';
import { Stars } from '@/components/reviews';
import { Badge, Card, EmptyState } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { Pagination } from '@/components/pagination';
import { formatDateTime, parsePage } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const TONES: Record<ReviewStatus, 'warning' | 'success' | 'neutral'> = {
  PENDING: 'warning',
  PUBLISHED: 'success',
  HIDDEN: 'neutral',
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'PENDING', label: REVIEW_STATUS_LABELS.PENDING },
  { value: 'PUBLISHED', label: REVIEW_STATUS_LABELS.PUBLISHED },
  { value: 'HIDDEN', label: REVIEW_STATUS_LABELS.HIDDEN },
];

/**
 * Avis clients — relecture et réponses.
 *
 * Un avis n'entre sur la boutique qu'après passage ici. L'écran est donc conçu
 * pour aller vite : le texte intégral, la note en étoiles, ce qui a été acheté,
 * et trois boutons. Les avis « de livraison » sont séparés des avis produits
 * parce qu'ils n'apprennent pas la même chose à l'équipe : l'un parle de la
 * marchandise, l'autre du transporteur et du livreur.
 */
export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission('messages.handle');
  const { t } = await getAdminI18n();
  const params = await searchParams;

  const tab = params.onglet === 'livraison' ? 'livraison' : 'produits';
  const rawStatus = typeof params.status === 'string' ? params.status : 'PENDING';
  const status = STATUS_OPTIONS.some((option) => option.value === rawStatus) ? rawStatus : 'PENDING';
  const page = parsePage(params.page);

  const [productReviews, deliveryReviews] = await Promise.all([
    listProductReviewsForAdmin({ status, page, perPage: 20 }),
    listOrderReviewsForAdmin({ status, page, perPage: 20 }),
  ]);

  const current = tab === 'livraison' ? deliveryReviews : productReviews;
  const pendingTotal = productReviews.byStatus.PENDING + deliveryReviews.byStatus.PENDING;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">{t('Avis clients')}</h1>
        <p className="text-sm text-navy-600">
          {t('{attente} avis attendent une relecture · {publies} publiés (produits et livraison).', {
            attente: pendingTotal,
            publies: productReviews.byStatus.PUBLISHED + deliveryReviews.byStatus.PUBLISHED,
          })}
        </p>
      </header>

      <Card className="flex flex-wrap items-end justify-between gap-3 p-3">
        <div className="flex gap-1 rounded-lg bg-navy-50 p-1">
          <Link
            href="/admin/avis?onglet=produits"
            className={
              tab === 'produits'
                ? 'rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-navy-900 shadow-sm'
                : 'rounded-md px-3 py-1.5 text-sm font-medium text-navy-600 hover:text-navy-900'
            }
          >
            {t('Produits')} ({productReviews.total})
          </Link>
          <Link
            href="/admin/avis?onglet=livraison"
            className={
              tab === 'livraison'
                ? 'rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-navy-900 shadow-sm'
                : 'rounded-md px-3 py-1.5 text-sm font-medium text-navy-600 hover:text-navy-900'
            }
          >
            {t('Livraison')} ({deliveryReviews.total})
          </Link>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="onglet" value={tab} />
          <label className="text-xs font-semibold text-navy-600" htmlFor="filtre-statut">
            {t('Statut')}
          </label>
          <Select id="filtre-statut" name="status" defaultValue={status} className="w-44">
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="outline" size="sm">
            {t('Filtrer')}
          </Button>
        </form>
      </Card>

      {tab === 'produits' ? (
        current.rows.length === 0 ? (
          <EmptyState
            icon={<MessageSquareQuote className="size-10" />}
            title={t('Aucun avis dans cette catégorie')}
            description={t('Les avis arrivent après livraison : le client les dépose depuis le suivi de sa commande.')}
          />
        ) : (
          <ul className="space-y-3">
            {productReviews.rows.map(({ review, productName, productSlug }) => (
              <li key={review.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Stars value={review.rating} size={15} />
                        <span className="text-sm font-bold text-navy-900">{review.rating} / 5</span>
                        <Badge tone={TONES[review.status]}>{t(REVIEW_STATUS_LABELS[review.status])}</Badge>
                        <Badge tone="success" className="gap-1">
                          <BadgeCheck className="size-3" aria-hidden /> {t('Achat vérifié')}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-navy-500">
                        {review.authorName} · {formatDateTime(review.createdAt)}
                        {productSlug ? (
                          <>
                            {' · '}
                            <Link href={`/produit/${productSlug}`} className="font-medium text-accent-700 hover:underline">
                              {productName}
                            </Link>
                          </>
                        ) : (
                          <> · {productName ?? t('Produit supprimé')}</>
                        )}
                      </p>
                    </div>
                  </div>

                  {review.title ? <p className="mt-2 text-sm font-semibold text-navy-900">{review.title}</p> : null}
                  {review.comment ? (
                    <p className="mt-1 whitespace-pre-line rounded-lg bg-navy-50 p-3 text-sm text-navy-800">{review.comment}</p>
                  ) : (
                    <p className="mt-1 text-xs italic text-navy-400">{t('Avis sans commentaire.')}</p>
                  )}

                  <ReviewModerationForm kind="product" id={review.id} status={review.status} reply={review.reply} />
                </Card>
              </li>
            ))}
          </ul>
        )
      ) : deliveryReviews.rows.length === 0 ? (
        <EmptyState
          icon={<Truck className="size-10" />}
          title={t('Aucun avis de livraison dans cette catégorie')}
          description={t('La note de livraison se dépose une fois par commande livrée.')}
        />
      ) : (
        <ul className="space-y-3">
          {deliveryReviews.rows.map(({ review, orderNumber, city }) => (
            <li key={review.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars value={review.rating} size={15} />
                  <span className="text-sm font-bold text-navy-900">{review.rating} / 5</span>
                  <Badge tone={TONES[review.status]}>{t(REVIEW_STATUS_LABELS[review.status])}</Badge>
                  {review.onTime === true ? <Badge tone="success">{t('Délai tenu')}</Badge> : null}
                  {review.onTime === false ? <Badge tone="warning">{t('En retard')}</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-navy-500">
                  {review.authorName} · {formatDateTime(review.createdAt)}
                  {orderNumber ? (
                    <>
                      {' · '}
                      <Link href="/admin/commandes" className="font-mono font-medium text-accent-700 hover:underline">
                        {orderNumber}
                      </Link>
                    </>
                  ) : null}
                  {city ? ` · ${city}` : ''}
                </p>

                {review.comment ? (
                  <p className="mt-2 whitespace-pre-line rounded-lg bg-navy-50 p-3 text-sm text-navy-800">{review.comment}</p>
                ) : (
                  <p className="mt-2 text-xs italic text-navy-400">{t('Note sans commentaire.')}</p>
                )}

                <ReviewModerationForm kind="delivery" id={review.id} status={review.status} reply={review.reply} />
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={current.page}
        totalPages={Math.max(1, Math.ceil(current.total / current.perPage))}
        basePath="/admin/avis"
        searchParams={{ onglet: tab, status }}
      />
    </div>
  );
}
