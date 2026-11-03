import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Boxes,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  History,
  ListOrdered,
  MessageSquare,
  Package,
  PackageX,
  PlusCircle,
  Sparkles,
  Truck,
  UserPlus,
  BookOpen,
  BadgeCheck,
} from 'lucide-react';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { countContactMessages, getDashboardMetrics } from '@/lib/admin';
import { can, getCurrentUser, requirePagePermission } from '@/lib/auth';
import { getStoreSettings } from '@/lib/settings';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/order-status';
import { formatDateTime, formatFCFA } from '@/lib/utils';
import { Badge, Card } from '@/components/ui/primitives';
import { getReadinessReport } from '@/lib/readiness-server';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Couleurs des tuiles d'indicateurs : une couleur par famille d'information. */
const TONES = {
  gold: { bar: 'bg-accent-500', tile: 'bg-accent-100 text-accent-800', ring: 'group-hover:border-accent-300' },
  money: { bar: 'bg-emerald-500', tile: 'bg-emerald-100 text-emerald-800', ring: 'group-hover:border-emerald-300' },
  warn: { bar: 'bg-amber-500', tile: 'bg-amber-100 text-amber-900', ring: 'group-hover:border-amber-300' },
  navy: { bar: 'bg-navy-800', tile: 'bg-navy-100 text-navy-800', ring: 'group-hover:border-navy-300' },
  danger: { bar: 'bg-rose-500', tile: 'bg-rose-100 text-rose-800', ring: 'group-hover:border-rose-300' },
} as const;

