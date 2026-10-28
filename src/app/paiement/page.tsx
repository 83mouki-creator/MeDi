import type { Metadata } from 'next';
import Link from 'next/link';
import { Smartphone, Banknote, Store, ShieldCheck, Clock } from 'lucide-react';
import { getStoreSettings } from '@/lib/settings';
import { formatFCFA } from '@/lib/utils';
import { Alert, Card } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'Moyens de paiement',
  description: 'Paiement par Wave, à la livraison à Daloa ou en espèces en boutique. Prépaement obligatoire hors Daloa.',
  alternates: { canonical: '/paiement' },
};

export const dynamic = 'force-dynamic';

export default async function PaymentPage() {
  const settings = await getStoreSettings();

  return (
    <div className="container-page max-w-3xl py-8">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Paiement</h1>
      <p className="mt-2 text-sm text-navy-600">
        Tous les montants sont en francs CFA (FCFA). Le total est recalculé par le serveur à partir des prix en base : ce que
        votre navigateur affiche n’est jamais utilisé pour facturer.
      </p>

      <div className="mt-5 space-y-3">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 size-5 shrink-0 text-accent-600" aria-hidden />
            <div>
              <h2 className="font-bold">Wave</h2>
              <p className="mt-1 text-sm text-navy-600">
                Le paiement Wave se fait depuis votre application, vers le numéro marchand affiché sur la page de commande.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-navy-600">
                <li>
                  Vous saisissez ensuite la <strong>référence de la transaction</strong> dans le formulaire de la commande.
                </li>
                <li>
                  La commande reste au statut « <strong>paiement à vérifier</strong> » jusqu’à ce qu’un administrateur contrôle
                  l’encaissement réel sur le compte marchand.
                </li>
                <li>Aucune confirmation ne s’obtient à partir d’une capture d’écran ou d’une simple déclaration.</li>
              </ul>
              {settings.waveNumber ? (
                <p className="mt-2 text-sm">
                  Numéro marchand Wave : <strong>{settings.waveNumber}</strong>
                  {settings.waveMerchantName ? ` — ${settings.waveMerchantName}` : ''}
                </p>
              ) : (
                <p className="mt-2 text-sm text-navy-500">
                  Le numéro marchand Wave sera affiché ici dès que la boutique l’aura renseigné.
                </p>
              )}
              {settings.waveMode === 'MANUAL' ? (
                <Alert tone="info" className="mt-2">
                  Vérification manuelle par un administrateur. Le délai habituel de contrôle dépend des horaires de la boutique.
                </Alert>
              ) : null}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Banknote className="mt-0.5 size-5 shrink-0 text-accent-600" aria-hidden />
            <div>
              <h2 className="font-bold">Paiement à la livraison (espèces)</h2>
              {settings.allowCod ? (
                <>
                  <p className="mt-1 text-sm text-navy-600">
                    Disponible uniquement à Daloa, pour une livraison à domicile, et dans la limite de{' '}
                    <strong>{formatFCFA(settings.codMaxAmount)}</strong> par commande.
                  </p>
                  <p className="mt-1 text-sm text-navy-600">
                    Le paiement se fait au livreur, à la remise du colis. Le retrait en boutique n’est pas concerné.
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-navy-600">
                  Le paiement à la livraison n’est pas activé. La boutique peut l’ouvrir pour certaines zones ; les conditions
                  applicables apparaissent alors directement au moment du paiement.
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Store className="mt-0.5 size-5 shrink-0 text-accent-600" aria-hidden />
            <div>
              <h2 className="font-bold">Espèces en boutique (retrait)</h2>
              <p className="mt-1 text-sm text-navy-600">
                Si vous choisissez le retrait à Daloa, vous pouvez régler sur place au moment de récupérer la commande. Le stock
                reste réservé pendant le délai indiqué sur votre commande.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <h2 className="mt-8 text-lg font-bold">Hors Daloa : prépaiement obligatoire</h2>
      <p className="mt-2 text-sm text-navy-600">
        Pour toute livraison en dehors de Daloa, la totalité du montant (produits + transport) doit être payée avant
        expédition. Le coût du transport est communiqué et validé avant le paiement ; aucune commande non payée n’est remise au
        transporteur. Les articles restent réservés le temps indiqué, puis sont remis en vente si le paiement n’est pas reçu.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Card className="p-4 text-sm">
          <ShieldCheck className="size-5 text-emerald-600" aria-hidden />
          <h3 className="mt-2 font-bold">Aucun paiement simulé</h3>
          <p className="mt-1 text-navy-600">
            Aucun encaissement n’est inventé par la plateforme. Tant que l’intégration Wave automatique n’est pas configurée, la
            confirmation est faite manuellement par un administrateur, après contrôle du compte marchand.
          </p>
        </Card>
        <Card className="p-4 text-sm">
          <Clock className="size-5 text-accent-600" aria-hidden />
          <h3 className="mt-2 font-bold">Réservation du stock</h3>
          <p className="mt-1 text-navy-600">
            Une commande non payée est annulée automatiquement à l’expiration du délai de réservation
            ({settings.reservationMinutes} minutes) et les articles sont remis en vente.
          </p>
        </Card>
      </div>

      <p className="mt-6 text-sm text-navy-600">
        Un problème de paiement ?{' '}
        <Link href="/contact" className="font-semibold text-accent-700 underline">Contactez la boutique</Link> en précisant votre
        numéro de commande.
      </p>
    </div>
  );
}
