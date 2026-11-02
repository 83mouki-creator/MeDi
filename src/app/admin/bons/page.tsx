import Link from 'next/link';
import { Printer, Search, Truck } from 'lucide-react';
import { requirePagePermission } from '@/lib/auth';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { listDeliveryNotes } from '@/lib/delivery-notes';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/order-status';
import { Badge, Card, EmptyState } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { formatFCFA, toFcfa } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DeliveryNotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission('delivery.manage');
  const { t } = await getAdminI18n();
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q : '';
  const includeDelivered = params.livrees === '1';

  const notes = await listDeliveryNotes({ q, includeDelivered });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">{t('Bons de livraison')}</h1>
        <p className="text-sm text-navy-600">
          {t('Chaque bon reprend les produits réellement commandés, le quartier ou la ville et le téléphone du client. Imprimez-le : il est mis en page pour les petites imprimantes de comptoir.')}
        </p>
      </header>

      <Card className="p-3">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-navy-400" aria-hidden />
            <Input
              name="q"
              defaultValue={q}
              className="ps-9"
              placeholder={t('N° de commande, nom ou téléphone')}
              aria-label={t('Rechercher un bon de livraison')}
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-navy-700">
            <input type="checkbox" name="livrees" value="1" defaultChecked={includeDelivered} className="size-4 accent-accent-500" />
            {t('Afficher aussi les commandes déjà livrées')}
          </label>
          <Button type="submit" size="sm">
            {t('Afficher')}
          </Button>
        </form>
      </Card>

      {notes.length === 0 ? (
        <EmptyState
          icon={<Truck className="size-8" aria-hidden />}
          title={t('Aucune livraison à préparer')}
          description={t('Les commandes payées ou en préparation apparaîtront ici, prêtes à être imprimées pour le livreur.')}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {notes.map((note) => (
            <Card key={note.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold">{note.number}</p>
                  <p className="text-xs text-navy-600">
                    {note.customerName} · {note.phone}
                  </p>
                  <p className="mt-1 text-xs text-navy-600">
                    {note.deliveryMethod === 'CARRIER' ? t('Hors Daloa') : t('Livraison Daloa')} ·{' '}
                    <strong>{note.neighbourhood ?? note.city}</strong>
                  </p>
                </div>
                <Badge tone={note.paymentStatus === 'PAID' ? 'success' : 'warning'}>
                  {note.paymentStatus === 'PAID' ? t('Payée') : t('À encaisser')}
                </Badge>
              </div>

              <p className="mt-2 text-xs text-navy-500">
                {note.itemCount} {t('article(s)')} · {formatFCFA(toFcfa(note.total))} ·{' '}
                {t(ORDER_STATUS_LABELS[note.status as OrderStatus] ?? note.status)}
              </p>

              <Link
                href={`/bons-livraison/${note.id}`}
                target="_blank"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-xs font-bold text-white hover:bg-navy-800"
              >
                <Printer className="size-3.5" aria-hidden />
                {t('Imprimer le bon')}
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
