import type { Metadata } from 'next';
import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { Truck, PackageCheck, Store, TriangleAlert, Info } from 'lucide-react';
import { db } from '@/db';
import { deliveryZones } from '@/db/schema';
import { getStoreSettings } from '@/lib/settings';
import { formatFCFA, toFcfa } from '@/lib/utils';
import { Alert, Card } from '@/components/ui/primitives';
import { FaqSection } from '@/components/faq-section';
import { faqJsonLd } from '@/lib/faq';
import { DELIVERY_FAQ, DELIVERY_FAQ_FALLBACK_MESSAGE } from '@/lib/delivery-faq';
import { RETURNS_FAQ, RETURNS_FAQ_FALLBACK_MESSAGE } from '@/lib/returns-faq';

export const metadata: Metadata = {
  title: 'Livraison à Daloa et dans toute la Côte d’Ivoire',
  description:
    'Retrait en boutique à Daloa, livraison locale, ou expédition par transporteur dans toute la Côte d’Ivoire avec prépaiement. Cinq questions fréquentes sur les livraisons et les expéditions.',
  alternates: { canonical: '/livraison' },
};

export const dynamic = 'force-dynamic';

export default async function DeliveryPage() {
  const settings = await getStoreSettings();

  let zones: (typeof deliveryZones.$inferSelect)[] = [];
  try {
    zones = await db.select().from(deliveryZones).where(eq(deliveryZones.isActive, true)).orderBy(asc(deliveryZones.sortOrder));
  } catch {
    zones = [];
  }

  const local = zones.filter((zone) => zone.isLocal && !zone.isPickup);
  const national = zones.filter((zone) => !zone.isLocal && !zone.isPickup);
  const pickup = zones.filter((zone) => zone.isPickup);
  const faqStructuredData = faqJsonLd(DELIVERY_FAQ, settings);

  return (
    <div className="container-page max-w-4xl py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }} />
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Livraison et retrait</h1>
      <p className="mt-2 text-sm text-navy-600">
        MeDi opère depuis {settings.city}. La destination est choisie <strong>avant</strong> le mode de paiement, car les
        conditions diffèrent entre Daloa et le reste de la Côte d’Ivoire.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <Store className="size-5 text-accent-600" aria-hidden />
          <h2 className="mt-2 font-bold">Retrait en boutique</h2>
          <p className="mt-1 text-sm text-navy-600">
            {settings.allowPickup
              ? `Gratuit. Vous retirez la commande sur place à ${settings.city}, dès qu’elle est marquée « prête ».`
              : 'Temporairement désactivé par la boutique.'}
          </p>
        </Card>
        <Card className="p-4">
          <Truck className="size-5 text-accent-600" aria-hidden />
          <h2 className="mt-2 font-bold">Livraison locale ({settings.city})</h2>
          <p className="mt-1 text-sm text-navy-600">
            {settings.allowLocalDelivery
              ? 'Livraison à domicile ou au point de repère indiqué. Le montant du transport dépend de la zone choisie et s’affiche avant paiement.'
              : 'Temporairement désactivée par la boutique.'}
          </p>
        </Card>
        <Card className="p-4">
          <PackageCheck className="size-5 text-accent-600" aria-hidden />
          <h2 className="mt-2 font-bold">Hors Daloa</h2>
          <p className="mt-1 text-sm text-navy-600">
            Expédition par transporteur. <strong>Prépaiement intégral obligatoire</strong> avant expédition ; la commande ne
            devient « prête à expédier » qu’après confirmation du paiement.
          </p>
        </Card>
      </div>

      <h2 className="mt-8 text-lg font-bold">Zones et frais de livraison</h2>
      <p className="mt-1 text-sm text-navy-600">
        Les frais dépendent de votre ville ou de votre quartier. Le montant appliqué est toujours celui affiché au moment de la
        commande.
      </p>

      {zones.length === 0 ? (
        <Alert tone="info" className="mt-3" title="Frais à confirmer">
          Contactez la boutique pour connaître les frais applicables à votre destination.
        </Alert>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-navy-100 bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">Zones de livraison et frais associés</caption>
            <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-500">
              <tr>
                <th scope="col" className="px-3 py-2">Zone</th>
                <th scope="col" className="px-3 py-2">Ville</th>
                <th scope="col" className="px-3 py-2">Frais</th>
                <th scope="col" className="px-3 py-2">Gratuit à partir de</th>
                <th scope="col" className="px-3 py-2">Délai indicatif</th>
              </tr>
            </thead>
            <tbody>
              {[...pickup, ...local, ...national].map((zone) => (
                <tr key={zone.id} className="border-t border-navy-100">
                  <td className="px-3 py-2 font-medium">
                    {zone.name}
                    {zone.isPickup ? <span className="ml-1 text-xs text-emerald-700">(retrait)</span> : null}
                  </td>
                  <td className="px-3 py-2 text-navy-600">{zone.city}</td>
                  <td className="px-3 py-2">{zone.isPickup ? 'Gratuit' : formatFCFA(toFcfa(zone.fee))}</td>
                  <td className="px-3 py-2 text-navy-600">
                    {zone.freeAbove ? formatFCFA(toFcfa(zone.freeAbove)) : '—'}
                  </td>
                  <td className="px-3 py-2 text-navy-600">{zone.estimatedDelay ?? 'à confirmer'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 text-lg font-bold">Comment se passe une commande hors Daloa ?</h2>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-navy-600">
        <li>Vous choisissez le produit et indiquez la ville de destination ainsi que le transporteur souhaité.</li>
        <li>La boutique vous confirme le coût du transport et le total à régler avant expédition.</li>
        <li>Vous payez l’intégralité par Wave en joignant la référence de la transaction.</li>
        <li>La boutique vérifie le paiement reçu, puis prépare la commande et la passe en « prête à expédier ».</li>
        <li>Le numéro de suivi du transporteur est communiqué dans le suivi de commande.</li>
      </ol>

      <Alert tone="info" className="mt-4" title="Ce que nous ne faisons pas">
        Aucune expédition hors Daloa n’est remise au transporteur avant confirmation du paiement. Aucune capture d’écran ni
        déclaration du client ne vaut preuve de paiement : seule la vérification de l’encaissement fait foi.
      </Alert>

      <FaqSection
        id="faq-livraison"
        title="Questions fréquentes : livraisons et expéditions"
        intro="Cinq questions qui reviennent le plus souvent en boutique. Pour un cas particulier, le WhatsApp de la boutique reste le canal le plus rapide."
        entries={DELIVERY_FAQ}
        settings={settings}
        fallbackMessage={DELIVERY_FAQ_FALLBACK_MESSAGE}
      />

      <FaqSection
        id="faq-retours"
        title="Questions fréquentes : retours et remboursements"
        intro="Un retour, un échange ou un remboursement dépend toujours de l’état réel de l’article : ces réponses décrivent la procédure, la boutique tranche le cas particulier sur WhatsApp."
        entries={RETURNS_FAQ}
        settings={settings}
        fallbackMessage={RETURNS_FAQ_FALLBACK_MESSAGE}
      />

      <div className="mt-6 flex items-center gap-2 rounded-lg bg-navy-50 p-3 text-sm text-navy-700">
        <Info className="size-4 shrink-0" aria-hidden />
        <span>
          Une question sur une livraison ? <Link href="/contact" className="font-semibold text-accent-700 underline">Contactez la boutique</Link>{' '}
          ou consultez le <Link href="/suivi" className="font-semibold text-accent-700 underline">suivi de commande</Link>.
        </span>
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs text-navy-500">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Les délais affichés sont indicatifs et dépendent des transporteurs. Les conditions de retour figurent sur la page{' '}
        <Link href="/retours" className="underline">retours</Link>.
      </p>
    </div>
  );
}