export default async function AdminDashboard() {
  // Tout le personnel entre par ici ; les cartes affichées dépendent de sa fonction.
  await requirePagePermission('orders.read');
  const { t, locale } = await getAdminI18n();
  const [metrics, user, settings, messages, readiness] = await Promise.all([
    getDashboardMetrics().catch(() => null),
    getCurrentUser(),
    getStoreSettings(),
    countContactMessages().catch(() => ({ newCount: 0, open: 0, total: 0 })),
    // Diagnostic « prêt à vendre » : réservé au propriétaire, jamais bloquant pour l'affichage.
    getReadinessReport()
      .then(({ report }) => report)
      .catch(() => null),
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

  // Date du jour écrite dans la langue de l'administration.
  const today = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-CI' : 'fr-CI', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const kpis = [
    {
      label: 'Argent encaissé',
      value: formatFCFA(metrics.revenue),
      hint: t('{paid} commande(s) payée(s) · ce mois-ci : {month}', {
        paid: metrics.paidOrders,
        month: formatFCFA(metrics.revenueMonth),
      }),
      icon: Banknote,
      href: '/admin/statistiques',
      tone: 'money' as const,
      permission: 'stats.read' as const,
    },
    {
      label: 'Paiements à contrôler',
      value: String(metrics.pendingVerifications),
      hint: t('Le client dit avoir payé : vérifiez avant de préparer'),
      icon: CreditCard,
      href: '/admin/paiements',
      tone: metrics.pendingVerifications > 0 ? ('warn' as const) : ('navy' as const),
      alert: metrics.pendingVerifications > 0,
      permission: 'payments.read' as const,
    },
    {
      label: 'Colis à préparer',
      value: String(metrics.toShip),
      hint: t('Commandes payées qui attendent leur carton'),
      icon: Truck,
      href: '/admin/commandes?status=PAYMENT_CONFIRMED',
      tone: 'navy' as const,
      permission: 'orders.read' as const,
    },
    {
      label: 'Produits bientôt finis',
      value: String(metrics.lowStock.length),
      hint: t('{count} produit(s) déjà en rupture', { count: metrics.outOfStock }),
      icon: AlertTriangle,
      href: '/admin/stock',
      tone: metrics.lowStock.length > 0 ? ('danger' as const) : ('navy' as const),
      alert: metrics.lowStock.length > 0,
      permission: 'stock.write' as const,
    },
    {
      label: 'Messages de clients',
      value: String(messages.open),
      hint: t('{new} nouveau(x) · {total} au total', { new: messages.newCount, total: messages.total }),
      icon: MessageSquare,
      href: '/admin/messages',
      tone: messages.open > 0 ? ('gold' as const) : ('navy' as const),
      alert: messages.open > 0,
      permission: 'messages.handle' as const,
    },
  ];

  // Actions rapides : une phrase par besoin réel, dans les mots du quotidien.
  const quickActions = [
    { href: '/admin/paiements', label: 'Vérifier un paiement', hint: 'Le client dit avoir payé', icon: CheckCircle2, permission: 'payments.confirm' as const },
    { href: '/admin/commandes?status=PAYMENT_CONFIRMED', label: 'Préparer un colis', hint: 'Commande payée à emballer', icon: Package, permission: 'orders.read' as const },
    { href: '/admin/commandes', label: 'Regarder les commandes', hint: 'Qui a commandé quoi', icon: ListOrdered, permission: 'orders.read' as const },
    { href: '/admin/stock', label: 'Compter le stock', hint: 'Ajouter ou retirer des pièces', icon: Boxes, permission: 'stock.write' as const },
    { href: '/admin/produits/nouveau', label: 'Ajouter un produit', hint: 'Une nouvelle référence', icon: PlusCircle, permission: 'products.write' as const },
    { href: '/admin/livraison', label: 'Modifier les livraisons', hint: 'Zones et frais', icon: Truck, permission: 'delivery.manage' as const },
    { href: '/admin/utilisateurs', label: 'Créer un accès agent', hint: 'Un code part par WhatsApp', icon: UserPlus, permission: 'users.manage' as const },
    { href: '/admin/journal', label: 'Voir qui a fait quoi', hint: 'L’historique expliqué', icon: History, permission: 'audit.read' as const },
  ];

  // Chaque agent ne voit que les indicateurs de sa fonction.
  const visibleKpis = kpis.filter((kpi) => can(user?.role, kpi.permission));
  const visibleActions = quickActions.filter((action) => can(user?.role, action.permission));

  const missingInfo = !settings.phone || !settings.addressLine || !settings.openingHours || !settings.waveNumber;
  const maxStatusCount = Math.max(1, ...Object.values(metrics.counts));

  return (
    <div className="space-y-5">
      {/* ── Bandeau d'accueil : bleu nuit, filet doré, deux raccourcis ───────── */}
      <section className="relative overflow-hidden rounded-2xl bg-navy-950 p-5 text-white shadow-[0_18px_40px_-24px_rgb(8_23_41/0.8)] sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -end-24 -top-28 size-72 rounded-full bg-accent-500/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 end-0 w-1.5 bg-accent-500" />
        <div className="relative">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-accent-300">
            <span className="size-1.5 rounded-full bg-accent-400" aria-hidden />
            {t('Administration')} · {today}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t('Bonjour {name} 👋', { name: user?.firstName ?? user?.email ?? '' })}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-navy-200">
            {user?.staffTask
              ? t('Votre tâche aujourd’hui : {task}. Choisissez ci-dessous ce que vous voulez faire.', { task: user.staffTask })
              : t('Voici l’essentiel de la boutique aujourd’hui. Choisissez une carte pour agir.')}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href="/admin/guide"
              className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-3.5 py-2 text-sm font-bold text-navy-950 shadow-sm hover:bg-accent-400"
            >
              <BookOpen className="size-4" aria-hidden />
              {t('Comment utiliser le site')}
            </Link>
            <Link
              href="/admin/commandes"
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3.5 py-2 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/20"
            >
              <ClipboardList className="size-4" aria-hidden />
              {t('Voir les commandes')}
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-navy-200 hover:bg-white/10 hover:text-white"
            >
              {t('Voir la boutique')}
              <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {missingInfo ? (
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t('Informations commerciales incomplètes')}</p>
            <p className="mt-1">
              {t('Renseignez le téléphone, l’adresse, les horaires et le numéro Wave marchand dans les')}{' '}
              <Link href="/admin/parametres" className="font-semibold underline">{t('paramètres')}</Link>{' '}
              {t('Ces informations sont affichées telles quelles aux clients, sans valeur inventée.')}
            </p>
          </div>
        </div>
      ) : null}

      {/*
        Ce qui manque pour vendre sans aide : un seul chiffre, un seul lien.
        Le détail point par point est sur /admin/pret-a-vendre.
      */}
      {readiness && readiness.verdict !== 'pret' ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-navy-200 bg-white p-4 text-sm text-navy-800">
          <BadgeCheck className="size-4 shrink-0 text-accent-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {readiness.blocking > 0
                ? t('{count} point(s) empêchent encore la boutique de vendre toute seule', { count: readiness.blocking })
                : t('Il reste {count} finition(s) avant que la boutique soit totalement autonome', { count: readiness.todo })}
            </p>
            <p className="mt-0.5 text-xs text-navy-600">
              {t('Le contrôle « Prêt à vendre » montre quoi corriger, écran par écran.')}
            </p>
          </div>
          <Link
            href="/admin/pret-a-vendre"
            className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-800"
          >
            {t('Vérifier')}
            <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
          </Link>
        </div>
      ) : null}

      {/* ── Indicateurs du jour ──────────────────────────────────────────────── */}
      <section aria-label={t('Les chiffres du jour')}>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-bold text-navy-900">{t('Les chiffres du jour')}</h2>
          <span className="h-px flex-1 bg-navy-100" aria-hidden />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {visibleKpis.map((kpi) => {
            const Icon = kpi.icon;
            const tone = TONES[kpi.tone];
            return (
              <Link key={kpi.label} href={kpi.href} className="group">
                <Card
                  className={cn(
                    'relative h-full overflow-hidden p-4 transition duration-150 group-hover:-translate-y-0.5 group-hover:shadow-lg',
                    tone.ring,
                  )}
                >
                  <span className={cn('absolute inset-y-0 start-0 w-1', tone.bar)} aria-hidden />
                  <div className="flex items-start justify-between gap-2 ps-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-navy-500">{t(kpi.label)}</p>
                    <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', tone.tile)}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                  </div>
                  <p className="mt-2 ps-2 text-2xl font-extrabold tabular-nums text-navy-950">{kpi.value}</p>
                  <p className="mt-1 ps-2 text-xs leading-snug text-navy-500">{kpi.hint}</p>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Actions du quotidien ─────────────────────────────────────────────── */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-navy-900">{t('Que voulez-vous faire ?')}</h2>
            <p className="mt-0.5 text-xs text-navy-600">
              {t('Une seule chose à la fois : appuyez sur le bouton qui correspond à votre besoin.')}
            </p>
          </div>
          <Link href="/admin/guide" className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-700 hover:underline">
            <BookOpen className="size-3.5" aria-hidden />
            {t('Besoin d’aide ? Le guide')}
          </Link>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {visibleActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-start gap-3 rounded-xl border border-navy-100 bg-white p-3 transition duration-150 hover:-translate-y-0.5 hover:border-accent-300 hover:bg-accent-50/50 hover:shadow-sm"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-700 transition-colors group-hover:bg-accent-100 group-hover:text-accent-800">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-navy-900">{t(action.label)}</span>
                  <span className="mt-0.5 block text-xs text-navy-500">{t(action.hint)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Où en sont les commandes, avec une barre de proportion */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-navy-100 bg-navy-50/70 px-4 py-2.5">
            <h2 className="text-sm font-bold text-navy-900">{t('Où en sont les commandes ?')}</h2>
            <Link href="/admin/commandes" className="text-xs font-semibold text-accent-700 hover:underline">{t('Tout voir')}</Link>
          </div>
          <ul className="divide-y divide-navy-100 text-sm">
            {Object.entries(ORDER_STATUS_LABELS).map(([status, label]) => {
              const count = metrics.counts[status] ?? 0;
              return (
                <li key={status} className="flex items-center gap-3 px-4 py-2">
                  <Link href={`/admin/commandes?status=${status}`} className="min-w-0 flex-1 truncate text-navy-700 hover:text-accent-700">
                    {t(label)}
                  </Link>
                  <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-navy-100 sm:block" aria-hidden>
                    <span
                      className={cn('block h-full rounded-full', count > 0 ? 'bg-accent-500' : 'bg-transparent')}
                      style={{ width: `${Math.round((count / maxStatusCount) * 100)}%` }}
                    />
                  </span>
                  <span className="w-8 text-end font-semibold tabular-nums text-navy-900">{count}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-navy-100 bg-navy-50/70 px-4 py-2.5">
              <h2 className="text-sm font-bold text-navy-900">{t('Alertes de stock')}</h2>
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
                      <p className="text-xs text-navy-500">
                        {product.sku} · {t('seuil')} {product.threshold}
                      </p>
                    </div>
                    <Badge tone={product.available <= 0 ? 'danger' : 'warning'}>
                      {product.available <= 0 ? t('Épuisé') : t('{count} restant(s)', { count: product.available })}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy-900">
              <PackageX className="size-4 text-navy-400" aria-hidden /> {t('Produits les plus vendus')}
            </h2>
            {metrics.topProducts.length === 0 ? (
              <p className="text-sm text-navy-500">{t('Aucune vente enregistrée pour le moment.')}</p>
            ) : (
              <ol className="space-y-1.5 text-sm">
                {metrics.topProducts.map((product, index) => (
                  <li key={product.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <span className="me-1 inline-grid size-5 place-items-center rounded-full bg-navy-100 text-[10px] font-bold text-navy-700">
                        {index + 1}
                      </span>
                      {product.name}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-navy-700">{t('{count} vendu(s)', { count: product.unitsPaid })}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      {/* ── Activité récente ─────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-navy-100 bg-navy-50/70 px-4 py-2.5">
          <h2 className="text-sm font-bold text-navy-900">{t('Activité récente')}</h2>
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
                      {t(ORDER_STATUS_LABELS[order.status as OrderStatus])}
                    </Badge>
                    <span className="text-xs text-navy-500">{formatDateTime(order.createdAt)}</span>
                    <span className="font-semibold">{formatFCFA(order.total)}</span>
                    <ArrowRight className="size-4 text-navy-300 rtl:-scale-x-100" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── Le guide, mis en avant pour ceux qui débutent ────────────────────── */}
      <Link
        href="/admin/guide"
        className="group relative flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-50 via-white to-white p-5 transition hover:border-accent-400 hover:shadow-md"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-navy-950 text-accent-400">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-navy-950">{t('Nouveau ici ? Lisez le guide en cinq minutes')}</span>
          <span className="mt-0.5 block text-xs text-navy-600">
            {t('Le parcours d’une commande, la routine du jour, les gestes utiles : tout est expliqué simplement.')}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-navy-950 px-3 py-2 text-xs font-bold text-white group-hover:bg-navy-800">
          <BookOpen className="size-4" aria-hidden /> {t('Ouvrir le guide')}
        </span>
      </Link>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/admin/produits/nouveau" className="flex items-center justify-between rounded-xl border border-navy-100 bg-white p-4 text-sm font-semibold hover:border-accent-300">
          <span className="flex items-center gap-2"><PlusCircle className="size-4 text-accent-600" aria-hidden /> {t('Ajouter un produit')}</span>
          <ArrowRight className="size-4 text-navy-300 rtl:-scale-x-100" aria-hidden />
        </Link>
        <Link href="/admin/import" className="flex items-center justify-between rounded-xl border border-navy-100 bg-white p-4 text-sm font-semibold hover:border-accent-300">
          <span className="flex items-center gap-2"><ClipboardList className="size-4 text-accent-600" aria-hidden /> {t('Importer photos / CSV')}</span>
          <ArrowRight className="size-4 text-navy-300 rtl:-scale-x-100" aria-hidden />
        </Link>
        <Link href="/admin/parametres" className="flex items-center justify-between rounded-xl border border-navy-100 bg-white p-4 text-sm font-semibold hover:border-accent-300">
          <span className="flex items-center gap-2"><ClipboardList className="size-4 text-accent-600" aria-hidden /> {t('Compléter la boutique')}</span>
          <ArrowRight className="size-4 text-navy-300 rtl:-scale-x-100" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
