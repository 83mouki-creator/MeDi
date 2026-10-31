import { Search } from 'lucide-react';
import { listAuditLogs } from '@/lib/audit';
import { formatDateTime, parsePage } from '@/lib/utils';
import { Card, EmptyState, Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { Pagination } from '@/components/pagination';

export const dynamic = 'force-dynamic';

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const q = typeof params.q === 'string' ? params.q : '';
  const { rows, total, pageSize } = await listAuditLogs(page, 50, q);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">Journal d’activité</h1>
        <p className="text-sm text-navy-600">
          Actions sensibles horodatées avec l’identité de l’opérateur. Les secrets et mots de passe ne sont jamais journalisés
          (les champs sensibles sont masqués).
        </p>
      </header>

      <Card className="p-3">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label htmlFor="journal-recherche" className="sr-only">
            Rechercher dans le journal
          </label>
          <Input
            id="journal-recherche"
            name="q"
            defaultValue={q}
            placeholder="Action, opérateur, référence…"
            aria-label="Rechercher dans le journal d’activité"
            className="w-full sm:w-72"
          />
          <Button type="submit" variant="outline" size="sm">
            <Search className="size-4" aria-hidden /> Rechercher
          </Button>
          {q ? (
            <a href="/admin/journal" className="text-xs font-semibold text-navy-600 underline">
              Réinitialiser
            </a>
          ) : null}
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title={q ? 'Aucune entrée pour cette recherche' : 'Aucune entrée'}
          description={
            q
              ? `Aucune action journalisée ne correspond à « ${q} ».`
              : 'Les actions sensibles apparaîtront ici dès la première modification (prix, stock, paiement, réglages).'
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Opérateur</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Entité</th>
                <th className="px-3 py-2">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {rows.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-navy-500">{formatDateTime(log.createdAt)}</td>
                  <td className="px-3 py-2 text-xs">{log.actorEmail ?? 'système'}</td>
                  <td className="px-3 py-2"><Badge tone={log.action.includes('payment') ? 'warning' : 'neutral'}>{log.action}</Badge></td>
                  <td className="px-3 py-2 text-xs text-navy-600">{log.entity ?? '—'}{log.entityId ? ` · ${log.entityId}` : ''}</td>
                  <td className="max-w-72 truncate px-3 py-2 text-xs text-navy-500">{log.metadata ? JSON.stringify(log.metadata) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} basePath="/admin/journal" searchParams={{ q: q || undefined }} />
    </div>
  );
}
