import type { Metadata } from 'next';
import { Alert, Card } from '@/components/ui/primitives';
import { getSiteI18n } from '@/lib/i18n/site-server';
import { ResetPasswordForm } from '@/components/account-forms';

export const metadata: Metadata = { title: 'Réinitialiser le mot de passe', robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : '';
  const { t } = await getSiteI18n();

  return (
    <div className="container-page max-w-md py-10">
      <Card className="p-6">
        <h1 className="text-xl font-extrabold">{t('Nouveau mot de passe')}</h1>
        {token ? (
          <div className="mt-4">
            <ResetPasswordForm token={token} />
          </div>
        ) : (
          <Alert tone="danger" className="mt-4">
            {t('Ce lien de réinitialisation n’est pas valide ou a expiré. Demandez un nouveau lien à la boutique.')}
          </Alert>
        )}
      </Card>
    </div>
  );
}

export const dynamic = 'force-dynamic';
