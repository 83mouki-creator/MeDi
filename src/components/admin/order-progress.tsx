import { Check, Circle } from 'lucide-react';
import { ORDER_STEPS, orderStep, type OrderStatus } from '@/lib/order-status';


export function OrderProgress({ status, t }: { status: OrderStatus; t: (text: string) => string }) {
  const current = orderStep(status);
  const stopped = status === 'CANCELLED' || status === 'REFUNDED';

  if (stopped) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
        {status === 'CANCELLED'
          ? t('Cette commande a été annulée : elle n’ira pas plus loin.')
          : t('Cette commande a été remboursée : le client a récupéré son argent.')}
      </div>
    );
  }

  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {ORDER_STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={step.label}
            className={`rounded-lg border px-3 py-2 ${
              active
                ? 'border-accent-300 bg-accent-50'
                : done
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-navy-100 bg-white'
            }`}
          >
            <p className="flex items-center gap-1.5 text-xs font-bold">
              {done ? (
                <Check className="size-3.5 text-emerald-600" aria-hidden />
              ) : (
                <Circle className={`size-3.5 ${active ? 'text-accent-600' : 'text-navy-300'}`} aria-hidden />
              )}
              {index + 1}. {t(step.label)}
            </p>
            <p className="mt-0.5 text-[11px] text-navy-500">
              {done ? t('C’est fait') : active ? t(step.hint) : t('Pas encore')}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
