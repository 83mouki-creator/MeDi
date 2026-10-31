import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Search } from 'lucide-react';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { Card } from '@/components/ui/primitives';
import { Input } from '@/components/ui/form';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Suivre ma commande',
  description: 'Consultez l’état de votre commande MeDi avec votre numéro de commande et le numéro de téléphone utilisé.',
};

/**
 * Vérification d'accès au suivi : numéro de commande + téléphone associé.
 * Le téléphone n'est jamais révélé ; les données d'autres clients restent inaccessibles.
 */
async function trackAction(formData: FormData) {
  'use server';
  const number = String(formData.get('number') ?? '').trim().toUpperCase();
  const phone = String(formData.get('phone') ?? '').replace(/[\s.-]/g, '');

  if (!number || !phone) redirect('/suivi?erreur=champs');

  const rows = await db
    .select({ accessToken: orders.accessToken, number: orders.number })
    .from(orders)
    .where(and(eq(orders.number, number), eq(orders.phone, phone)))
    .limit(1);

  const order = rows[0];
  if (!order) redirect('/suivi?erreur=introuvable');

  redirect(`/suivi/${order.number}?t=${encodeURIComponent(order.accessToken)}`);
}

export default async function TrackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const error = typeof params.erreur === 'string' ? params.erreur : null;

  return (
    <div className="container-page max-w-lg py-10">
      <Card className="p-6">
        <h1 className="text-xl font-extrabold">Suivre ma commande</h1>
        <p className="mt-1 text-sm text-navy-600">
          Saisissez votre numéro de commande (ex. MED-2026-01000) et le numéro de téléphone utilisé lors de la commande.
        </p>

        {error ? (
          <p className="mt-3 rounded-lg bg-rose-50 p-2 text-sm text-rose-800" role="alert">
            {error === 'champs'
              ? 'Renseignez le numéro de commande et votre téléphone.'
              : 'Aucune commande ne correspond à ces informations. Vérifiez vos données ou contactez la boutique.'}
          </p>
        ) : null}

        <form action={trackAction} className="mt-5 space-y-3">
          <div>
            <label htmlFor="number" className="mb-1.5 block text-sm font-medium">Numéro de commande</label>
            <Input id="number" name="number" placeholder="MED-2026-01000" required autoComplete="off" />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">Téléphone</label>
            <Input id="phone" name="phone" type="tel" inputMode="tel" placeholder="0701020304" required autoComplete="tel" />
          </div>
          <Button type="submit" size="lg" className="w-full">
            <Search className="size-4" aria-hidden /> Rechercher ma commande
          </Button>
        </form>

        <p className="mt-4 text-xs leading-relaxed text-navy-500">
          Vous avez gardé le lien reçu à la validation ? Il ouvre directement le suivi sans ressaisie.
          Pour des raisons de confidentialité, aucune information n&apos;est communiquée si le numéro de commande et le téléphone ne
          correspondent pas.
        </p>
      </Card>
    </div>
  );
}
