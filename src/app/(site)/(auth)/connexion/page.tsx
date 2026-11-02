import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { LoginForm } from '@/components/auth-forms';
import { Card } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Connexion', robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  const params = await searchParams;
  if (user) redirect(isStaff(user.role) ? '/admin' : '/compte');

  const redirectTo = typeof params.redirectTo === 'string' ? params.redirectTo : '';

  return (
    <div className="container-page flex max-w-md flex-col justify-center py-10">
      <Card className="p-6">
        <h1 className="text-xl font-extrabold">Connexion</h1>
        <p className="mt-1 text-sm text-navy-600">
          Clients : vos commandes et vos adresses. Agents : votre e-mail ou votre numéro ivoirien.
        </p>
        {params.reset === '1' ? (
          <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">Mot de passe réinitialisé. Connectez-vous.</p>
        ) : null}
        <div className="mt-5">
          <LoginForm redirectTo={redirectTo} />
        </div>
        <div className="mt-5 rounded-xl border border-navy-200 bg-navy-50/60 p-3">
          <p className="text-sm font-semibold text-navy-900">Vous êtes agent MeDi ?</p>
          <p className="mt-0.5 text-xs text-navy-600">
            Votre accès a été créé par un administrateur. Munissez-vous du code reçu par WhatsApp.
          </p>
          <Link
            href="/connexion/agent"
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-navy-300 bg-white px-3 py-2 text-sm font-semibold text-navy-800 hover:border-accent-400 hover:text-accent-700"
          >
            J’ai un code d’accès agent
          </Link>
        </div>
        <p className="mt-4 text-center text-sm text-navy-600">
          Pas encore de compte client ?{' '}
          <Link href="/inscription" className="font-semibold text-accent-700 hover:underline">Créer un compte</Link>
        </p>
        <p className="mt-1 text-center text-xs text-navy-500">
          Mot de passe oublié ?{' '}
          <Link href="/mot-de-passe-oublie" className="underline hover:text-accent-700">Réinitialiser</Link>
        </p>
      </Card>
      <p className="mt-4 text-center text-xs text-navy-500">
        Vous pouvez aussi commander sans compte : le suivi se fait avec votre numéro de commande.
      </p>
    </div>
  );
}

export const dynamic = 'force-dynamic';
