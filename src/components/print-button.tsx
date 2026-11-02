'use client';

import { Printer } from 'lucide-react';

/** Bouton d'impression : masqué à l'impression, jamais sur le papier. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-xs font-bold text-white hover:bg-navy-800"
    >
      <Printer className="size-4" aria-hidden />
      Imprimer
    </button>
  );
}
