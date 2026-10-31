import type { Metadata } from 'next';
import Link from 'next/link';
import { getStoreSettings } from '@/lib/settings';
import { LegalPage, LegalSection } from '@/components/legal-page';

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
      intro="Informations relatives à l’éditeur du site MeDi et à son hébergement."
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
          Éditeur et responsable de la publication : la direction de {settings.storeName}.
        </p>
        <p>
          Contact :{' '}
          {settings.email ? (
            <a href={`mailto:${settings.email}`} className="font-medium text-accent-700 underline">{settings.email}</a>
          ) : (
            <Link href="/contact" className="font-medium text-accent-700 underline">formulaire de contact</Link>
          )}
          {settings.phone ? ` · Téléphone : ${settings.phone}` : ''}
        </p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>Le site est hébergé par Vercel Inc., sur une infrastructure cloud.</p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          La marque, le logo, les textes et les photographies produits du site MeDi sont la propriété de la boutique ; toute
          reproduction sans autorisation est interdite.
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
          caractère personnel et la loi n° 2013-546 relative aux transactions électroniques.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
