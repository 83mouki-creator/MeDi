import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { roleHome } from '@/lib/roles';
import { StaffActivationForm } from '@/components/staff-activation-form';
import { Card } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'Activer mon accès agent',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Point d'entrée des agents.
 *
 * Aucune inscription libre : le compte est créé par un administrateur dans
 * /admin/utilisateurs. L'agent saisit le code reçu par WhatsApp, son nom et son
 * téléphone, puis choisit son mot de passe.
 */
export default async function AgentAccessPage() {
  const user = await getCurrentUser();
  if (user) redirect(isStaff(user.role) ? roleHome(user.role) : '/compte');

  return (
    <div className="container-page max-w-lg py-10">
      <Card className="p-6">
        <h1 className="text-xl font-extrabold">Activer mon accès agent</h1>
        <p className="mt-1 text-sm text-navy-600">
          Votre compte a été créé par un administrateur MeDi. Saisissez le code d’accès reçu par WhatsApp, vos nom et
          prénom, puis votre numéro de téléphone pour choisir votre mot de passe.
        </p>
        <div className="mt-5">
          <StaffActivationForm />
        </div>
        <div className="mt-5 space-y-1 border-t border-navy-100 pt-4 text-center text-sm text-navy-600">
          <p>
            Vous avez déjà activé votre accès ?{' '}
            <Link href="/connexion" className="font-semibold text-accent-700 hover:underline">
              Se connecter
            </Link>
          </p>
          <p className="text-xs text-navy-500">
            Aucun compte agent ne peut être créé ici : seul un administrateur ouvre les accès.
          </p>
        </div>
      </Card>
    </div>
  );
}
