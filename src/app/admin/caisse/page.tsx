import { requirePagePermission } from '@/lib/auth';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { cashTotals, getOpenCashSession, listCashSessions } from '@/lib/cash';
import { CloseCashForm, OpenCashForm } from '@/components/admin/cash-forms';
import { Badge, Card } from '@/components/ui/primitives';
import { formatFCFA, toFcfa } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function CashPage() {
  await requirePagePermission('payments.read');
  const { t } = await getAdminI18n();

  const session = await getOpenCashSession();
  const totals = session ? await cashTotals({ openedAt: session.openedAt, closedAt: null }) : null;
  const expected = session ? toFcfa(session.openingFloat) + (totals?.cashTotal ?? 0) : 0;
  const history = await listCashSessions(15);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">{t('Caisse')}</h1>
        <p className="text-sm text-navy-600">
          {t('Ouvrez la caisse le matin avec l’argent du tiroir, fermez-la le soir avec l’argent compté. L’écart éventuel est enregistré : c’est votre cahier de caisse, en plus simple.')}
        </p>
      </header>

      {session ? (
        <Card className="border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-emerald-900">
              {t('Caisse ouverte')}
              <Badge tone="success">{t('En cours')}</Badge>
            </h2>
            <p className="text-xs text-emerald-900">
              {t('Ouverte le')} {session.openedAt.toLocaleString('fr-FR')}
            </p>
          </div>

          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-navy-500">{t('Fond de caisse')}</dt>
              <dd className="text-lg font-extrabold">{formatFCFA(toFcfa(session.openingFloat))}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-navy-500">{t('Espèces encaissées')}</dt>
              <dd className="text-lg font-extrabold">{formatFCFA(totals?.cashTotal ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-navy-500">{t('Attendu en caisse')}</dt>
              <dd className="text-lg font-extrabold text-emerald-800">{formatFCFA(expected)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-navy-600">
            {t('Wave encaissé pendant la session : {amount} · {count} commande(s) en espèces.', {
              amount: formatFCFA(totals?.waveTotal ?? 0),
              count: totals?.cashOrderCount ?? 0,
            })}
          </p>

          <div className="mt-4 border-t border-emerald-200 pt-4">
            <h3 className="mb-2 text-sm font-bold">{t('Fermer la caisse')}</h3>
            <CloseCashForm expected={expected} />
          </div>
        </Card>
      ) : (
        <Card className="p-4">
          <h2 className="mb-1 text-sm font-bold">{t('Caisse fermée')}</h2>
          <p className="mb-3 text-xs text-navy-600">{t('Ouvrez la caisse pour commencer la journée et suivre l’argent du tiroir.')}</p>
          <OpenCashForm suggestedFloat={0} />
        </Card>
      )}

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-bold">{t('Historique des caisses')}</h2>
        {history.length === 0 ? (
          <p className="text-sm text-navy-500">{t('Aucune caisse enregistrée pour le moment.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-start text-xs uppercase tracking-wide text-navy-500">
                <tr>
                  <th className="px-2 py-2 text-start">{t('Ouverture')}</th>
                  <th className="px-2 py-2 text-start">{t('Fermeture')}</th>
                  <th className="px-2 py-2 text-end">{t('Fond')}</th>
                  <th className="px-2 py-2 text-end">{t('Espèces')}</th>
                  <th className="px-2 py-2 text-end">{t('Attendu')}</th>
                  <th className="px-2 py-2 text-end">{t('Compté')}</th>
                  <th className="px-2 py-2 text-end">{t('Écart')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {history.map((row) => {
                  const difference = row.difference === null ? null : toFcfa(row.difference);
                  return (
                    <tr key={row.id}>
                      <td className="px-2 py-2">{row.openedAt.toLocaleString('fr-FR')}</td>
                      <td className="px-2 py-2">{row.closedAt ? row.closedAt.toLocaleString('fr-FR') : t('En cours')}</td>
                      <td className="px-2 py-2 text-end">{formatFCFA(toFcfa(row.openingFloat))}</td>
                      <td className="px-2 py-2 text-end">{formatFCFA(toFcfa(row.cashTotal))}</td>
                      <td className="px-2 py-2 text-end">{row.expectedCash ? formatFCFA(toFcfa(row.expectedCash)) : '—'}</td>
                      <td className="px-2 py-2 text-end">{row.countedCash ? formatFCFA(toFcfa(row.countedCash)) : '—'}</td>
                      <td className="px-2 py-2 text-end">
                        {difference === null ? (
                          '—'
                        ) : (
                          <span className={difference === 0 ? 'text-emerald-700' : difference > 0 ? 'text-amber-700' : 'text-rose-700'}>
                            {difference === 0
                              ? t('Caisse juste')
                              : difference > 0
                                ? t('Excédent de {amount} FCFA', { amount: formatFCFA(difference, { suffix: false }) })
                                : t('Manque de {amount} FCFA', { amount: formatFCFA(Math.abs(difference), { suffix: false }) })}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
