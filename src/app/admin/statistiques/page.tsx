import Link from 'next/link';
import {
  getDashboardMetrics,
  salesByDay,
  paymentMethodBreakdown,
  deliveryBreakdown,
  productProfitability,
  productsMissingPurchasePrice,
} from '@/lib/admin';
import { requirePagePermission } from '@/lib/auth';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { topSearches, searchEventsWithoutResults } from '@/lib/audit';
import { formatFCFA } from '@/lib/utils';
import { Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function StatisticsPage() {
  await requirePagePermission('stats.read');
  const { t } = await getAdminI18n();
  const [metrics, daily, paymentMethods, delivery, searches, noResults, profitRows, missingCosts] =
    await Promise.all([
      getDashboardMetrics(),
      salesByDay(14),
      paymentMethodBreakdown(),
      deliveryBreakdown(),
      topSearches(30, 10),
      searchEventsWithoutResults(30, 10),
      productProfitability(15),
      productsMissingPurchasePrice(10),
    ]);

  const maxRevenue = Math.max(1, ...daily.map((d) => d.revenue));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">{t('Les chiffres de la boutique')}</h1>
        <p className="text-sm text-navy-600">
          {t('Argent réellement encaissé : uniquement les commandes payées, sans les annulations ni les remboursements. Une commande non payée ne compte pas.')}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-navy-500">{t('CA total encaissé')}</p>
          <p className="mt-1 text-2xl font-extrabold">{formatFCFA(metrics.revenue)}</p>
          <p className="text-xs text-navy-500">{metrics.paidOrders} commandes payées</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-navy-500">{t('CA du mois en cours')}</p>
          <p className="mt-1 text-2xl font-extrabold">{formatFCFA(metrics.revenueMonth)}</p>
          <p className="text-xs text-navy-500">
            {t('Articles seuls : {amount}', { amount: formatFCFA(metrics.revenueNetMonth) })}
          </p>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs uppercase tracking-wide text-emerald-700">{t('Bénéfice net total')}</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-900">{formatFCFA(metrics.profitTotal)}</p>
          <p className="text-xs text-emerald-800">
            {t('Ce mois-ci : {amount}', { amount: formatFCFA(metrics.profitMonth) })}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-navy-500">{t('Panier moyen')}</p>
          <p className="mt-1 text-2xl font-extrabold">
            {formatFCFA(metrics.paidOrders > 0 ? Math.round(metrics.revenue / metrics.paidOrders) : 0)}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold">{t('Rentabilité par produit')}</h2>
            <p className="mt-1 text-xs text-navy-500">
              {t('Bénéfice net = (prix de vente − prix d’achat) × quantités vendues. Les frais de livraison ne sont pas comptés.')}
            </p>
          </div>
          <Link href="/admin/produits" className="text-xs font-semibold text-accent-700 hover:underline">
            {t('Modifier les prix d’achat')}
          </Link>
        </div>
        {profitRows.length === 0 ? (
          <p className="text-sm text-navy-500">{t('Aucune vente payée pour le moment : le bénéfice apparaîtra ici.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wide text-navy-500">
                  <th className="py-1.5 pe-2 font-semibold">{t('Produit')}</th>
                  <th className="py-1.5 px-2 text-right font-semibold">{t('Vendus')}</th>
                  <th className="py-1.5 px-2 text-right font-semibold">{t('CA')}</th>
                  <th className="py-1.5 px-2 text-right font-semibold">{t('Bénéfice')}</th>
                  <th className="py-1.5 ps-2 text-right font-semibold">{t('Marge')}</th>
                </tr>
              </thead>
              <tbody>
                {profitRows.map((row) => (
                  <tr key={row.id} className="border-b border-navy-50 last:border-0">
                    <td className="py-1.5 pe-2">
                      <span className="font-medium text-navy-900">{row.name}</span>
                      <span className="ms-1 text-xs text-navy-400">{row.sku}</span>
                    </td>
                    <td className="py-1.5 px-2 text-right">{row.units}</td>
                    <td className="py-1.5 px-2 text-right">{formatFCFA(row.revenue)}</td>
                    <td className={`py-1.5 px-2 text-right font-semibold ${row.profit !== null && row.profit < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {row.profit === null ? t('Prix d’achat manquant') : formatFCFA(row.profit)}
                    </td>
                    <td className="py-1.5 ps-2 text-right">{row.marginRate === null ? '—' : `${row.marginRate} %`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {missingCosts.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">{t('Prix d’achat à renseigner')}</p>
            <p className="mt-1">
              {t('Tant qu’un produit n’a pas de prix d’achat, sa vente est exclue du bénéfice. {count} produit(s) concerné(s) :', {
                count: metrics.productsWithoutCost,
              })}
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {missingCosts.map((row) => (
                <li key={row.id}>
                  <Link href={`/admin/produits/${row.id}`} className="font-semibold underline">
                    {row.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-bold">{t('Chiffre d’affaires — 14 derniers jours')}</h2>
        <div className="flex h-40 items-end gap-1.5" role="img" aria-label={t('Graphique du chiffre d’affaires sur 14 jours')}>
          {daily.map((day) => (
            <div key={day.day} className="group flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[9px] text-navy-500 opacity-0 group-hover:opacity-100">{day.revenue > 0 ? formatFCFA(day.revenue, { suffix: false }) : ''}</span>
              <div
                className="w-full rounded-t bg-navy-800 transition-colors group-hover:bg-accent-500"
                style={{ height: `${Math.max(2, (day.revenue / maxRevenue) * 100)}%` }}
                title={`${day.day} · ${formatFCFA(day.revenue)} · ${day.orders} commande(s)`}
              />
              <span className="text-[9px] text-navy-400">{day.day.slice(8)}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-bold">{t('Moyens de paiement (encaissés)')}</h2>
          {paymentMethods.length === 0 ? (
            <p className="text-sm text-navy-500">{t('Aucun paiement confirmé.')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {paymentMethods.map((row) => (
                <li key={row.method} className="flex justify-between">
                  <span>{row.method}</span>
                  <span className="font-medium">{row.count} · {formatFCFA(row.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-bold">{t('Modes de livraison')}</h2>
          <ul className="space-y-1 text-sm">
            {delivery.map((row) => (
              <li key={row.method} className="flex justify-between">
                <span>{row.method}</span>
                <span className="font-medium">{row.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-bold">{t('Recherches fréquentes (30 j)')}</h2>
          {searches.length === 0 ? (
            <p className="text-sm text-navy-500">{t('Aucune recherche enregistrée.')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {searches.map((row) => (
                <li key={row.query} className="flex justify-between"><span>{row.query}</span><span className="text-navy-500">{row.count}</span></li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-bold">{t('Recherches sans résultat')}</h2>
          <p className="mb-2 text-xs text-navy-500">{t('Signe de produits manquants au catalogue à ajouter en priorité.')}</p>
          {noResults.length === 0 ? (
            <p className="text-sm text-navy-500">{t('Toutes les recherches ont donné des résultats.')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {noResults.map((row) => (
                <li key={row.query} className="flex justify-between"><span>{row.query}</span><span className="text-navy-500">{row.count}</span></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
