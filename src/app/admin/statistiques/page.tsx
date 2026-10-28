import { getDashboardMetrics, salesByDay, paymentMethodBreakdown, deliveryBreakdown } from '@/lib/admin';
import { topSearches, searchEventsWithoutResults } from '@/lib/audit';
import { formatFCFA } from '@/lib/utils';
import { Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function StatisticsPage() {
  const [metrics, daily, paymentMethods, delivery, searches, noResults] = await Promise.all([
    getDashboardMetrics(),
    salesByDay(14),
    paymentMethodBreakdown(),
    deliveryBreakdown(),
    topSearches(30, 10),
    searchEventsWithoutResults(30, 10),
  ]);

  const maxRevenue = Math.max(1, ...daily.map((d) => d.revenue));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">Statistiques</h1>
        <p className="text-sm text-navy-600">
          Chiffre d’affaires = commandes dont le paiement est confirmé, hors annulations et remboursements. Les réservations non
          payées ne sont jamais comptabilisées.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-navy-500">CA total encaissé</p>
          <p className="mt-1 text-2xl font-extrabold">{formatFCFA(metrics.revenue)}</p>
          <p className="text-xs text-navy-500">{metrics.paidOrders} commandes payées</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-navy-500">CA du mois en cours</p>
          <p className="mt-1 text-2xl font-extrabold">{formatFCFA(metrics.revenueMonth)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-navy-500">Panier moyen</p>
          <p className="mt-1 text-2xl font-extrabold">
            {formatFCFA(metrics.paidOrders > 0 ? Math.round(metrics.revenue / metrics.paidOrders) : 0)}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-bold">Chiffre d’affaires — 14 derniers jours</h2>
        <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Graphique du chiffre d’affaires sur 14 jours">
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
          <h2 className="mb-2 text-sm font-bold">Moyens de paiement (encaissés)</h2>
          {paymentMethods.length === 0 ? (
            <p className="text-sm text-navy-500">Aucun paiement confirmé.</p>
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
          <h2 className="mb-2 text-sm font-bold">Modes de livraison</h2>
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
          <h2 className="mb-2 text-sm font-bold">Recherches fréquentes (30 j)</h2>
          {searches.length === 0 ? (
            <p className="text-sm text-navy-500">Aucune recherche enregistrée.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {searches.map((row) => (
                <li key={row.query} className="flex justify-between"><span>{row.query}</span><span className="text-navy-500">{row.count}</span></li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-bold">Recherches sans résultat</h2>
          <p className="mb-2 text-xs text-navy-500">Signe de produits manquants au catalogue à ajouter en priorité.</p>
          {noResults.length === 0 ? (
            <p className="text-sm text-navy-500">Toutes les recherches ont donné des résultats.</p>
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
