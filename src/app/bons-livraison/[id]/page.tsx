import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser, isStaff, can } from '@/lib/auth';
import { getDeliveryNote } from '@/lib/delivery-notes';
import { getStoreSettings } from '@/lib/settings';
import { storeLocation } from '@/lib/store-location';
import { formatFCFA, toFcfa } from '@/lib/utils';
import { FINAL_SALE_NOTICE } from '@/lib/store-policy';
import { PrintButton } from '@/components/print-button';

export const metadata: Metadata = { title: 'Bon de livraison — MeDi', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const PAYMENT_LABELS: Record<string, string> = {
  WAVE: 'Wave',
  CASH_ON_DELIVERY: 'Espèces à la livraison',
  CASH_IN_STORE: 'Espèces en boutique',
};

const STATUS_LABELS: Record<string, string> = {
  PAYMENT_CONFIRMED: 'Payée',
  PREPARING: 'En préparation',
  READY_TO_SHIP: 'Prête à partir',
  SHIPPED: 'En route',
  OUT_FOR_DELIVERY: 'En cours de livraison',
  DELIVERED: 'Livrée',
};

/**
 * Bon de livraison imprimable.
 *
 * Mise en page volontairement étroite (une colonne, texte large) : elle sort
 * proprement sur une imprimante de comptoir 80 mm comme sur une A5. Aucun menu,
 * aucun bouton à l'impression : seulement ce que le livreur doit savoir.
 */
export default async function DeliveryNotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/connexion?redirectTo=/admin/bons');
  if (!isStaff(user.role) || !can(user.role, 'delivery.manage')) redirect('/admin');

  const { id } = await params;
  const [note, settings] = await Promise.all([getDeliveryNote(id), getStoreSettings()]);
  if (!note) notFound();

  const location = storeLocation(settings);
  const { order, items } = note;
  const articles = items.reduce((sum, item) => sum + toFcfa(item.lineTotal), 0);

  return (
    <div className="min-h-dvh bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto w-[80mm] max-w-full rounded-lg bg-white p-4 text-[12px] leading-snug text-navy-950 shadow-sm print:w-[80mm] print:rounded-none print:p-2 print:shadow-none">
        <div className="print-actions mb-3 flex justify-end print:hidden">
          <PrintButton />
        </div>

        <header className="border-b border-dashed border-navy-300 pb-2 text-center">
          <p className="text-base font-extrabold tracking-tight">MeDi</p>
          <p className="text-[11px]">{location.city} — {settings.country}</p>
          <p className="mt-1 font-bold uppercase tracking-wide">Bon de livraison</p>
          <p className="font-mono text-[12px]">{order.number}</p>
        </header>

        <section className="mt-2 space-y-0.5 text-[11px]">
          <p>
            <strong>Date :</strong> {order.createdAt.toLocaleDateString('fr-FR')} {order.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p>
            <strong>Client :</strong> {order.customerName}
          </p>
          <p>
            <strong>Téléphone :</strong> {order.phone}
          </p>
          <p>
            <strong>{order.deliveryMethod === 'CARRIER' ? 'Ville' : 'Quartier'} :</strong> {order.neighbourhood ?? order.city}
          </p>
          {order.deliveryMethod === 'CARRIER' ? <p className="font-semibold">Livraison hors Daloa — 7 jours maximum</p> : null}
          <p>
            <strong>Paiement :</strong> {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod} (
            {order.paymentStatus === 'PAID' ? 'payé' : 'à encaisser'})
          </p>
          <p>
            <strong>État :</strong> {STATUS_LABELS[order.status] ?? order.status}
          </p>
        </section>

        <table className="mt-2 w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-y border-navy-300">
              <th className="py-1 text-start">Produit</th>
              <th className="py-1 text-center">Qté</th>
              <th className="py-1 text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.sku}-${index}`} className="border-b border-dashed border-navy-200 align-top">
                <td className="py-1 pe-1">
                  <span className="font-semibold">{item.name}</span>
                  <br />
                  <span className="text-[10px] text-navy-600">{item.sku}</span>
                </td>
                <td className="py-1 text-center font-bold">{item.quantity}</td>
                <td className="py-1 text-end">{formatFCFA(toFcfa(item.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-2 space-y-0.5 border-t border-navy-300 pt-2 text-[11px]">
          <p className="flex justify-between">
            <span>Articles</span>
            <span>{formatFCFA(articles)}</span>
          </p>
          <p className="flex justify-between">
            <span>Transport</span>
            <span>{order.deliveryMethod === 'CARRIER' ? 'à convenir' : formatFCFA(toFcfa(order.shippingFee))}</span>
          </p>
          <p className="flex justify-between border-t border-navy-300 pt-1 text-[13px] font-extrabold">
            <span>Total</span>
            <span>{formatFCFA(toFcfa(order.total))}</span>
          </p>
        </section>

        <p className="mt-3 border-t border-dashed border-navy-300 pt-2 text-[10px] leading-snug">
          {FINAL_SALE_NOTICE}
        </p>

        <section className="mt-3 text-[10px]">
          <p className="font-semibold">Boutique (adresse exacte) :</p>
          <p>{location.dms}</p>
          {(settings.whatsapp ?? settings.phone) ? <p>WhatsApp : {settings.whatsapp ?? settings.phone}</p> : null}
        </section>

        <div className="mt-6 flex justify-between gap-4 text-[10px]">
          <span className="border-t border-navy-400 pt-1">Signature livreur</span>
          <span className="border-t border-navy-400 pt-1">Signature client</span>
        </div>

        <p className="mt-3 text-center text-[9px] text-navy-500">Merci de votre confiance — MeDi</p>
      </div>
    </div>
  );
}
