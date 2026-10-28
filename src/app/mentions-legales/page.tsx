import type { Metadata } from 'next';
import Link from 'next/link';
import { getStoreSettings } from '@/lib/settings';
import { LegalPage, LegalSection, Missing } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Éditeur du site MeDi, hébergement et informations légales.',
  alternates: { canonical: '/mentions-legales' },
};

export const dynamic = 'force-dynamic';

export default async function LegalNoticePage() {
  const settings = await getStoreSettings();

  return (
    <LegalPage
      title="Mentions légales"
      intro="Informations relatives à l’éditeur du site et à son hébergement, conformément aux usages du commerce en ligne en Côte d’Ivoire."
      pending="Les identifiants d’entreprise (RCCM, compte contribuable, NCC), la raison sociale exacte et l’adresse du siège doivent être fournis par le propriétaire. Ils ne sont pas inventés ici."
    >
      <LegalSection title="Éditeur du site">
        <p>
          Dénomination commerciale : <strong>{settings.storeName}</strong>
          {settings.addressLine ? (
            <>
              , {settings.addressLine}
            </>
          ) : null}
          , {settings.city}, {settings.country}.
        </p>
        <p>
          Forme juridique : <Missing>SARL / SASU / entreprise individuelle</Missing> — RCCM :{' '}
          <Missing>numéro au registre du commerce</Missing> — Compte contribuable :{' '}
          <Missing>numéro fiscal</Missing>.
        </p>
        <p>
          Responsable de la publication : <Missing>nom et fonction du représentant légal</Missing>.
        </p>
        <p>
          Contact :{' '}
          {settings.email ? (
            <a href={`mailto:${settings.email}`} className="font-medium text-accent-700 underline">{settings.email}</a>
          ) : (
            <Missing>adresse e-mail de contact</Missing>
          )}{' '}
          · Téléphone : {settings.phone ?? <Missing>numéro de téléphone de la boutique</Missing>}
        </p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>
          Site hébergé sur Vercel (infrastructure cloud). Base de données PostgreSQL hébergée par Neon. Les images produits sont
          stockées sur un service de stockage objet / Cloudinary configuré par la boutique.
        </p>
        <p>
          Les coordonnées complètes de l’hébergeur ainsi que la localisation des sauvegardes sont documentées dans le dossier
          technique du projet (<span className="font-mono text-xs">docs/DEPLOIEMENT.md</span>).
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          La marque, le logo, les textes et les visuels de MeDi sont la propriété de la boutique. Les photographies produits sont
          fournies par le propriétaire ou prises pour son compte ; leur reproduction sans autorisation est interdite.
        </p>
        <p>
          Les marques de fabricants citées (par exemple Nasco) appartiennent à leurs titulaires respectifs et sont mentionnées à
          titre d’identification des produits.
        </p>
      </LegalSection>

      <LegalSection title="Signalement">
        <p>
          Pour signaler un contenu inexact, un prix erroné ou un usage abusif du site, écrivez-nous depuis la page{' '}
          <Link href="/contact" className="font-medium text-accent-700 underline">contact</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Textes de référence">
        <p>
          Le site s’inscrit dans le cadre du droit ivoirien, notamment la loi n° 2013-450 relative à la protection des données à
          caractère personnel et la loi n° 2013-546 relative aux transactions électroniques. L’application de ces textes au
          fonctionnement précis de la boutique doit être validée par le conseil juridique du propriétaire.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
