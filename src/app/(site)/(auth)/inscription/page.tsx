import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { RegisterForm } from '@/components/auth-forms';
import { Card } from '@/components/ui/primitives';
import { getSiteI18n } from '@/lib/i18n/site-server';

export const metadata: Metadata = { title: 'Créer un compte', robots: { index: false, follow: false } };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect('/compte');
  const { t } = await getSiteI18n();

  return (
    <div className="container-page flex max-w-xl flex-col justify-center py-10">
      <Card className="p-6">
        <h1 className="text-xl font-extrabold">{t('Créer un compte MeDi')}</h1>
        <p className="mt-1 text-sm text-navy-600">
          {t('Retrouvez vos commandes, vos adresses et vos références de paiement. La commande sans compte reste possible.')}
        </p>
        <div className="mt-5">
          <RegisterForm />
        </div>
        <p className="mt-4 text-center text-sm text-navy-600">
          {t('Vous avez déjà un compte ?')}{' '}
          <Link href="/connexion" className="font-semibold text-accent-700 hover:underline">{t('Se connecter')}</Link>
        </p>
      </Card>
    </div>
  );
}

export const dynamic = 'force-dynamic';
