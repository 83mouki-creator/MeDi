import type { Metadata } from 'next';
import Link from 'next/link';
import { getStoreSettings } from '@/lib/settings';
import { LegalPage, LegalSection, Missing } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Conditions générales de vente',
  description:
    'Conditions de vente MeDi : commande, prix en FCFA, disponibilité, paiement, livraison à Daloa et hors Daloa, retours.',
  alternates: { canonical: '/cgv' },
};

export const dynamic = 'force-dynamic';

export default async function TermsPage() {
  const settings = await getStoreSettings();

  return (
    <LegalPage
      title="Conditions générales de vente"
      intro="Les présentes conditions s’appliquent à toute commande passée sur le site. Elles décrivent le fonctionnement effectif de la plateforme ; les mentions réservées à la direction sont signalées."
      pending="Les clauses commerciales définitives (délais de rétractation, garanties, juridiction compétente, pénalités) doivent être validées par le propriétaire et son conseil. Aucune n’est inventée ici."
    >
      <LegalSection title="1. Vendeur">
        <p>
          {settings.storeName}, {settings.city}, {settings.country}. RCCM : <Missing>numéro RCCM</Missing>. Téléphone :{' '}
          {settings.phone ?? <Missing>téléphone de la boutique</Missing>}.
        </p>
      </LegalSection>

      <LegalSection title="2. Produits et disponibilité">
        <p>
          Les produits sont des outils, matériaux et équipements proposés à la vente dans le catalogue. Les visuels sont fournis à
          titre indicatif ; les caractéristiques techniques affichées proviennent des fiches produits saisies par la boutique.
        </p>
        <p>
          La disponibilité est calculée en temps réel à partir du stock physique diminué des quantités réservées par des
          commandes en cours. Un produit peut donc apparaître indisponible si les dernières unités sont réservées le temps d’un
          paiement. Aucun produit n’est présenté comme disponible lorsque le stock réel est nul, sauf précommande explicitement
          ouverte par la boutique.
        </p>
      </LegalSection>

      <LegalSection title="3. Prix">
        <p>
          Les prix sont exprimés en francs CFA (FCFA), toutes taxes comprises le cas échéant. Les frais de livraison sont indiqués
          séparément avant paiement. Les prix promotionnels s’appliquent uniquement pendant la période annoncée.
        </p>
        <p>
          Le total facturé est recalculé par le serveur à partir des prix enregistrés en base au moment de la commande. Un prix
          affiché de manière manifestement erronée peut entraîner l’annulation de la commande et le remboursement intégral.
        </p>
      </LegalSection>

      <LegalSection title="4. Commande">
        <p>
          La commande est enregistrée après validation du panier et des coordonnées de livraison. Un numéro de commande au format
          <span className="font-mono"> MED-AAAA-NNNNN</span> est attribué. L’historique horodaté des statuts est consultable dans
          le suivi de commande.
        </p>
        <p>
          Les articles sont réservés pendant la durée indiquée sur la commande ({settings.reservationMinutes} minutes par défaut).
          À l’expiration, une commande non payée est annulée et les articles sont remis en vente.
        </p>
      </LegalSection>

      <LegalSection title="5. Paiement">
        <p>
          Les moyens de paiement proposés sont affichés après le choix de la destination : Wave, paiement à la livraison (si la
          boutique l’autorise dans la zone et sous le plafond configuré), ou espèces en boutique pour un retrait.
        </p>
        <p>
          <strong>Hors Daloa, le paiement intégral est exigé avant expédition.</strong> L’envoi d’une référence de transaction
          place la commande en « paiement à vérifier » : la confirmation intervient après contrôle de l’encaissement réel par un
          administrateur, ou automatiquement lorsqu’une intégration Wave sécurisée est configurée. Une capture d’écran ne
          constitue pas une preuve de paiement.
        </p>
        <p>
          Le coût du transport hors Daloa est communiqué avant le paiement et n’est pas fixé par une grille nationale
          standardisée : il dépend du transporteur et de la destination, selon les tarifs saisis par la boutique.
        </p>
      </LegalSection>

      <LegalSection title="6. Livraison et retrait">
        <p>
          À Daloa, la commande peut être retirée en boutique ou livrée à domicile selon la zone choisie. Hors Daloa, l’expédition
          est confiée à un transporteur ; le numéro de suivi est communiqué lorsqu’il est disponible. Les délais annoncés sont
          indicatifs.
        </p>
        <p>
          Voir la page <Link href="/livraison" className="font-medium text-accent-700 underline">livraison</Link> pour la grille
          applicable.
        </p>
      </LegalSection>

      <LegalSection title="7. Retours et garanties">
        <p>
          Les conditions de retour et de garantie applicables sont décrites sur la page{' '}
          <Link href="/retours" className="font-medium text-accent-700 underline">retours</Link>. Les garanties fabricant
          s’appliquent selon les termes du fabricant.
        </p>
      </LegalSection>

      <LegalSection title="8. Compte client">
        <p>
          Le client est responsable de la confidentialité de ses identifiants. Toute commande passée depuis un compte est réputée
          effectuée par son titulaire. Un compte peut être suspendu en cas d’usage frauduleux.
        </p>
      </LegalSection>

      <LegalSection title="9. Données personnelles">
        <p>
          Le traitement des données est décrit dans la{' '}
          <Link href="/confidentialite" className="font-medium text-accent-700 underline">politique de confidentialité</Link>.
        </p>
      </LegalSection>

      <LegalSection title="10. Droit applicable et litiges">
        <p>
          Les présentes conditions sont soumises au droit ivoirien. En cas de litige, une solution amiable sera recherchée en
          priorité. Juridiction compétente : <Missing>tribunal compétent désigné par la boutique</Missing>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
