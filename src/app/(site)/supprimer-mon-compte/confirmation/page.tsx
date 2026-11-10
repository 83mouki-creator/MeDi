import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Compte supprimé',
  robots: { index: false, follow: false },
};

/**
 * Confirmation affichée après une suppression de compte.
 *
 * Page volontairement publique : à cet instant, la session vient d'être
 * effacée, l'espace client n'est donc plus accessible.
 */
export default function AccountDeletedPage() {
  return (
    <LegalPage
      title="Votre compte a été supprimé"
      intro="Votre compte client Perokado n’existe plus et vous êtes déconnecté de tous vos appareils."
    >
      <LegalSection title="Ce qui vient d’être effacé">
        <ul className="list-disc space-y-1 ps-5">
          <li>Votre compte, votre mot de passe et vos adresses enregistrées.</li>
          <li>Vos sessions ouvertes, sur tous vos appareils.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Ce qui reste">
        <p>
          Les commandes déjà passées restent dans la comptabilité de la boutique, avec le nom et le téléphone indiqués au moment
          de la commande, pour les garanties et les retours. Elles ne sont plus rattachées à un compte.
        </p>
        <p>
          Vous pouvez toujours suivre une commande avec son numéro depuis la page{' '}
          <Link href="/suivi" className="font-medium text-accent-700 underline">
            suivi de commande
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Envie de revenir ?">
        <p>
          Vous pouvez créer un nouveau compte à tout moment depuis la page{' '}
          <Link href="/inscription" className="font-medium text-accent-700 underline">
            inscription
          </Link>
          . Il sera vierge : l’ancien compte, lui, ne peut pas être restauré.
        </p>
        <p>
          Une question ? Écrivez-nous depuis la page{' '}
          <Link href="/contact" className="font-medium text-accent-700 underline">
            contact
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
