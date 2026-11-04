import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pas de connexion',
  robots: { index: false, follow: false },
};

/**
 * Page affichée par le service worker quand le téléphone n'a plus de réseau.
 * Elle est mise en cache à l'installation de l'application et ne dépend d'aucune
 * donnée de la base : elle s'affiche donc toujours, même hors connexion.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-extrabold tracking-tight">Pas de connexion</h1>
      <p className="text-sm leading-relaxed text-navy-600">
        Vérifiez votre connexion internet, puis réessayez. Le catalogue MeDi Shop s’affiche dès que
        le réseau revient.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-bold text-navy-950 hover:bg-accent-400"
      >
        Réessayer
      </Link>
    </main>
  );
}
