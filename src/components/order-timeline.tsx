import { Check, Clock, X } from 'lucide-react';
import { ORDER_STATUS_LABELS, TRACKING_STEPS, type OrderStatus } from '@/lib/order-status';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

type HistoryEntry = {
  id: string;
  toStatus: OrderStatus;
  fromStatus: OrderStatus | null;
  note: string | null;
  actorLabel: string;
  createdAt: Date | string;
};

/** Frise de progression + historique horodaté des changements de statut. */
export function OrderTimeline({ status, history }: { status: OrderStatus; history: HistoryEntry[] }) {
  const cancelled = status === 'CANCELLED' || status === 'REFUNDED';
  const currentIndex = TRACKING_STEPS.indexOf(status);

  return (
    <div>
      {cancelled ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900">
          <X className="size-4" aria-hidden /> Commande {ORDER_STATUS_LABELS[status].toLowerCase()}
        </div>
      ) : (
        <ol className="mb-5 grid gap-1 sm:grid-cols-5">
          {TRACKING_STEPS.filter((step) => step !== 'AWAITING_PAYMENT_VERIFICATION').map((step, index, arr) => {
            const stepIndex = TRACKING_STEPS.indexOf(step);
            const done = currentIndex >= stepIndex;
            const isCurrent = status === step;
            return (
              <li key={step} className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-1">
                <span
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold',
                    done ? 'bg-emerald-600 text-white' : 'bg-navy-100 text-navy-500',
                    isCurrent && 'ring-2 ring-emerald-300',
                  )}
                  aria-hidden
                >
                  {done ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span className={cn('text-xs', done ? 'font-semibold text-navy-900' : 'text-navy-500')}>
                  {ORDER_STATUS_LABELS[step]}
                </span>
                {index < arr.length - 1 ? <span className="hidden h-0.5 flex-1 bg-navy-100 sm:block" aria-hidden /> : null}
              </li>
            );
          })}
        </ol>
      )}

      <h3 className="mb-2 text-sm font-bold text-navy-900">Historique</h3>
      <ol className="space-y-3">
        {history.map((entry) => (
          <li key={entry.id} className="flex gap-3">
            <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-navy-50 text-navy-500" aria-hidden>
              <Clock className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-navy-900">
                {ORDER_STATUS_LABELS[entry.toStatus]}
                {entry.fromStatus ? <span className="font-normal text-navy-500"> (depuis {ORDER_STATUS_LABELS[entry.fromStatus]})</span> : null}
              </p>
              <p className="text-xs text-navy-500">
                {formatDateTime(entry.createdAt)} · {entry.actorLabel}
              </p>
              {entry.note ? <p className="mt-0.5 text-xs text-navy-600">{entry.note}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
