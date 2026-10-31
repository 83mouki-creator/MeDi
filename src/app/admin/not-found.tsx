import Link from 'next/link';
import { SearchX } from 'lucide-react';

/** 404 interne à l'administration : pas d'habillage boutique. */
export default function AdminNotFound() {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-8 text-center">
      <SearchX className="mx-auto size-8 text-navy-300" aria-hidden />
      <h1 className="mt-3 text-lg font-bold text-navy-900">Élément introuvable</h1>
      <p className="mt-1 text-sm text-navy-600">
        Cet enregistrement n’existe pas ou a été supprimé. Revenez à la liste pour poursuivre.
      </p>
      <Link
        href="/admin"
        className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-600"
      >
        Retour au tableau de bord
      </Link>
    </div>
  );
}
