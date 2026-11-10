import type { Metadata } from 'next';
import Link from 'next/link';
import { getStoreSettings } from '@/lib/settings';
import { LegalPage, LegalSection } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Supprimer mon compte',
  description:
    'Comment supprimer votre compte client Perokado : depuis le site ou l’application Android, en quelques secondes, et ce que deviennent vos commandes.',
  alternates: { canonical: '/supprimer-mon-compte' },
};

export const dynamic = 'force-dynamic';

/**
 * Page publique de suppression de compte.
 *
 * Adresse à déclarer dans la Play Console (rubrique « Sécurité des données »)
 * pour l'application Android : elle doit rester accessible sans installer
 * l'application et sans se connecter, et décrire ce qui est supprimé, ce qui
 * est conservé et comment demander la suppression autrement.
 */
export default async function DeleteAccountInfoPage() {
  const settings = await getStoreSettings();

  return (
    <LegalPage
      title="Supprimer mon compte"
      intro="Vous pouvez supprimer votre compte client Perokado vous-même, à tout moment, sans écrire à personne et sans frais. La suppression est immédiate."
    >
      <LegalSection title="Depuis le site ou l’application Android">
        <ol className="list-decimal space-y-1 ps-5">
          <li>
            Connectez-vous à votre compte depuis la page{' '}
            <Link href="/connexion" className="font-medium text-accent-700 underline">
              connexion
            </Link>
            .
          </li>
          <li>
            Ouvrez{' '}
            <Link href="/compte/supprimer" className="font-medium text-accent-700 underline">
              la page de suppression
            </Link>{' '}
            (aussi accessible depuis « Mon compte »).
          </li>
          <li>Recopiez le mot SUPPRIMER, saisissez votre mot de passe, puis validez.</li>
        </ol>
        <p>
          L’application Android de Perokado affiche le même site : le chemin est identique, dans l’application comme dans un
          navigateur.
        </p>
      </LegalSection>

      <LegalSection title="Ce qui est effacé">
        <ul className="list-disc space-y-1 ps-5">
          <li>Votre compte : nom, adresse e-mail, numéro de téléphone et mot de passe.</li>
          <li>Vos adresses de livraison enregistrées.</li>
          <li>Toutes vos sessions ouvertes, sur tous vos appareils : vous êtes déconnecté partout.</li>
        </ul>
        <p>La suppression est définitive : un compte supprimé ne peut pas être restauré.</p>
      </LegalSection>

      <LegalSection title="Ce qui est conservé, et pourquoi">
        <p>
          Les commandes déjà passées restent dans la comptabilité de la boutique, avec le nom et le téléphone indiqués au moment
          de la commande. Elles servent de justificatif de vente et permettent d’honorer une garantie ou un retour. Elles ne sont
          plus rattachées à un compte.
        </p>
        <p>
          Ces commandes sont conservées le temps prévu par la
          page <Link href="/confidentialite" className="font-medium text-accent-700 underline">politique de confidentialité</Link>.
        </p>
        <p>
          Le mot de passe et les adresses enregistrées, eux, sont effacés immédiatement et ne sont conservés nulle part.
        </p>
      </LegalSection>

      <LegalSection title="Si vous ne pouvez plus vous connecter">
        <p>
          Écrivez à la boutique depuis la page{' '}
          <Link href="/contact" className="font-medium text-accent-700 underline">
            contact
          </Link>{' '}
          ou sur WhatsApp au numéro affiché en bas de page, en indiquant votre nom et le numéro de téléphone utilisé lors de la
          commande. La suppression est alors faite par la boutique, dans les mêmes conditions.
        </p>
        <p>
          Responsable du traitement : {settings.storeName}, {settings.city}, {settings.country}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
