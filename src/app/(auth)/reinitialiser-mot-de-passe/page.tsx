import type { Metadata } from 'next';
import { Alert, Card } from '@/components/ui/primitives';
import { ResetPasswordForm } from '@/components/account-forms';

export const metadata: Metadata = { title: 'Réinitialiser le mot de passe', robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : '';

  return (
    <div className="container-page max-w-md py-10">
      <Card className="p-6">
        <h1 className="text-xl font-extrabold">Nouveau mot de passe</h1>
        {token ? (
          <div className="mt-4">
            <ResetPasswordForm token={token} />
          </div>
        ) : (
          <Alert tone="danger" className="mt-4">
            Lien invalide : le jeton de réinitialisation est absent. Demandez un nouveau lien à la boutique.
          </Alert>
        )}
      </Card>
    </div>
  );
}

export const dynamic = 'force-dynamic';
