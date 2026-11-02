import Link from 'next/link';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { AlertTriangle, ArrowRight, Banknote, ClipboardList, CreditCard, MessageSquare, PackageX, Truck } from 'lucide-react';
import { countContactMessages, getDashboardMetrics } from '@/lib/admin';
import { can, getCurrentUser, requirePagePermission } from '@/lib/auth';
import { getStoreSettings } from '@/lib/settings';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/order-status';
import { formatDateTime, formatFCFA } from '@/lib/utils';
import { Badge, Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  // Tout le personnel entre par ici ; les cartes affichées dépendent de sa fonction.
  await requirePagePermission('orders.read');
  const { t } = await getAdminI18n();
  const [metrics, user, settings, messages] = await Promise.all([
    getDashboardMetrics().catch(async () => {
      return null;
    }),
    getCurrentUser(),
    getStoreSettings(),
    countContactMessages().catch(() => ({ newCount: 0, open: 0, total: 0 })),
  ]);

  if (!metrics) {
    return (
      <Card className="p-6">
        <h1 className="text-lg font-bold">{t('Tableau de bord indisponible')}</h1>
        <p className="mt-1 text-sm text-navy-600">
          {t('La base de données n’a pas pu être interrogée. Vérifiez DATABASE_URL puis relancez les migrations.')}
        </p>
      </Card>
    );
  }

  const kpis = [
    {
      label: 'Chiffre d’affaires encaissé',
      value: formatFCFA(metrics.revenue),
      hint: `${metrics.paidOrders} commande(s) payée(s) · ce mois : ${formatFCFA(metrics.revenueMonth)}`,
      icon: Banknote,
      href: '/admin/statistiques',
      permission: 'stats.read' as const,
    },
    {
      label: 'Paiements à vérifier',
      value: String(metrics.pendingVerifications),
      hint: 'Références déclarées, à contrôler sur le compte marchand',
      icon: CreditCard,
      href: '/admin/paiements',
      alert: metrics.pendingVerifications > 0,
      permission: 'payments.read' as const,
    },
    {
      label: 'Commandes à préparer / expédier',
      value: String(metrics.toShip),
      hint: 'Payées, en préparation ou prêtes à expédier',
      icon: Truck,
      href: '/admin/commandes?status=PAYMENT_CONFIRMED',
      permission: 'orders.read' as const,
    },
    {
      label: 'Produits en alerte de stock',
      value: String(metrics.lowStock.length),
      hint: `${metrics.outOfStock} épuisé(s)`,
      icon: AlertTriangle,
      href: '/admin/stock',
      alert: metrics.lowStock.length > 0,
      permission: 'stock.write' as const,
    },
    {
      label: 'Demandes clients à traiter',
      value: String(messages.open),
      hint: `${messages.newCount} nouvelle(s) · ${messages.total} message(s) reçus`,
      icon: MessageSquare,
      href: '/admin/messages',
      alert: messages.open > 0,
      permission: 'messages.handle' as const,
    },
  ];

  // Chaque agent ne voit que les indicateurs de sa fonction.
  const visibleKpis = kpis.filter((kpi) => can(user?.role, kpi.permission));

  const missingInfo = !settings.phone || !settings.addressLine || !settings.openingHours || !settings.waveNumber;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">{t('Tableau de bord')}</h1>
        <p className="text-sm text-navy-600">
          {t('Bonjour {name}.', { name: user?.firstName ?? user?.email ?? '' })}{' '}
          {t('Le chiffre d’affaires comptabilise uniquement les commandes dont le paiement a été confirmé (hors annulations et remboursements).')}
        </p>
      </header>

      {missingInfo ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{t('Informations commerciales incomplètes')}</p>
          <p className="mt-1">
            {t('Renseignez le téléphone, l’adresse, les horaires et le numéro Wave marchand dans les')}{' '}
            <Link href="/admin/parametres" className="font-semibold underline">{t('paramètres')}</Link>{' '}
            {t('Ces informations sont affichées telles quelles aux clients, sans valeur inventée.')}
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {visibleKpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link key={kpi.label} href={kpi.href} className="group">
              <Card className={`h-full p-4 transition-colors group-hover:border-accent-300 ${kpi.alert ? 'border-amber-200 bg-amber-50/40' : ''}`}>
                <div className="flex items-start justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">{kpi.label}</p>
                  <Icon className="size-4 text-navy-400" aria-hidden />
                </div>
                <p className="mt-2 text-2xl font-extrabold text-navy-950">{kpi.value}</p>
                <p className="mt-1 text-xs text-navy-500">{kpi.hint}</p>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-navy-100 bg-navy-50 px-4 py-2.5">
            <h2 className="text-sm font-bold">{t('Commandes par statut')}</h2>
            <Link href="/admin/commandes" className="text-xs font-semibold text-accent-700 hover:underline">{t('Tout voir')}</Link>
          </div>
          <ul className="divide-y divide-navy-100 text-sm">
            {Object.entries(ORDER_STATUS_LABELS).map(([status, label]) => (
              <li key={status} className="flex items-center justify-between px-4 py-2">
                <Link href={`/admin/commandes?status=${status}`} className="text-navy-700 hover:text-accent-700">{label}</Link>
                <span className="font-semibold text-navy-900">{metrics.counts[status] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-navy-100 bg-navy-50 px-4 py-2.5">
              <h2 className="text-sm font-bold">{t('Alertes de stock')}</h2>
              <Link href="/admin/stock" className="text-xs font-semibold text-accent-700 hover:underline">{t('Gérer le stock')}</Link>
            </div>
            {metrics.lowStock.length === 0 ? (
              <p className="px-4 py-6 text-sm text-navy-500">{t('Aucun produit sous le seuil d’alerte.')}</p>
            ) : (
              <ul className="divide-y divide-navy-100 text-sm">
                {metrics.lowStock.map((product) => (
                  <li key={product.id} className="flex items-center justify-between gap-2 px-4 py-2">
                    <div className="min-w-0">
                      <Link href={`/admin/produits/${product.id}`} className="block truncate font-medium hover:text-accent-700">{product.name}</Link>
                      <p className="text-xs text-navy-500">{product.sku} · seuil {product.threshold}</p>
                    </div>
                    <Badge tone={product.available <= 0 ? 'danger' : 'warning'}>
                      {product.available <= 0 ? 'Épuisé' : `${product.available} restant(s)`}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold"><PackageX className="size-4 text-navy-400" aria-hidden /> {t('Produits les plus vendus')}</h2>
            {metrics.topProducts.length === 0 ? (
              <p className="text-sm text-navy-500">{t('Aucune vente enregistrée pour le moment.')}</p>
            ) : (
              <ol className="space-y-1.5 text-sm">
                {metrics.topProducts.map((product, index) => (
                  <li key={product.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate"><span className="text-navy-400">{index + 1}.</span> {product.name}</span>
                    <span className="shrink-0 text-xs font-semibold text-navy-700">{product.unitsPaid} vendu(s)</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-navy-100 bg-navy-50 px-4 py-2.5">
          <h2 className="text-sm font-bold">{t('Activité récente')}</h2>
          <Link href="/admin/commandes" className="text-xs font-semibold text-accent-700 hover:underline">{t('Toutes les commandes')}</Link>
        </div>
        {metrics.recentOrders.length === 0 ? (
          <p className="px-4 py-6 text-sm text-navy-500">{t('Aucune commande encore enregistrée.')}</p>
        ) : (
          <ul className="divide-y divide-navy-100">
            {metrics.recentOrders.map((order) => (
              <li key={order.id}>
                <Link href={`/admin/commandes/${order.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-navy-50">
                  <div>
                    <p className="font-mono font-semibold">{order.number}</p>
                    <p className="text-xs text-navy-500">{order.customer} · {order.phone} · {order.city}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={order.paymentStatus === 'PAID' ? 'success' : order.paymentStatus === 'AWAITING_VERIFICATION' ? 'warning' : 'neutral'}>
                      {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                    </Badge>
                    <span className="text-xs text-navy-500">{formatDateTime(order.createdAt)}</span>
                    <span className="font-semibold">{formatFCFA(order.total)}</span>
                    <ArrowRight className="size-4 text-navy-300" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/admin/produits/nouveau" className="flex items-center justify-between rounded-xl border border-navy-100 bg-white p-4 text-sm font-semibold hover:border-accent-300">
          <span className="flex items-center gap-2"><ClipboardList className="size-4 text-accent-600" aria-hidden /> {t('Ajouter un produit')}</span>
          <ArrowRight className="size-4 text-navy-300" aria-hidden />
        </Link>
        <Link href="/admin/import" className="flex items-center justify-between rounded-xl border border-navy-100 bg-white p-4 text-sm font-semibold hover:border-accent-300">
          <span className="flex items-center gap-2"><ClipboardList className="size-4 text-accent-600" aria-hidden /> {t('Importer photos / CSV')}</span>
          <ArrowRight className="size-4 text-navy-300" aria-hidden />
        </Link>
        <Link href="/admin/parametres" className="flex items-center justify-between rounded-xl border border-navy-100 bg-white p-4 text-sm font-semibold hover:border-accent-300">
          <span className="flex items-center gap-2"><ClipboardList className="size-4 text-accent-600" aria-hidden /> {t('Compléter la boutique')}</span>
          <ArrowRight className="size-4 text-navy-300" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
