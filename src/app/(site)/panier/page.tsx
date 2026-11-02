import type { Metadata } from 'next';
import Link from 'next/link';
import { ShoppingBag, Store, Truck } from 'lucide-react';
import { getCartSummary } from '@/lib/cart';
import { getStoreSettings } from '@/lib/settings';
import { CartLineRow } from '@/components/cart-view';
import { Alert, Card, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { formatFCFA } from '@/lib/utils';
import { getSiteI18n } from '@/lib/i18n/site-server';
import { PurchaseNotice } from '@/components/purchase-notice';

export const metadata: Metadata = { title: 'Mon panier', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const [summary, settings, { t }] = await Promise.all([getCartSummary(), getStoreSettings(), getSiteI18n()]);

  if (summary.isEmpty) {
    return (
      <div className="container-page py-10">
        <EmptyState
          icon={<ShoppingBag className="size-10" />}
          title={t('Votre panier est vide')}
          description={t('Parcourez le catalogue et ajoutez les produits dont vous avez besoin. Vous pouvez commander sans créer de compte.')}
          action={<ButtonLink href="/catalogue">{t('Découvrir le catalogue')}</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className="container-page py-6">
      <SectionHeading
        title={t('Mon panier')}
        subtitle={t('{items} article(s) · {refs} référence(s)', { items: summary.itemCount, refs: summary.distinctCount })}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-4">
          <ul>
            {summary.lines.map((line) => (
              <CartLineRow key={line.productId} line={line} />
            ))}
          </ul>

          {summary.hasIssues ? (
            <Alert tone="warning" title={t('Vérifiez votre panier')} className="mt-4">
              {t('Certaines quantités ont été ajustées en fonction du stock disponible. Les produits épuisés doivent être retirés.')}
            </Alert>
          ) : null}
        </Card>

        <aside className="lg:sticky lg:top-40 lg:self-start">
          <Card className="p-4">
            <h2 className="text-base font-bold">{t('Récapitulatif')}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-navy-600">{t('Sous-total')}</dt>
                <dd className="font-semibold">{formatFCFA(summary.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-navy-600">{t('Livraison')}</dt>
                <dd className="text-navy-500">{t('Calculée à l’étape suivante')}</dd>
              </div>
              <div className="flex justify-between border-t border-navy-100 pt-2 text-base">
                <dt className="font-bold">{t('Total estimé')}</dt>
                <dd className="font-extrabold text-navy-950">{formatFCFA(summary.subtotal)}</dd>
              </div>
            </dl>

            <ButtonLink href="/commande" size="lg" className="mt-4 w-full" aria-disabled={summary.hasIssues}>
              {t('Passer la commande')}
            </ButtonLink>
            <Link href="/catalogue" className="mt-2 block text-center text-sm font-medium text-navy-600 hover:text-accent-700">
              {t('Continuer mes achats')}
            </Link>

            <ul className="mt-4 space-y-2 border-t border-navy-100 pt-3 text-xs text-navy-600">
              <li className="flex items-start gap-2">
                <Store className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
                {t('Retrait gratuit en boutique à {city}.', { city: settings.city })}
              </li>
              <li className="flex items-start gap-2">
                <Truck className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
                {t('Livraison à Daloa et expédition en Côte d’Ivoire après confirmation du paiement.')}
              </li>
            </ul>

            <PurchaseNotice variant="short" className="mt-4" />
          </Card>
        </aside>
      </div>
    </div>
  );
}
