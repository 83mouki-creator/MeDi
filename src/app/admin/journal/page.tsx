import Link from 'next/link';
import { Search } from 'lucide-react';
import { requirePagePermission } from '@/lib/auth';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { activityCountsByCategory, listActivity, type ActivityRow } from '@/lib/audit';
import { parsePage } from '@/lib/utils';
import { Card, EmptyState } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { Pagination } from '@/components/pagination';
import {
  ACTIVITY_CATEGORIES,
  categoryOf,
  dayGroup,
  describeActivity,
  describeWhen,
  technicalSummary,
  type ActivityCategoryKey,
  type ActivityTone,
  type ActivityText,
} from '@/lib/activity';
import type { AdminTranslator } from '@/lib/i18n/admin';

export const dynamic = 'force-dynamic';

const TONE_DOT: Record<ActivityTone, string> = {
  success: 'bg-emerald-500',
  info: 'bg-sky-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
};

const DAY_LABELS: Record<'aujourdhui' | 'hier' | 'plus-tot', string> = {
  aujourdhui: 'Aujourd’hui',
  hier: 'Hier',
  'plus-tot': 'Plus tôt',
};

/** Traduit une phrase-gabarit en remplaçant les variables (statuts compris). */
function renderText(text: ActivityText, t: AdminTranslator): string {
  const vars: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(text.vars ?? {})) {
    vars[key] = text.translate?.includes(key) ? t(String(value)) : value;
  }
  return t(text.key, vars);
}

