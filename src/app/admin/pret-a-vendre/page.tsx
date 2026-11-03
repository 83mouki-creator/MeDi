import Link from 'next/link';
import { AlertTriangle, ArrowRight, BadgeCheck, CircleCheck, CircleDashed, Store, Wrench } from 'lucide-react';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import type { AdminTranslator } from '@/lib/i18n/admin';
import { can, getCurrentUser } from '@/lib/auth';
import { getReadinessReport } from '@/lib/readiness-server';
import type { ReadinessCheck, ReadinessVerdict } from '@/lib/readiness';
import { Badge, Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Prêt à vendre — contrôle de la boutique',
};

/** Couleurs et mots du verdict, en français : le dictionnaire AR les traduit. */
const VERDICT: Record<ReadinessVerdict, { title: string; tone: string; ring: string; text: string }> = {
  pret: {
    title: 'La boutique est prête à vendre',
    tone: 'bg-emerald-50 text-emerald-900',
    ring: 'border-emerald-500',
    text: 'Tout est en place. Vous pouvez vendre sans avoir besoin de personne.',
  },
  presque: {
    title: 'La boutique peut vendre, mais il reste des finitions',
    tone: 'bg-amber-50 text-amber-950',
    ring: 'border-accent-500',
    text: 'Aucun blocage : une commande peut être payée, préparée et livrée. Les points ci-dessous améliorent la confiance du client.',
  },
  pas_pret: {
    title: 'La boutique ne peut pas encore vendre',
    tone: 'bg-red-50 text-red-950',
    ring: 'border-red-500',
    text: 'Les points marqués « bloquant » empêchent une commande d’aboutir. Corrigez-les en premier.',
  },
};

function StatusIcon({ status }: { status: ReadinessCheck['status'] }) {
  if (status === 'ready') return <CircleCheck className="size-4 text-emerald-600" aria-hidden />;
  if (status === 'blocking') return <AlertTriangle className="size-4 text-red-600" aria-hidden />;
  return <CircleDashed className="size-4 text-amber-600" aria-hidden />;
}

function CheckRow({ check, t }: { check: ReadinessCheck; t: AdminTranslator }) {
  const body = (
    <div className="flex items-start gap-3">
      <StatusIcon status={check.status} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-navy-900">
          {t(check.label)}
          <Badge tone={check.status === 'blocking' ? 'danger' : check.status === 'todo' ? 'warning' : 'success'}>
            {check.status === 'blocking' ? t('Bloquant') : check.status === 'todo' ? t('À compléter') : t('En place')}
          </Badge>
          <Badge tone="neutral">{check.owner === 'boutique' ? t('Vous') : t('Technique')}</Badge>
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t(check.detail, check.vars)}</p>
      </div>
      {check.href ? <ArrowRight className="mt-1 size-4 shrink-0 text-slate-400" aria-hidden /> : null}
    </div>
  );

  if (!check.href) return <li className="rounded-xl border border-slate-200 bg-white p-3">{body}</li>;

  return (
    <li>
      <Link
        href={check.href}
        className="block rounded-xl border border-slate-200 bg-white p-3 transition hover:border-accent-500 hover:bg-accent-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        {body}
      </Link>
    </li>
  );
}

export default async function AdminReadinessPage() {
  const [{ t }, user] = await Promise.all([getAdminI18n(), getCurrentUser()]);

  if (!can(user?.role, 'settings.write')) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="p-5">
          <h1 className="text-lg font-extrabold text-navy-900">{t('Prêt à vendre')}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {t('Cette page est réservée au propriétaire : elle montre les réglages à compléter.')}
          </p>
        </Card>
      </div>
    );
  }

  const { report, snapshot } = await getReadinessReport();
  const verdict = VERDICT[report.verdict];
  const blocking = report.checks.filter((check) => check.status === 'blocking');
  const todo = report.checks.filter((check) => check.status === 'todo');
  const ready = report.checks.filter((check) => check.status === 'ready');

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className={`relative overflow-hidden rounded-2xl border-s-4 ${verdict.ring} ${verdict.tone} p-5`}>
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">
          <BadgeCheck className="size-3.5" aria-hidden /> {t('Contrôle de la boutique')}
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{t(verdict.title)}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed">{t(verdict.text)}</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-white/70 p-3">
            <p className="text-2xl font-extrabold">{report.ready}</p>
            <p className="text-xs font-semibold">{t('points en place')}</p>
          </div>
          <div className="rounded-xl bg-white/70 p-3">
            <p className="text-2xl font-extrabold">{report.todo}</p>
            <p className="text-xs font-semibold">{t('à compléter')}</p>
          </div>
          <div className="rounded-xl bg-white/70 p-3">
            <p className="text-2xl font-extrabold">{report.blocking}</p>
            <p className="text-xs font-semibold">{t('bloquants')}</p>
          </div>
        </div>
      </header>

      {blocking.length > 0 ? (
        <section aria-labelledby="bloquants" className="space-y-2">
          <h2 id="bloquants" className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-red-700">
            <AlertTriangle className="size-4" aria-hidden /> {t('À corriger en premier')}
          </h2>
          <ul className="space-y-2">
            {blocking.map((check) => (
              <CheckRow key={check.id} check={check} t={t} />
            ))}
          </ul>
        </section>
      ) : null}

      {todo.length > 0 ? (
        <section aria-labelledby="finitions" className="space-y-2">
          <h2 id="finitions" className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-amber-700">
            <Wrench className="size-4" aria-hidden /> {t('Finitions recommandées')}
          </h2>
          <ul className="space-y-2">
            {todo.map((check) => (
              <CheckRow key={check.id} check={check} t={t} />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="en-place" className="space-y-2">
        <h2 id="en-place" className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-emerald-700">
          <BadgeCheck className="size-4" aria-hidden /> {t('Déjà en place')}
        </h2>
        <ul className="space-y-2">
          {ready.map((check) => (
            <CheckRow key={check.id} check={check} t={t} />
          ))}
        </ul>
      </section>

      <Card className="p-4">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-navy-900">
          <Store className="size-4 text-accent-600" aria-hidden /> {t('Ce que voit le client aujourd’hui')}
        </h2>
        <ul className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
          <li>{t('{count} produit(s) publié(s)').replace('{count}', String(snapshot.catalog.activeProducts))}</li>
          <li>{t('{count} disponible(s) en stock').replace('{count}', String(snapshot.catalog.inStockProducts))}</li>
          <li>{t('{count} produit(s) avec photo').replace('{count}', String(snapshot.catalog.withPhoto))}</li>
          <li>{t('{count} rayon(s)').replace('{count}', String(snapshot.catalog.categories))}</li>
          <li>{t('{count} promotion(s) en cours').replace('{count}', String(snapshot.catalog.activePromotions))}</li>
          <li>{t('{count} zone(s) de livraison à Daloa').replace('{count}', String(snapshot.delivery.localZonesWithTariff))}</li>
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          {t('Cette page se recalcule à chaque ouverture : elle ne garde aucune valeur en mémoire.')}
        </p>
      </Card>

      <p className="text-center text-xs text-slate-500">
        <Link href="/admin/guide" className="font-semibold text-navy-700 underline underline-offset-2">
          {t('Comment utiliser le site')}
        </Link>
        {' · '}
        <Link href="/" className="font-semibold text-navy-700 underline underline-offset-2">
          {t('Voir la boutique')}
        </Link>
      </p>
    </div>
  );
}
