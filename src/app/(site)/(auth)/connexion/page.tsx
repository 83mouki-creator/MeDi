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
        <p className="mt-1 text-sm text-navy-600">Accédez à vos commandes et à vos adresses.</p>
        {params.reset === '1' ? (
          <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">Mot de passe réinitialisé. Connectez-vous.</p>
        ) : null}
        <div className="mt-5">
          <LoginForm redirectTo={redirectTo} />
        </div>
        <p className="mt-4 text-center text-sm text-navy-600">
          Pas encore de compte ?{' '}
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
