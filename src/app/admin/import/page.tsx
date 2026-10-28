import Image from 'next/image';
import { asc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { products } from '@/db/schema';
import { CsvImportForm, MediaUploadForm, AssignMediaForm, ReindexVisualForm, ImportHelp } from '@/components/admin/import-forms';
import { rejectMediaAction } from '@/app/actions/admin-import';
import { providerInfo, visualThresholds } from '@/lib/visual';
import { storageInfo } from '@/lib/storage';
import { Badge, Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const [productRows, mediaRows, embeddingStats] = await Promise.all([
    db.select({ id: products.id, name: products.name, sku: products.sku }).from(products).orderBy(asc(products.name)).limit(500),
    db.execute(sql`
      SELECT id, filename, url, status, suggested_sku, width, height, created_at
      FROM media_assets ORDER BY created_at DESC LIMIT 60
    `),
    db.execute(sql`
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE embedding IS NOT NULL)::int AS indexed
      FROM product_images
    `),
  ]);

  const media = mediaRows.rows as Record<string, unknown>[];
  const stats = (embeddingStats.rows as { total: number; indexed: number }[])[0] ?? { total: 0, indexed: 0 };
  const provider = providerInfo();
  const storage = storageInfo();
  const thresholds = visualThresholds();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">Import catalogue & photos</h1>
        <p className="text-sm text-navy-600">
          Flux prévu pour les 200+ photos du propriétaire : téléversement en masse, dédoublonnage, affectation manuelle à une fiche
          produit, puis indexation visuelle.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-bold">1. Importer le catalogue (CSV)</h2>
          <CsvImportForm />
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <h2 className="text-sm font-bold">2. Téléverser les photos</h2>
            <MediaUploadForm />
          </Card>

          <Card className="space-y-2 p-4">
            <h2 className="text-sm font-bold">3. Indexation visuelle</h2>
            <p className="text-xs text-navy-600">
              Fournisseur : <strong>{provider.label}</strong> · {stats.indexed}/{stats.total} photo(s) indexée(s).
            </p>
            <p className="text-xs text-navy-500">{provider.note}</p>
            <p className="text-xs text-navy-500">
              Seuil de correspondance probable : {Math.round(thresholds.confident * 100)} %. En dessous, les résultats sont
              présentés comme des alternatives, jamais comme une correspondance certaine.
            </p>
            <ReindexVisualForm remaining={Math.max(0, stats.total - stats.indexed)} />
          </Card>

          <Card className="space-y-1 p-4">
            <h2 className="text-sm font-bold">Stockage des images</h2>
            <p className="text-xs text-navy-600">Driver : <strong>{storage.driver}</strong> · {storage.configured ? 'configuré' : 'non configuré'}</p>
            <p className="text-xs text-navy-500">{storage.note}</p>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <h2 className="border-b border-navy-100 bg-navy-50 px-4 py-2.5 text-sm font-bold">
          File de validation des photos ({media.length})
        </h2>
        {media.length === 0 ? (
          <p className="px-4 py-6 text-sm text-navy-500">
            Aucune photo en attente. Téléversez les photos du propriétaire : elles apparaîtront ici pour affectation manuelle.
          </p>
        ) : (
          <ul className="divide-y divide-navy-100">
            {media.map((item) => (
              <li key={String(item.id)} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-navy-100">
                  <Image src={String(item.url)} alt="" width={128} height={128} className="size-full object-cover" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{String(item.filename)}</p>
                  <p className="text-xs text-navy-500">
                    {item.width ? `${item.width} × ${item.height} px · ` : ''}
                    {String(item.status)}
                    {item.suggested_sku ? ` · nom de fichier : ${String(item.suggested_sku)}` : ''}
                  </p>
                  {item.status === 'PENDING' ? (
                    <div className="mt-1.5">
                      <AssignMediaForm mediaId={String(item.id)} products={productRows} />
                    </div>
                  ) : (
                    <Badge tone={item.status === 'ASSIGNED' ? 'success' : 'neutral'}>{String(item.status)}</Badge>
                  )}
                </div>
                {item.status === 'PENDING' ? (
                  <form action={rejectMediaAction}>
                    <input type="hidden" name="mediaId" value={String(item.id)} />
                    <Button type="submit" size="sm" variant="ghost">Rejeter</Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ImportHelp />
    </div>
  );
}
