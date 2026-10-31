import type { Metadata } from 'next';
import Link from 'next/link';
import { getStoreSettings } from '@/lib/settings';
import { LegalPage, LegalSection } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description:
    'Données personnelles collectées par MeDi, finalités, durées de conservation et droits des personnes en Côte d’Ivoire.',
  alternates: { canonical: '/confidentialite' },
};

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const settings = await getStoreSettings();

  return (
    <LegalPage
      title="Politique de confidentialité"
      intro="Cette page explique quelles données personnelles sont traitées lorsque vous utilisez le site MeDi, pourquoi elles le sont, combien de temps elles sont conservées et comment exercer vos droits."
    >
      <LegalSection title="Responsable du traitement">
        <p>
          {settings.storeName}, {settings.city}, {settings.country}. Pour toute demande relative à vos données, écrivez-nous via la
          page <Link href="/contact" className="font-medium text-accent-700 underline">contact</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Données collectées">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Compte client</strong> : nom, adresse e-mail, numéro de téléphone et mot de passe (jamais conservé en clair).
          </li>
          <li>
            <strong>Commandes</strong> : coordonnées de livraison, ville, commune, point de repère, transporteur, contenu de la
            commande, montants, historique des statuts et référence de paiement Wave.
          </li>
          <li>
            <strong>Demandes d’aide</strong> : nom, e-mail, téléphone, objet et contenu du message envoyé depuis la page contact.
          </li>
          <li>
            <strong>Recherche</strong> : requêtes saisies et nombre de résultats, pour améliorer le catalogue. Les photos envoyées
            à la recherche visuelle sont traitées en mémoire et ne sont pas conservées.
          </li>
          <li>
            <strong>Données de sécurité</strong> : adresse IP et type de navigateur, utilisés pour la protection du site
            (limitation des tentatives de connexion, prévention des abus).
          </li>
        </ul>
        <p>Aucune donnée de carte bancaire n’est collectée : les paiements Wave s’effectuent hors du site, dans l’application du client.</p>
      </LegalSection>

      <LegalSection title="Finalités et bases légales">
        <ul className="list-disc space-y-1 pl-5">
          <li>Exécuter une commande et assurer sa livraison ou son retrait.</li>
          <li>Gérer la relation client, répondre aux demandes d’aide et traiter les réclamations.</li>
          <li>Assurer la sécurité du site, prévenir la fraude et vérifier les paiements.</li>
          <li>Respecter les obligations comptables et fiscales de la boutique.</li>
          <li>Améliorer le catalogue et la recherche, à partir de données agrégées.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Durées de conservation">
        <ul className="list-disc space-y-1 pl-5">
          <li>Compte client : tant que le compte est actif, puis suppression sur demande.</li>
          <li>Commandes et factures : conservées pendant la durée légale applicable à la comptabilité ivoirienne.</li>
          <li>Demandes d’aide : le temps nécessaire au traitement, puis archivage limité.</li>
          <li>Journaux de sécurité : durée limitée, proportionnée à la finalité de sécurité.</li>
        </ul>
        <p>
          Les durées de conservation respectent les obligations légales applicables, notamment en matière comptable.
        </p>
      </LegalSection>

      <LegalSection title="Destinataires et sous-traitants">
        <p>
          Les données sont accessibles aux personnes habilitées de la boutique (gestion des commandes, du stock et du service
          client), dans la limite de leurs attributions. Les paiements sont traités par Wave selon ses propres conditions.
        </p>
        <p>Aucune donnée n’est vendue ni cédée à des fins publicitaires.</p>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Vous pouvez demander l’accès à vos données, leur rectification, leur effacement lorsque la loi le permet, la limitation
          du traitement, et vous opposer à certains usages. Écrivez à{' '}
          utilisez la page <Link href="/contact" className="font-medium text-accent-700 underline">contact</Link> ou écrivez-nous
          sur WhatsApp au numéro affiché en bas de page.
        </p>
        <p>
          En cas de difficulté persistante, vous pouvez saisir l’Autorité de régulation des télécommunications de Côte d’Ivoire
          (ARTCI), autorité de protection des données personnelles.
        </p>
      </LegalSection>

      <LegalSection title="Sécurité">
        <p>
          Les mots de passe ne sont jamais conservés en clair, les connexions sont protégées et les accès internes sont limités aux
          personnes habilitées.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Le site n’utilise que les cookies strictement nécessaires à la session (panier, connexion). Aucun cookie publicitaire ou
          de mesure d’audience tierce n’est posé par défaut.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
