import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { deliveryZones } from '@/db/schema';
import { getCartSummary } from '@/lib/cart';
import { getStoreSettings } from '@/lib/settings';
import { getCurrentUser } from '@/lib/auth';
import { CheckoutForm } from '@/components/checkout-form';
import { toFcfa } from '@/lib/utils';

export const metadata: Metadata = { title: 'Commande', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const [cart, settings, user, zones] = await Promise.all([
    getCartSummary(),
    getStoreSettings(),
    getCurrentUser(),
    db.select().from(deliveryZones).where(eq(deliveryZones.isActive, true)).orderBy(asc(deliveryZones.sortOrder)),
  ]);

  if (cart.isEmpty) redirect('/panier');

  return (
    <div className="container-page py-6">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Finaliser ma commande</h1>
      <p className="mb-6 text-sm text-navy-600">
        {cart.itemCount} article(s) · {cart.lines.length} référence(s). Les prix, frais et disponibilités sont vérifiés définitivement au moment de la validation.
      </p>

      <CheckoutForm
        items={cart.lines.map((line) => ({ productId: line.productId, quantity: line.quantity }))}
        subtotal={cart.subtotal}
        zones={zones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          city: zone.city,
          isLocal: zone.isLocal,
          isPickup: zone.isPickup,
          fee: toFcfa(zone.fee),
          freeAbove: zone.freeAbove === null ? null : toFcfa(zone.freeAbove),
          estimatedDelay: zone.estimatedDelay,
        }))}
        user={user ? { firstName: user.firstName, lastName: user.lastName, phone: user.phone, email: user.email } : null}
        settings={{
          allowCod: settings.allowCod,
          codMaxAmount: settings.codMaxAmount,
          allowPickup: settings.allowPickup,
          allowLocalDelivery: settings.allowLocalDelivery,
          city: settings.city,
        }}
      />
    </div>
  );
}
