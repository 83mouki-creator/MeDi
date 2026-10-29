import { ChevronDown, MessageCircle } from 'lucide-react';
import {
  DELIVERY_FAQ,
  deliveryFaqFallbackHref,
  deliveryFaqHref,
} from '@/lib/delivery-faq';
import type { PublicSettings } from '@/lib/settings';

/**
 * FAQ livraisons et expéditions (accordéon natif <details>, accessible sans JS).
 * Chaque réponse se termine par un renvoi vers le WhatsApp de la boutique.
 */
export function DeliveryFaq({ settings }: { settings: PublicSettings }) {
  const fallback = deliveryFaqFallbackHref(settings);

  return (
    <section id="faq-livraison" aria-labelledby="faq-livraison-titre" className="mt-8 scroll-mt-24">
      <h2 id="faq-livraison-titre" className="text-lg font-bold">
        Questions fréquentes : livraisons et expéditions
      </h2>
      <p className="mt-1 text-sm text-navy-600">
        Cinq questions qui reviennent le plus souvent en boutique. Pour un cas particulier, le WhatsApp de la boutique reste le
        canal le plus rapide.
      </p>

      <div className="mt-3 divide-y divide-navy-100 overflow-hidden rounded-xl border border-navy-100 bg-white">
        {DELIVERY_FAQ.map((entry) => {
          const href = deliveryFaqHref(settings, entry);
          return (
            <details key={entry.id} className="group px-4 py-3 open:bg-navy-50/40">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-semibold text-navy-900 [&::-webkit-details-marker]:hidden">
                <span className="flex items-start gap-2">
                  <MessageCircle className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
                  {entry.question}
                </span>
                <ChevronDown
                  className="mt-0.5 size-4 shrink-0 text-navy-400 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="mt-2 pl-6 text-sm text-navy-600">
                <p>{entry.answer}</p>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  >
                    <MessageCircle className="size-4" aria-hidden />
                    Poser ma question sur WhatsApp
                  </a>
                ) : (
                  <a
                    href="/contact"
                    className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-navy-200 px-4 py-2.5 text-sm font-semibold text-navy-800 hover:bg-navy-50"
                  >
                    <MessageCircle className="size-4" aria-hidden />
                    Écrire à la boutique
                  </a>
                )}
              </div>
            </details>
          );
        })}
      </div>

      {fallback ? (
        <p className="mt-3 text-xs text-navy-500">
          Vous ne trouvez pas votre cas ?{' '}
          <a href={fallback} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 underline">
            Écrivez directement sur WhatsApp
          </a>{' '}
          — les réponses sont données pendant les heures d’ouverture.
        </p>
      ) : null}
    </section>
  );
}
