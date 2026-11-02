import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth-forms';
import { Alert, Card } from '@/components/ui/primitives';
import { getSiteI18n } from '@/lib/i18n/site-server';

export const metadata: Metadata = { title: 'Mot de passe oublié', robots: { index: false, follow: false } };

export default async function ForgotPasswordPage() {
  const { t } = await getSiteI18n();

  return (
    <div className="container-page max-w-md py-10">
      <Card className="p-6">
        <h1 className="text-xl font-extrabold">{t('Mot de passe oublié')}</h1>
        <p className="mt-1 text-sm text-navy-600">
          {t(
            'Indiquez l’adresse e-mail de votre compte : la boutique vous transmet un lien de réinitialisation sécurisé après vérification de votre identité.',
          )}
        </p>
        <div className="mt-5">
          <ForgotPasswordForm />
        </div>
        <Alert tone="info" className="mt-4">
          {t('Pour votre sécurité, la réponse affichée est la même que l’adresse existe ou non.')}
        </Alert>
      </Card>
    </div>
  );
}

export const dynamic = 'force-dynamic';