/**
 * Journal lisible par toute l'équipe.
 *
 * Pas de code d'action, pas de JSON : une phrase simple par ligne (« Le client a
 * payé la commande MED-0001 »), qui/quand, et les détails techniques repliés
 * dans un bloc fermé pour le support.
 */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePagePermission('audit.read');
  const { t } = await getAdminI18n();
  const params = await searchParams;
  const page = parsePage(params.page);
  const q = typeof params.q === 'string' ? params.q : '';
  const rawCategory = typeof params.cat === 'string' ? params.cat : '';
  const category = ACTIVITY_CATEGORIES.find((item) => item.key === rawCategory)?.key;

  const [{ rows, total, pageSize }, counts] = await Promise.all([
    listActivity(page, 30, { q, category }),
    activityCountsByCategory(),
  ]);

  const now = new Date();
  const groups: { key: 'aujourdhui' | 'hier' | 'plus-tot'; items: ActivityRow[] }[] = [];
  for (const row of rows) {
    const key = dayGroup(row.createdAt, now);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(row);
    else groups.push({ key, items: [row] });
  }

  const totalAll = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const todayCount = rows.filter((row) => dayGroup(row.createdAt, now) === 'aujourdhui').length;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">{t('Historique de la boutique')}</h1>
        <p className="text-sm text-navy-600">
          {t('Tout ce qui a été fait, expliqué simplement : qui a fait quoi, sur quoi et quand. Aucun mot technique n’est nécessaire pour comprendre.')}
        </p>
      </header>

      <section className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-navy-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">{t('Aujourd’hui')}</p>
          <p className="mt-0.5 text-2xl font-extrabold text-navy-900">{todayCount}</p>
          <p className="text-xs text-navy-500">{t('action(s) sur cette page')}</p>
        </div>
        <div className="rounded-xl border border-navy-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">{t('Tout l’historique')}</p>
          <p className="mt-0.5 text-2xl font-extrabold text-navy-900">{totalAll}</p>
          <p className="text-xs text-navy-500">{t('action(s) enregistrée(s)')}</p>
        </div>
        <div className="rounded-xl border border-navy-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">{t('À quoi ça sert ?')}</p>
          <p className="mt-1 text-xs text-navy-600">
            {t('À retrouver qui a changé un prix, reçu un paiement ou créé un accès. Rien ne peut être effacé.')}
          </p>
        </div>
      </section>

      <Card className="space-y-2 p-3">
        <form method="get" className="flex flex-wrap items-end gap-2">
          {category ? <input type="hidden" name="cat" value={category} /> : null}
          <label htmlFor="journal-recherche" className="sr-only">
            {t('Chercher dans l’historique')}
          </label>
          <Input
            id="journal-recherche"
            name="q"
            defaultValue={q}
            placeholder={t('Un prénom, un produit, un numéro de commande…')}
            aria-label={t('Chercher dans l’historique')}
            className="w-full sm:w-80"
          />
          <Button type="submit" variant="outline" size="sm">
            <Search className="size-4" aria-hidden /> {t('Chercher')}
          </Button>
          {q || category ? (
            <Link href="/admin/journal" className="text-xs font-semibold text-navy-600 underline">
              {t('Tout afficher')}
            </Link>
          ) : null}
        </form>

        <div className="flex flex-wrap gap-1.5">
          <Link
            href={`/admin/journal${q ? `?q=${encodeURIComponent(q)}` : ''}`}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              category ? 'bg-navy-50 text-navy-600 hover:bg-navy-100' : 'bg-navy-900 text-white'
            }`}
          >
            {t('Tout')}
          </Link>
          {ACTIVITY_CATEGORIES.map((item) => {
            const count = counts[item.key] ?? 0;
            if (count === 0) return null;
            const active = category === item.key;
            return (
              <Link
                key={item.key}
                href={`/admin/journal?cat=${item.key}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  active ? 'bg-navy-900 text-white' : 'bg-navy-50 text-navy-600 hover:bg-navy-100'
                }`}
              >
                <span aria-hidden>{item.emoji}</span> {t(item.label)} <span className="text-navy-400">{count}</span>
              </Link>
            );
          })}
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title={q || category ? t('Rien trouvé pour cette recherche') : t('Rien à afficher pour le moment')}
          description={
            q || category
              ? t('Essayez un autre mot (un prénom, un produit) ou affichez tout l’historique.')
              : t('Chaque vente, paiement, changement de prix ou nouvel accès apparaîtra ici, écrit en une phrase simple.')
          }
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.key} className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-navy-500">{t(DAY_LABELS[group.key])}</h2>
              <ul className="space-y-2">
                {group.items.map((row) => {
                  const description = describeActivity(row.action, (row.metadata ?? {}) as Record<string, unknown>, row.names, row.actorName);
                  const emoji = ACTIVITY_CATEGORIES.find((item) => item.key === categoryOf(row.action))?.emoji ?? '📝';
                  return (
                    <li key={row.id} className="rounded-xl border border-navy-100 bg-white p-3 shadow-[0_1px_2px_rgba(8,23,41,0.04)]">
                      <div className="flex gap-3">
                        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-navy-50 text-base" aria-hidden>
                          {emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`size-2 rounded-full ${TONE_DOT[description.tone]}`} aria-hidden />
                            <p className="text-sm font-semibold text-navy-900">{renderText(description.title, t)}</p>
                          </div>
                          {description.detail ? (
                            <p className="mt-0.5 text-sm text-navy-600">{renderText(description.detail, t)}</p>
                          ) : null}
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-navy-500">
                            <span className="font-semibold text-navy-700">{row.actorName ?? t('un membre de l’équipe')}</span>
                            <span aria-hidden>·</span>
                            <time dateTime={row.createdAt.toISOString()} title={row.createdAt.toLocaleString('fr-FR')}>
                              {renderText(describeWhen(row.createdAt, now), t)}
                            </time>
                            {description.href ? (
                              <>
                                <span aria-hidden>·</span>
                                <Link href={description.href} className="font-semibold text-accent-700 hover:underline">
                                  {t('Voir')}
                                </Link>
                              </>
                            ) : null}
                          </p>
                          <details className="mt-1">
                            <summary className="cursor-pointer text-[11px] text-navy-400 hover:text-navy-600">
                              {t('Détails techniques (rarement utiles)')}
                            </summary>
                            <div className="mt-1 rounded bg-navy-50 p-2 text-[11px] text-navy-600">
                              <p className="font-mono">{technicalSummary(row.action, row.entity, row.entityId)}</p>
                              {row.metadata && Object.keys(row.metadata).length > 0 ? (
                                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono">
                                  {JSON.stringify(row.metadata, null, 1)}
                                </pre>
                              ) : null}
                            </div>
                          </details>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / pageSize))}
        basePath="/admin/journal"
        searchParams={{ q: q || undefined, cat: category }}
        labels={{ nav: t('Pagination'), previous: t('Page précédente'), next: t('Page suivante') }}
      />
    </div>
  );
}
