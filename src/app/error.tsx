'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, Home, TriangleAlert } from 'lucide-react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Le détail technique reste dans les journaux serveur ; l'utilisateur voit un message clair.
    console.error('[ui] erreur inattendue', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="container-page flex min-h-[60vh] max-w-2xl flex-col items-center justify-center py-12 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-rose-50 text-rose-500">
        <TriangleAlert className="size-8" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">Une erreur est survenue</h1>
      <p className="mt-2 max-w-md text-sm text-navy-600">
        La page n’a pas pu être affichée. Vos données de commande ne sont pas perdues : réessayez, ou revenez à l’accueil.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-navy-400">Référence : {error.digest}</p> : null}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-600"
        >
          <RefreshCw className="size-4" aria-hidden /> Réessayer
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-800 hover:border-navy-300"
        >
          <Home className="size-4" aria-hidden /> Accueil
        </Link>
      </div>
      <p className="mt-6 text-xs text-navy-500">
        Si le problème persiste,{' '}
        <Link href="/contact" className="font-semibold text-accent-700 underline">prévenez la boutique</Link>.
      </p>
    </div>
  );
}
