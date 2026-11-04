import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { DeleteAccountForm } from '@/components/account-forms';
import { Card } from '@/components/ui/primitives';
import { getSiteI18n } from '@/lib/i18n/site-server';

export const metadata: Metadata = {
  title: 'Supprimer mon compte',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Suppression du compte client, en libre-service.
 *
 * Cette page est la contrepartie exigée par Google Play pour une application
 * qui permet de créer un compte : supprimer doit être aussi simple que créer.
 * Elle est accessible depuis l'espace client (`/compte`) et depuis la page
 * publique `/supprimer-mon-compte` (adresse déclarée dans la Play Console).
 */
export default async function DeleteAccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/connexion?redirectTo=/compte/supprimer');
  const { t } = await getSiteI18n();

  // Un agent ou le propriétaire ne s'efface pas lui-même : la boutique se
  // retrouverait sans personne pour la gérer. La suppression se fait depuis
  // l'administration, par un compte de niveau supérieur.
  if (user.role !== 'CUSTOMER') {
    return (
      <Card className="p-5 text-sm leading-relaxed text-navy-700">
        <h2 className="mb-2 text-base font-bold text-navy-950">{t('Supprimer mon compte')}</h2>
        <p>
          {t(
            'Votre compte est un compte du personnel : il ne peut pas être supprimé depuis cette page. Demandez au propriétaire de la boutique de retirer votre accès dans l’administration.',
          )}
        </p>
      </Card>
    );
  }

  const rows = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);

  return (
    <div className="space-y-5">
      <Card className="p-5 text-sm leading-relaxed text-navy-700">
        <h2 className="mb-3 text-base font-bold text-navy-950">{t('Ce qui sera effacé immédiatement')}</h2>
        <ul className="list-disc space-y-1 ps-5">
          <li>{t('Votre compte : nom, e-mail, téléphone et mot de passe.')}</li>
          <li>{t('Vos adresses enregistrées.')}</li>
          <li>{t('Vos sessions ouvertes sur tous vos appareils.')}</li>
        </ul>
        <h2 className="mb-3 mt-5 text-base font-bold text-navy-950">{t('Ce qui reste dans la boutique')}</h2>
        <p>
          {t(
            'Vos commandes déjà passées sont conservées avec le nom et le téléphone indiqués au moment de la commande : elles servent de justificatif de vente, de garantie et de retour. Elles ne sont plus rattachées à un compte.',
          )}
        </p>
        <p className="mt-2">
          {t('Vous pourrez toujours suivre une commande avec son numéro depuis la page')}{' '}
          <Link href="/suivi" className="font-medium text-accent-700 underline">
            {t('suivi de commande')}
          </Link>
          .
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-base font-bold text-navy-950">{t('Confirmer la suppression')}</h2>
        <DeleteAccountForm hasPassword={Boolean(rows[0]?.passwordHash)} />
      </Card>

      <Card className="p-5 text-sm text-navy-600">
        <h2 className="mb-2 text-base font-bold text-navy-950">{t('Une commande en cours ?')}</h2>
        <p>
          {t('Attendez la livraison avant de supprimer votre compte, ou écrivez-nous depuis la page')}{' '}
          <Link href="/contact" className="font-medium text-accent-700 underline">
            {t('contact')}
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
