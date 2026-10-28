'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { mediaAssets } from '@/db/schema';
import { requirePermission } from '@/lib/auth';
import { importCatalogCsv, assignMediaToProduct, type ImportReport } from '@/lib/import';
import { storeImage, UploadError } from '@/lib/storage';
import { indexImage } from '@/lib/visual';
import { audit } from '@/lib/audit';
import { newId } from '@/lib/utils';

export type ImportState = {
  error?: string;
  success?: string;
  report?: ImportReport;
};

/** Import CSV : analyse + écriture, avec rapport ligne par ligne. */
export async function importCsvAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  let actor;
  try {
    actor = await requirePermission('products.write');
  } catch {
    return { error: 'Action non autorisée.' };
  }

  const dryRun = formData.get('dryRun') === '1';
  let csvText = String(formData.get('csvText') ?? '').trim();
  const file = formData.get('csvFile');

  if ((!csvText || csvText.length < 10) && file instanceof File && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) return { error: 'Fichier CSV trop volumineux (5 Mo max).' };
    csvText = (await file.text()).trim();
  }

  if (!csvText) return { error: 'Fournissez un fichier CSV ou collez son contenu.' };

  try {
    const report = await importCatalogCsv(csvText, { dryRun });
    await audit(actor, {
      action: dryRun ? 'catalog.import_preview' : 'catalog.import',
      entity: 'catalog',
      metadata: { created: report.created, updated: report.updated, rejected: report.rejected },
    });
    revalidatePath('/admin/produits');
    revalidatePath('/catalogue');
    return {
      report,
      success: dryRun
        ? 'Analyse terminée : aucune écriture en base (mode vérification).'
        : `Import terminé : ${report.created} créé(s), ${report.updated} mis à jour, ${report.rejected} rejeté(s).`,
    };
  } catch (error) {
    console.error('[import] csv', error);
    return { error: error instanceof Error ? error.message : 'Import impossible.' };
  }
}

/** Téléversement de plusieurs photos dans la file de validation. */
export async function uploadMediaBulkAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  let actor;
  try {
    actor = await requirePermission('products.write');
  } catch {
    return { error: 'Action non autorisée.' };
  }

  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: 'Sélectionnez au moins une photo.' };
  if (files.length > 60) return { error: 'Maximum 60 photos par envoi.' };

  let imported = 0;
  let duplicates = 0;
  const rejected: string[] = [];

  for (const file of files) {
    try {
      const stored = await storeImage({ file, name: file.name, folder: 'medi/import' });

      const existing = await db.execute(sql`SELECT id FROM media_assets WHERE checksum = ${stored.checksum} LIMIT 1`);
      if ((existing.rows as unknown[]).length > 0) {
        duplicates += 1;
        continue;
      }

      await db.insert(mediaAssets).values({
        id: newId('med_'),
        filename: file.name,
        url: stored.url,
        checksum: stored.checksum,
        width: stored.width,
        height: stored.height,
        bytes: stored.bytes,
        status: 'PENDING',
        suggestedSku: file.name.replace(/\.[a-z0-9]+$/i, '').toUpperCase().slice(0, 60),
      });
      imported += 1;
    } catch (error) {
      if (error instanceof UploadError) rejected.push(`${file.name} : ${error.message}`);
      else rejected.push(`${file.name} : erreur inattendue`);
    }
  }

  await audit(actor, {
    action: 'media.bulk_upload',
    entity: 'media_asset',
    metadata: { imported, duplicates, rejected: rejected.length },
  });
  revalidatePath('/admin/import');

  return {
    success: `${imported} photo(s) ajoutée(s)${duplicates > 0 ? ` · ${duplicates} doublon(s) ignoré(s)` : ''}${rejected.length > 0 ? ` · ${rejected.length} refusée(s)` : ''}.`,
    error: rejected.length > 0 ? rejected.slice(0, 5).join(' | ') : undefined,
  };
}

export async function assignMediaAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  let actor;
  try {
    actor = await requirePermission('products.write');
  } catch {
    return { error: 'Action non autorisée.' };
  }

  const mediaId = String(formData.get('mediaId') ?? '');
  const productId = String(formData.get('productId') ?? '');
  if (!mediaId || !productId) return { error: 'Sélectionnez un produit.' };

  try {
    await assignMediaToProduct({ mediaId, productId });
    await audit(actor, { action: 'media.assigned', entity: 'media_asset', entityId: mediaId, metadata: { productId } });
    revalidatePath('/admin/import');
    return { success: 'Photo associée au produit. Pensez à lancer l’indexation visuelle.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Association impossible.' };
  }
}

export async function rejectMediaAction(formData: FormData) {
  const actor = await requirePermission('products.write').catch(() => null);
  if (!actor) redirect('/admin/import');
  const mediaId = String(formData.get('mediaId') ?? '');
  await db.execute(sql`UPDATE media_assets SET status = 'REJECTED' WHERE id = ${mediaId}`);
  await audit(actor, { action: 'media.rejected', entity: 'media_asset', entityId: mediaId });
  redirect('/admin/import');
}

/** Indexation visuelle par lots (embeddings des photos produits). */
export async function reindexVisualAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  let actor;
  try {
    actor = await requirePermission('products.write');
  } catch {
    return { error: 'Action non autorisée.' };
  }

  const batch = Math.min(40, Math.max(1, Number(formData.get('batch') ?? 20) || 20));
  const rows = await db.execute(sql`
    SELECT id, url FROM product_images WHERE embedding IS NULL ORDER BY created_at ASC LIMIT ${batch}
  `);
  const list = rows.rows as { id: string; url: string }[];
  if (list.length === 0) return { success: 'Toutes les photos sont déjà indexées.' };

  let indexed = 0;
  for (const image of list) {
    try {
      const result = await indexImage({ imageId: image.id, url: image.url });
      if (result.ok) indexed += 1;
    } catch (error) {
      console.warn('[visual] indexation impossible', image.id, error);
    }
  }

  const remaining = await db.execute(sql`SELECT count(*)::int AS count FROM product_images WHERE embedding IS NULL`);
  const left = Number((remaining.rows as { count: number }[])[0]?.count ?? 0);

  await audit(actor, { action: 'visual.reindex', entity: 'product_images', metadata: { indexed, left } });
  revalidatePath('/admin/import');
  return { success: `${indexed} photo(s) indexée(s). ${left} restante(s).` };
}
