import { asc } from 'drizzle-orm';
import { requirePagePermission } from '@/lib/auth';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import { db } from '@/db';
import { deliveryZones } from '@/db/schema';
import { saveZoneAction, deleteZoneAction } from '@/app/actions/admin-settings';
import { formatFCFA, toFcfa } from '@/lib/utils';
import { Badge, Card } from '@/components/ui/primitives';
import { Field, Input, Select } from '@/components/ui/form';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function DeliveryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePagePermission('delivery.manage');
  const { t } = await getAdminI18n();
  const params = await searchParams;
  const zones = await db.select().from(deliveryZones).orderBy(asc(deliveryZones.sortOrder), asc(deliveryZones.name));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">{t('Les livraisons')}</h1>
        <p className="text-sm text-navy-600">
          {t('Vous fixez ici le prix de la livraison pour chaque ville et chaque commune. Ce sont ces prix que le client voit quand il commande. Remplacez les tarifs marqués « DÉMO » par les vôtres.')}
        </p>
      </header>

      {params.erreur ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{t('Enregistrement refusé : vérifiez les champs.')}</p>
      ) : null}

      <div className="space-y-3">
        {zones.map((zone) => (
          <Card key={zone.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{zone.name}</p>
                <p className="text-xs text-navy-500">
                  {zone.city} · {zone.isLocal ? 'zone locale Daloa' : 'hors Daloa (prépaiement obligatoire)'}
                  {zone.isPickup ? ' · retrait' : ''} · frais {formatFCFA(toFcfa(zone.fee))}
                  {zone.freeAbove ? ` · gratuit dès ${formatFCFA(toFcfa(zone.freeAbove))}` : ''}
                  {zone.estimatedDelay ? ` · ${zone.estimatedDelay}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={zone.isActive ? 'success' : 'neutral'}>{zone.isActive ? 'Active' : 'Désactivée'}</Badge>
                {zone.isActive ? (
                  <form action={deleteZoneAction}>
                    <input type="hidden" name="id" value={zone.id} />
                    <Button type="submit" size="sm" variant="ghost">{t('Désactiver')}</Button>
                  </form>
                ) : null}
              </div>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-accent-700">{t('Modifier')}</summary>
              <form action={saveZoneAction} className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <input type="hidden" name="id" value={zone.id} />
                <Field label={t('Nom')} htmlFor={`name-${zone.id}`}>
                  <Input id={`name-${zone.id}`} name="name" defaultValue={zone.name} />
                </Field>
                <Field label={t('Ville')} htmlFor={`city-${zone.id}`}>
                  <Input id={`city-${zone.id}`} name="city" defaultValue={zone.city} />
                </Field>
                <Field label={t('Frais (FCFA)')} htmlFor={`fee-${zone.id}`}>
                  <Input id={`fee-${zone.id}`} name="fee" type="number" min={0} step={100} defaultValue={toFcfa(zone.fee)} />
                </Field>
                <Field label={t('Gratuit dès (FCFA)')} htmlFor={`free-${zone.id}`}>
                  <Input id={`free-${zone.id}`} name="freeAbove" type="number" min={0} step={500} defaultValue={zone.freeAbove ? toFcfa(zone.freeAbove) : ''} />
                </Field>
                <Field label={t('Délai indicatif')} htmlFor={`delay-${zone.id}`}>
                  <Input id={`delay-${zone.id}`} name="estimatedDelay" defaultValue={zone.estimatedDelay ?? ''} />
                </Field>
                <Field label={t('Ordre d’affichage')} htmlFor={`order-${zone.id}`}>
                  <Input id={`order-${zone.id}`} name="sortOrder" type="number" defaultValue={zone.sortOrder} />
                </Field>
                <div className="flex flex-col gap-1 text-xs sm:col-span-2">
                  <label className="flex items-center gap-2"><input type="checkbox" name="isLocal" defaultChecked={zone.isLocal} className="size-4 accent-accent-500" /> {t('Zone locale Daloa')}</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="isPickup" defaultChecked={zone.isPickup} className="size-4 accent-accent-500" /> {t('Retrait en boutique')}</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={zone.isActive} className="size-4 accent-accent-500" /> {t('Active')}</label>
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <Button type="submit" size="sm">{t('Enregistrer')}</Button>
                </div>
              </form>
            </details>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-bold">{t('Ajouter une zone')}</h2>
        <form action={saveZoneAction} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t('Nom')} htmlFor="new-zone-name" required>
            <Input id="new-zone-name" name="name" required placeholder={t('Ex. Daloa — quartier Tazibouo')} />
          </Field>
          <Field label={t('Ville')} htmlFor="new-zone-city" required>
            <Input id="new-zone-city" name="city" required placeholder={t('Daloa')} />
          </Field>
          <Field label={t('Frais (FCFA)')} htmlFor="new-zone-fee" required>
            <Input id="new-zone-fee" name="fee" type="number" min={0} step={100} required defaultValue={0} />
          </Field>
          <Field label={t('Gratuit dès (FCFA)')} htmlFor="new-zone-free">
            <Input id="new-zone-free" name="freeAbove" type="number" min={0} step={500} />
          </Field>
          <Field label={t('Délai indicatif')} htmlFor="new-zone-delay">
            <Input id="new-zone-delay" name="estimatedDelay" placeholder={t('Sous 24 h')} />
          </Field>
          <Field label={t('Type')} htmlFor="new-zone-type">
            <Select id="new-zone-type" name="sortOrder" defaultValue="10">
              <option value="10">{t('Livraison')}</option>
            </Select>
          </Field>
          <div className="flex flex-col gap-1 text-xs sm:col-span-2">
            <label className="flex items-center gap-2"><input type="checkbox" name="isLocal" className="size-4 accent-accent-500" /> {t('Zone locale Daloa')}</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="isPickup" className="size-4 accent-accent-500" /> {t('Retrait en boutique')}</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked className="size-4 accent-accent-500" /> {t('Active')}</label>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit">{t('Créer la zone')}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
