import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { adminActivationStatus } from '@/lib/admin-activation';
import { AdminActivationForm } from '@/components/admin-activation-form';
import { Card } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'Activation du compte propriétaire',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Page de création du tout premier compte propriétaire.
 * Elle n'existe que si le jeton d'activation est valide ET qu'aucun
 * administrateur n'est encore enregistré ; sinon elle renvoie un 404.
 */
export default async function ActivationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : '';
  const status = await adminActivationStatus(token);

  if (status === 'refuse') notFound();

  if (status === 'initialise') {
    return (
      <div className="container-page max-w-lg py-10">
        <Card className="p-6">
          <h1 className="flex items-center gap-2 text-xl font-extrabold">
            <ShieldCheck className="size-5 text-emerald-600" aria-hidden /> Administration déjà activée
          </h1>
          <p className="mt-2 text-sm text-navy-600">
            Un compte administrateur existe déjà pour cette boutique. Ce lien ne peut plus être utilisé : connectez-vous avec
            votre adresse e-mail et votre mot de passe.
          </p>
          <Link
            href="/connexion?redirectTo=/admin"
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-600"
          >
            <KeyRound className="size-4" aria-hidden /> Se connecter à l’administration
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-page max-w-lg py-10">
      <Card className="p-6">
        <h1 className="flex items-center gap-2 text-xl font-extrabold">
          <ShieldCheck className="size-5 text-accent-600" aria-hidden /> Créer le compte propriétaire
        </h1>
        <p className="mt-2 text-sm text-navy-600">
          Ce formulaire ne fonctionne qu’une seule fois, tant qu’aucun administrateur n’existe. Choisissez vous-même votre mot
          de passe : personne d’autre n’y a accès, et il peut être changé plus tard depuis votre compte.
        </p>
        <p className="mt-2 text-xs text-navy-500">
          Les actions sensibles (prix, stock, paiement, comptes) sont ensuite journalisées avec votre identité.
        </p>
        <div className="mt-5">
          <AdminActivationForm token={token} defaultName="MeDi" />
        </div>
      </Card>
    </div>
  );
}
