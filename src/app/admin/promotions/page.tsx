import { requirePagePermission } from '@/lib/auth';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { listPromoCampaigns, promoProductChoices, type CampaignRow } from '@/lib/promos';
import { PromoForm } from '@/components/admin/promo-form';
import { StopPromoButton } from '@/components/admin/stop-promo-button';
import { Badge, Card, EmptyState } from '@/components/ui/primitives';
import { formatFCFA, toFcfa } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<CampaignRow['status'], 'success' | 'accent' | 'neutral'> = {
  ACTIVE: 'success',
  SCHEDULED: 'accent',
  ENDED: 'neutral',
  STOPPED: 'neutral',
} as const;

const STATUS_LABEL: Record<CampaignRow['status'], string> = {
  ACTIVE: 'En cours',
  SCHEDULED: 'Programmée',
  ENDED: 'Terminée',
  STOPPED: 'Arrêtée',
} as const;

export default async function PromotionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePagePermission('products.write');
  const { t } = await getAdminI18n();
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q : '';

  const [campaigns, products] = await Promise.all([listPromoCampaigns(), promoProductChoices(q)]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">{t('Promotions')}</h1>
        <p className="text-sm text-navy-600">
          {t('Baissez les prix vous-même, pour les produits que vous choisissez et la durée que vous voulez. Le changement est visible immédiatement sur le site, avec un bandeau d’annonce si vous écrivez une phrase.')}
        </p>
      </header>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-bold">{t('Créer une opération')}</h2>
        <PromoForm
          products={products.map((product) => ({
            id: product.id,
            name: product.name,
            sku: product.sku,
            price: product.price,
            promoPrice: product.promoPrice,
            stock: product.stock,
          }))}
        />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-bold">{t('Opérations enregistrées')}</h2>
        {campaigns.length === 0 ? (
          <EmptyState
            title={t('Aucune promotion pour le moment')}
            description={t('Créez votre première opération ci-dessus : elle apparaîtra ici avec son état.')}
          />
        ) : (
          <ul className="divide-y divide-navy-50">
            {campaigns.map((campaign: CampaignRow) => (
              <li key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {campaign.name}
                    <Badge tone={STATUS_TONE[campaign.status]}>{t(STATUS_LABEL[campaign.status])}</Badge>
                  </p>
                  <p className="text-xs text-navy-500">
                    {campaign.type === 'PERCENT'
                      ? t('−{value} %', { value: toFcfa(campaign.value) })
                      : t('−{value} FCFA', { value: formatFCFA(toFcfa(campaign.value), { suffix: false }) })}{' '}
                    · {campaign.productCount} {t('produit(s)')} ·{' '}
                    {campaign.startsAt.toLocaleDateString('fr-FR')} → {campaign.endsAt.toLocaleDateString('fr-FR')}
                  </p>
                  {campaign.bannerText ? (
                    <p className="mt-1 truncate text-xs text-accent-800">« {campaign.bannerText} »</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/catalogue?promo=1`} className="text-xs font-semibold text-accent-700 underline">
                    {t('Voir sur le site')}
                  </Link>
                  {campaign.status === 'ACTIVE' || campaign.status === 'SCHEDULED' ? <StopPromoButton campaignId={campaign.id} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
