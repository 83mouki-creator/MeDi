import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth-forms';
import { Alert, Card } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Mot de passe oublié', robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="container-page max-w-md py-10">
      <Card className="p-6">
        <h1 className="text-xl font-extrabold">Mot de passe oublié</h1>
        <p className="mt-1 text-sm text-navy-600">
          Indiquez l&apos;adresse e-mail de votre compte : la boutique vous transmet un lien de réinitialisation sécurisé après
          vérification de votre identité.
        </p>
        <div className="mt-5">
          <ForgotPasswordForm />
        </div>
        <Alert tone="info" className="mt-4">
          Pour votre sécurité, la réponse affichée est la même que l&apos;adresse existe ou non.
        </Alert>
      </Card>
    </div>
  );
}

export const dynamic = 'force-dynamic';
