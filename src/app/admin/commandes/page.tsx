import Link from 'next/link';
import { Search } from 'lucide-react';
import { listOrders } from '@/lib/orders';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus } from '@/lib/order-status';
import { formatDateTime, formatFCFA } from '@/lib/utils';
import { Badge, Card, EmptyState } from '@/components/ui/primitives';
import { Input, Select } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/pagination';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const get = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : undefined);

  const page = Math.max(1, Number(get('page') ?? 1) || 1);
  const result = await listOrders({
    q: get('q'),
    status: get('status'),
    paymentStatus: get('paymentStatus'),
    city: get('city'),
    from: get('from'),
    to: get('to'),
    page,
    perPage: 25,
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Commandes</h1>
          <p className="text-sm text-navy-600">{result.total} commande(s) · recherche par numéro, nom ou téléphone</p>
        </div>
      </header>

      <Card className="p-3">
        <form method="get" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy-400" aria-hidden />
            <Input name="q" defaultValue={get('q') ?? ''} placeholder="MED-2026-…, téléphone, nom" className="pl-9" aria-label="Rechercher une commande" />
          </div>
          <Select name="status" defaultValue={get('status') ?? ''} aria-label="Statut">
            <option value="">Tous les statuts</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select name="paymentStatus" defaultValue={get('paymentStatus') ?? ''} aria-label="Paiement">
            <option value="">Tous les paiements</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select name="city" defaultValue={get('city') ?? ''} aria-label="Destination">
            <option value="">Toutes les destinations</option>
            <option value="Daloa">Daloa</option>
            <option value="Abidjan">Abidjan</option>
            <option value="Yamoussoukro">Yamoussoukro</option>
            <option value="Bouaké">Bouaké</option>
            <option value="San-Pédro">San-Pédro</option>
            <option value="Autre ville">Autre ville</option>
          </Select>
          <Button type="submit">Filtrer</Button>
        </form>
      </Card>

      {result.orders.length === 0 ? (
        <EmptyState title="Aucune commande" description="Aucune commande ne correspond à ces filtres." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-500">
              <tr>
                <th className="px-3 py-2">Numéro</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Destination</th>
                <th className="px-3 py-2">Paiement</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {result.orders.map((order) => {
                const row = order as unknown as Record<string, string>;
                return (
                  <tr key={row.id} className="hover:bg-navy-50/60">
                    <td className="px-3 py-2">
                      <Link href={`/admin/commandes/${row.id}`} className="font-mono font-semibold text-accent-700 hover:underline">
                        {row.number}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium">{row.customer_first_name} {row.customer_last_name}</p>
                      <p className="text-xs text-navy-500">{row.phone}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p>{row.city}</p>
                      <p className="text-xs text-navy-500">{row.delivery_method}</p>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={row.payment_status === 'PAID' ? 'success' : row.payment_status === 'AWAITING_VERIFICATION' ? 'warning' : 'neutral'}>
                        {PAYMENT_STATUS_LABELS[row.payment_status as keyof typeof PAYMENT_STATUS_LABELS] ?? row.payment_status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={row.status === 'CANCELLED' ? 'danger' : row.status === 'DELIVERED' ? 'success' : 'neutral'}>
                        {ORDER_STATUS_LABELS[row.status as OrderStatus] ?? row.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{formatFCFA(row.total)}</td>
                    <td className="px-3 py-2 text-xs text-navy-500">{formatDateTime(row.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        basePath="/admin/commandes"
        searchParams={{ q: get('q'), status: get('status'), paymentStatus: get('paymentStatus'), city: get('city') }}
      />
    </div>
  );
}
