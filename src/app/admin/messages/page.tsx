import { Mail, MessageSquare, Phone } from 'lucide-react';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import type { AdminTranslator } from '@/lib/i18n/admin';
import { CONTACT_STATUS_LABELS, countContactMessages, listContactMessages, type ContactMessageRow } from '@/lib/admin';
import { setMessageStatusAction } from '@/app/actions/admin-messages';
import { Badge, Card, EmptyState } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { Pagination } from '@/components/pagination';
import { formatDateTime, parsePage } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const TONES: Record<string, 'accent' | 'warning' | 'success'> = {
  NEW: 'accent',
  IN_PROGRESS: 'warning',
  CLOSED: 'success',
};

function MessageCard({ message, t }: { message: ContactMessageRow; t: AdminTranslator }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-navy-900">{message.subject}</p>
          <p className="mt-0.5 text-xs text-navy-500">
            {message.name} · {formatDateTime(message.createdAt)}
            {message.orderNumber ? ` · commande ${message.orderNumber}` : ''}
          </p>
        </div>
        <Badge tone={TONES[message.status] ?? 'neutral'}>{CONTACT_STATUS_LABELS[message.status] ?? message.status}</Badge>
      </div>

      <p className="mt-3 whitespace-pre-line rounded-lg bg-navy-50 p-3 text-sm text-navy-800">{message.message}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <a href={`mailto:${message.email}`} className="inline-flex items-center gap-1.5 font-medium text-accent-700 hover:underline">
          <Mail className="size-4" aria-hidden /> {message.email}
        </a>
        {message.phone ? (
          <a href={`tel:${message.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 text-navy-700 hover:underline">
            <Phone className="size-4" aria-hidden /> {message.phone}
          </a>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {message.status !== 'IN_PROGRESS' ? (
          <form action={setMessageStatusAction}>
            <input type="hidden" name="id" value={message.id} />
            <input type="hidden" name="status" value="IN_PROGRESS" />
            <Button type="submit" size="sm" variant="outline">
              {t('Prendre en charge')}
            </Button>
          </form>
        ) : null}
        {message.status !== 'CLOSED' ? (
          <form action={setMessageStatusAction}>
            <input type="hidden" name="id" value={message.id} />
            <input type="hidden" name="status" value="CLOSED" />
            <Button type="submit" size="sm">
              {t('Marquer comme traitée')}
            </Button>
          </form>
        ) : (
          <form action={setMessageStatusAction}>
            <input type="hidden" name="id" value={message.id} />
            <input type="hidden" name="status" value="NEW" />
            <Button type="submit" size="sm" variant="ghost">
              {t('Rouvrir')}
            </Button>
          </form>
        )}
        <span className="text-xs text-navy-500">
          {message.replyNote ? `${t('Note')} : ${message.replyNote}` : t('Répondez au client par e-mail ou par téléphone.')}
        </span>
      </div>
    </Card>
  );
}

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getAdminI18n();
  const params = await searchParams;
  const rawStatus = typeof params.status === 'string' ? params.status : 'open';
  const status = (['open', 'NEW', 'IN_PROGRESS', 'CLOSED', 'all'] as const).includes(rawStatus as never)
    ? (rawStatus as 'open' | 'NEW' | 'IN_PROGRESS' | 'CLOSED' | 'all')
    : 'open';
  const page = parsePage(params.page);

  const [counters, result] = await Promise.all([countContactMessages(), listContactMessages({ status, page, perPage: 20 })]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">{t('Demandes clients')}</h1>
        <p className="text-sm text-navy-600">
          Messages envoyés depuis le formulaire de contact. {counters.newCount} nouvelle(s) · {counters.open} à traiter ·{' '}
          {counters.total} au total.
        </p>
      </header>

      <Card className="flex flex-wrap items-end gap-3 p-3">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-navy-600" htmlFor="filtre-statut">
            {t('Statut')}
          </label>
          <Select id="filtre-statut" name="status" defaultValue={status} className="w-52">
            <option value="open">{t('À traiter')}</option>
            <option value="NEW">{t('Nouvelles')}</option>
            <option value="IN_PROGRESS">{t('En cours')}</option>
            <option value="CLOSED">{t('Traitées')}</option>
            <option value="all">{t('Toutes')}</option>
          </Select>
          <Button type="submit" variant="outline" size="sm">
            {t('Filtrer')}
          </Button>
        </form>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-10" />}
          title={t('Aucune demande dans cette sélection')}
          description="Les messages envoyés depuis la page contact apparaissent ici, avec le moyen de recontacter le client."
        />
      ) : (
        <>
          <div className="space-y-3">
            {result.items.map((message) => (
              <MessageCard key={message.id} message={message} t={t} />
            ))}
          </div>
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            basePath="/admin/messages"
            searchParams={{ status: status !== 'open' ? status : undefined }}
            labels={{ nav: t('Pagination'), previous: t('Page précédente'), next: t('Page suivante') }}
      />
        </>
      )}
    </div>
  );
}
