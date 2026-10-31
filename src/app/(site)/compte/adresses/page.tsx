import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { MapPin, Trash2 } from 'lucide-react';
import { db } from '@/db';
import { addresses } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { deleteAddressAction } from '@/app/actions/auth';
import { AddressForm } from '@/components/account-forms';
import { Card } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Mes adresses', robots: { index: false, follow: false } };

export default async function AddressesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/connexion');
  const rows = await db.select().from(addresses).where(eq(addresses.userId, user.id));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((address) => (
          <Card key={address.id} className="p-4">
            <p className="flex items-center gap-2 text-sm font-bold">
              <MapPin className="size-4 text-accent-600" aria-hidden /> {address.label ?? 'Adresse'}
            </p>
            <p className="mt-1 text-sm">{address.recipientName} · {address.phone}</p>
            <p className="text-xs text-navy-600">{address.addressLine}, {address.commune ? `${address.commune}, ` : ''}{address.city}</p>
            {address.landmark ? <p className="text-xs text-navy-500">Repère : {address.landmark}</p> : null}
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-accent-700">Modifier</summary>
              <div className="mt-3">
                <AddressForm address={address} />
              </div>
            </details>
            <form action={deleteAddressAction} className="mt-2">
              <input type="hidden" name="id" value={address.id} />
              <button type="submit" className="inline-flex items-center gap-1 text-xs font-medium text-danger-500 hover:underline">
                <Trash2 className="size-3.5" aria-hidden /> Supprimer
              </button>
            </form>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-bold">Ajouter une adresse</h2>
        <AddressForm />
      </Card>
    </div>
  );
}
