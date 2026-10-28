import { ExternalLink } from 'lucide-react';
import { startWavePaymentAction } from '@/app/actions/wave';

/** Bouton de paiement Wave automatique (mode AUTO avec clé API configurée). */
export function WavePayButton({ orderId, returnTo, label = 'Payer avec Wave' }: { orderId: string; returnTo: string; label?: string }) {
  return (
    <form action={startWavePaymentAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-3 text-sm font-semibold text-white hover:bg-accent-600"
      >
        <ExternalLink className="size-4" aria-hidden /> {label}
      </button>
    </form>
  );
}
