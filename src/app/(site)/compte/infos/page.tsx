import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ProfileForm } from '@/components/account-forms';
import { ChangePasswordForm } from '@/components/auth-forms';
import { Card } from '@/components/ui/primitives';
import { getSiteI18n } from '@/lib/i18n/site-server';

export const metadata: Metadata = { title: 'Mes informations', robots: { index: false, follow: false } };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/connexion');
  const { t } = await getSiteI18n();

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="mb-3 text-base font-bold">{t('Informations personnelles')}</h2>
        <ProfileForm user={user} />
      </Card>
      <Card className="p-5">
        <h2 className="mb-3 text-base font-bold">{t('Sécurité')}</h2>
        <ChangePasswordForm />
      </Card>
      <Card className="p-5 text-sm text-navy-600">
        <h2 className="mb-2 text-base font-bold text-navy-950">{t('Données personnelles')}</h2>
        <p>
          {t('Vos données servent uniquement à traiter vos commandes et à vous contacter. Vous pouvez demander leur suppression en écrivant à la boutique. Consultez la')}{' '}
          <a href="/confidentialite" className="font-medium text-accent-700 underline">{t('politique de confidentialité')}</a>.
        </p>
      </Card>
    </div>
  );
}
