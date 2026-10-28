import type { Metadata } from 'next';
import Link from 'next/link';
import { ShoppingBag, Store, Truck } from 'lucide-react';
import { getCartSummary } from '@/lib/cart';
import { getStoreSettings } from '@/lib/settings';
import { CartLineRow } from '@/components/cart-view';
import { Alert, Card, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { formatFCFA } from '@/lib/utils';

export const metadata: Metadata = { title: 'Mon panier', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const [summary, settings] = await Promise.all([getCartSummary(), getStoreSettings()]);

  if (summary.isEmpty) {
    return (
      <div className="container-page py-10">
        <EmptyState
          icon={<ShoppingBag className="size-10" />}
          title="Votre panier est vide"
          description="Parcourez le catalogue et ajoutez les produits dont vous avez besoin. Vous pouvez commander sans créer de compte."
          action={<ButtonLink href="/catalogue">Découvrir le catalogue</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className="container-page py-6">
      <SectionHeading title="Mon panier" subtitle={`${summary.itemCount} article(s) · ${summary.distinctCount} référence(s)`} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-4">
          <ul>
            {summary.lines.map((line) => (
              <CartLineRow key={line.productId} line={line} />
            ))}
          </ul>

          {summary.hasIssues ? (
            <Alert tone="warning" title="Vérifiez votre panier" className="mt-4">
              Certaines quantités ont été ajustées en fonction du stock disponible. Les produits épuisés doivent être retirés.
            </Alert>
          ) : null}
        </Card>

        <aside className="lg:sticky lg:top-40 lg:self-start">
          <Card className="p-4">
            <h2 className="text-base font-bold">Récapitulatif</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-navy-600">Sous-total</dt>
                <dd className="font-semibold">{formatFCFA(summary.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-navy-600">Livraison</dt>
                <dd className="text-navy-500">Calculée à l&apos;étape suivante</dd>
              </div>
              <div className="flex justify-between border-t border-navy-100 pt-2 text-base">
                <dt className="font-bold">Total estimé</dt>
                <dd className="font-extrabold text-navy-950">{formatFCFA(summary.subtotal)}</dd>
              </div>
            </dl>

            <ButtonLink href="/commande" size="lg" className="mt-4 w-full" aria-disabled={summary.hasIssues}>
              Passer la commande
            </ButtonLink>
            <Link href="/catalogue" className="mt-2 block text-center text-sm font-medium text-navy-600 hover:text-accent-700">
              Continuer mes achats
            </Link>

            <ul className="mt-4 space-y-2 border-t border-navy-100 pt-3 text-xs text-navy-600">
              <li className="flex items-start gap-2">
                <Store className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
                Retrait gratuit en boutique à {settings.city}.
              </li>
              <li className="flex items-start gap-2">
                <Truck className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
                Livraison à Daloa et expédition en Côte d&apos;Ivoire après confirmation du paiement.
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
