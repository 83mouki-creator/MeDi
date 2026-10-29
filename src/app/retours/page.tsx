import type { Metadata } from 'next';
import Link from 'next/link';
import { PackageX, ShieldAlert, Camera, Info } from 'lucide-react';
import { getStoreSettings } from '@/lib/settings';
import { faqJsonLd } from '@/lib/faq';
import { RETURNS_FAQ, RETURNS_FAQ_FALLBACK_MESSAGE } from '@/lib/returns-faq';
import { FaqSection } from '@/components/faq-section';
import { Alert, Card } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'Retours, échanges et garanties',
  description: 'Procédure de retour et d’échange des produits achetés chez MeDi à Daloa.',
  alternates: { canonical: '/retours' },
};

export const dynamic = 'force-dynamic';

export default async function ReturnsPage() {
  const settings = await getStoreSettings();
  const faqStructuredData = faqJsonLd(RETURNS_FAQ, settings);

  return (
    <div className="container-page max-w-3xl py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }} />
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Retours, échanges et garanties</h1>
      <p className="mt-2 text-sm text-navy-600">
        Les conditions ci-dessous décrivent le fonctionnement de la plateforme. Les durées et modalités commerciales définitives
        sont arrêtées par la direction de la boutique.
      </p>

      {settings.returnPolicy ? (
        <Card className="mt-4 whitespace-pre-line p-4 text-sm text-navy-700">{settings.returnPolicy}</Card>
      ) : (
        <Alert tone="warning" className="mt-4" title="Politique de retour non encore publiée">
          La direction n’a pas encore communiqué sa politique de retour définitive (délai, conditions de reprise, frais). Aucune
          durée n’est inventée ici. En attendant, chaque demande est examinée au cas par cas :{' '}
          <Link href="/contact" className="font-semibold underline">écrivez-nous</Link> avec votre numéro de commande.
        </Alert>
      )}

      <h2 className="mt-7 text-lg font-bold">Ce qui est toujours possible</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Card className="p-4 text-sm">
          <PackageX className="size-5 text-accent-600" aria-hidden />
          <h3 className="mt-2 font-bold">Produit endommagé à la réception</h3>
          <p className="mt-1 text-navy-600">
            Refusez le colis auprès du transporteur si l’emballage est visiblement détérioré, puis contactez la boutique le jour
            même en joignant des photos.
          </p>
        </Card>
        <Card className="p-4 text-sm">
          <ShieldAlert className="size-5 text-accent-600" aria-hidden />
          <h3 className="mt-2 font-bold">Produit défectueux</h3>
          <p className="mt-1 text-navy-600">
            Les garanties applicables sont celles du fabricant, indiquées sur la facture. La boutique vous accompagne pour la mise
            en œuvre de la garantie.
          </p>
        </Card>
        <Card className="p-4 text-sm">
          <Camera className="size-5 text-accent-600" aria-hidden />
          <h3 className="mt-2 font-bold">Erreur de référence</h3>
          <p className="mt-1 text-navy-600">
            Vérifiez les dimensions, la tension, le calibre et la matière avant de commander : les photos et descriptions sont
            fournies à titre indicatif. Un échange est étudié si le produit est intact, dans son emballage d’origine.
          </p>
        </Card>
        <Card className="p-4 text-sm">
          <Info className="size-5 text-accent-600" aria-hidden />
          <h3 className="mt-2 font-bold">Frais de renvoi</h3>
          <p className="mt-1 text-navy-600">
            Le coût du transport retour dépend de la zone et du transporteur. Il est communiqué avant toute reprise du produit.
          </p>
        </Card>
      </div>

      <FaqSection
        id="faq-retours"
        title="Questions fréquentes : retours et remboursements"
        intro="Cinq questions sur les retours, les échanges et les remboursements. Les conditions définitives relèvent de la direction ; chaque cas est confirmé sur le WhatsApp de la boutique."
        entries={RETURNS_FAQ}
        settings={settings}
        fallbackMessage={RETURNS_FAQ_FALLBACK_MESSAGE}
        className="mt-8 scroll-mt-24"
      />

      <h2 className="mt-7 text-lg font-bold">Comment demander un retour</h2>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-navy-600">
        <li>Contactez la boutique depuis la page <Link href="/contact" className="font-semibold text-accent-700 underline">contact</Link> ou par téléphone.</li>
        <li>Indiquez le numéro de commande (MED-AAAA-NNNNN), la référence du produit et le motif.</li>
        <li>Joignez des photos si le produit est endommagé ou non conforme.</li>
        <li>La boutique vous indique la marche à suivre (retour en boutique à Daloa ou remise au transporteur).</li>
      </ol>

      <p className="mt-6 text-xs text-navy-500">
        Les produits sur mesure, les articles découpés ou commandés spécialement pour vous, ainsi que les consommables ouverts,
        peuvent être exclus du retour. Les exclusions définitives sont fixées par la politique commerciale de la boutique.
      </p>
    </div>
  );
}
