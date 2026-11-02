import Link from 'next/link';
import { requirePagePermission } from '@/lib/auth';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { desc, eq } from 'drizzle-orm';
import { CreditCard, Info } from 'lucide-react';
import { db } from '@/db';
import { orders, payments } from '@/db/schema';
import { findPendingPayments } from '@/lib/orders';
import { getStoreSettings } from '@/lib/settings';
import { waveStatus } from '@/lib/wave';
import { formatDateTime, formatFCFA, toFcfa } from '@/lib/utils';
import { Badge, Card, EmptyState } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function AdminPaymentsPage() {
  await requirePagePermission('payments.read');
  const { t } = await getAdminI18n();
  const [pending, settings, wave, recent] = await Promise.all([
    findPendingPayments(),
    getStoreSettings(),
    Promise.resolve(waveStatus()),
    db
      .select({
        id: payments.id,
        amount: payments.amount,
        status: payments.status,
        confirmedAt: payments.confirmedAt,
        customerReference: payments.customerReference,
        orderNumber: orders.number,
        orderId: orders.id,
      })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(eq(payments.status, 'CONFIRMED'))
      .orderBy(desc(payments.confirmedAt))
      .limit(10),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">{t('Argent reçu')}</h1>
        <p className="text-sm text-navy-600">
          {t('Un client dit avoir payé ? Ouvrez votre téléphone Wave, vérifiez que l’argent est bien arrivé, puis appuyez sur « J’ai reçu l’argent ». Une capture d’écran ne suffit pas.')}
        </p>
      </header>

      <Card className="flex flex-wrap items-start gap-3 p-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-navy-400" aria-hidden />
        <div>
          <p className="font-semibold text-navy-900">
            Mode de paiement Wave : {wave.mode}
            {wave.apiConfigured ? ' · clé API détectée' : ' · aucune clé API'}
          </p>
          <p className="text-xs text-navy-600">{wave.reason}</p>
          <p className="mt-1 text-xs text-navy-500">
            Numéro marchand affiché aux clients : {settings.waveNumber ?? 'non renseigné — complétez les paramètres'}.
          </p>
        </div>
      </Card>

      {pending.length === 0 ? (
        <EmptyState icon={<CreditCard className="size-10" />} title={t('Aucun paiement en attente')} description="Les nouvelles références déclarées par les clients apparaîtront ici." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-500">
              <tr>
                <th className="px-3 py-2">{t('Commande')}</th>
                <th className="px-3 py-2">{t('Client')}</th>
                <th className="px-3 py-2">{t('Référence client')}</th>
                <th className="px-3 py-2">{t('Montant')}</th>
                <th className="px-3 py-2">{t('Statut')}</th>
                <th className="px-3 py-2">{t('Date')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {pending.map(({ payment, order }) => (
                <tr key={payment.id} className="hover:bg-navy-50/60">
                  <td className="px-3 py-2">
                    <Link href={`/admin/commandes/${order.id}`} className="font-mono font-semibold text-accent-700 hover:underline">
                      {order.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <p>{order.customerFirstName} {order.customerLastName}</p>
                    <p className="text-xs text-navy-500">{order.phone} · {order.city}</p>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{payment.customerReference ?? <span className="text-navy-400">—</span>}</td>
                  <td className="px-3 py-2 font-semibold">{formatFCFA(payment.amount)}</td>
                  <td className="px-3 py-2">
                    <Badge tone={payment.status === 'AWAITING_VERIFICATION' ? 'warning' : 'neutral'}>{payment.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-navy-500">{formatDateTime(payment.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/admin/commandes/${order.id}`} className="rounded-md bg-accent-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-600">
                      {t('Vérifier')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="overflow-hidden">
        <h2 className="border-b border-navy-100 bg-navy-50 px-4 py-2.5 text-sm font-bold">{t('Confirmations récentes')}</h2>
        {recent.length === 0 ? (
          <p className="px-4 py-4 text-sm text-navy-500">{t('Aucune confirmation enregistrée.')}</p>
        ) : (
          <ul className="divide-y divide-navy-100 text-sm">
            {recent.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <Link href={`/admin/commandes/${payment.orderId}`} className="font-mono text-xs font-semibold text-accent-700 hover:underline">
                  {payment.orderNumber}
                </Link>
                <span className="text-xs text-navy-500">{payment.customerReference ?? 'sans référence client'}</span>
                <span className="text-xs text-navy-500">{formatDateTime(payment.confirmedAt)}</span>
                <span className="font-semibold">{formatFCFA(toFcfa(payment.amount))}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
