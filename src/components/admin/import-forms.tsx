'use client';

import { useActionState } from 'react';
import { FileSpreadsheet, Images, ScanSearch, Upload } from 'lucide-react';
import {
  importCsvAction,
  uploadMediaBulkAction,
  assignMediaAction,
  reindexVisualAction,
  type ImportState,
} from '@/app/actions/admin-import';
import { Button } from '../ui/button';
import { Field, Select, Textarea } from '../ui/form';
import { Alert, Card } from '../ui/primitives';

const initial: ImportState = {};

export function CsvImportForm() {
  const [state, formAction, pending] = useActionState(importCsvAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field label="Fichier CSV" htmlFor="csvFile" hint="Colonnes obligatoires : sku, nom, prix, stock.">
        <input id="csvFile" type="file" name="csvFile" accept=".csv,text/csv" className="block w-full text-sm" />
      </Field>

      <Field label="…ou collez le contenu CSV" htmlFor="csvText">
        <Textarea id="csvText" name="csvText" rows={5} placeholder={'sku,nom,prix,stock,categorie,marque\nMED-0100,Perceuse 500W,45000,10,Outillage industriel,Bosch'} />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="dryRun" value="1" variant="outline" loading={pending}>
          <ScanSearch className="size-4" aria-hidden /> Vérifier sans importer
        </Button>
        <Button type="submit" name="dryRun" value="0" loading={pending}>
          <FileSpreadsheet className="size-4" aria-hidden /> Importer le catalogue
        </Button>
      </div>

      {state.report ? (
        <div className="rounded-lg border border-navy-100">
          <div className="flex flex-wrap gap-3 border-b border-navy-100 bg-navy-50 px-3 py-2 text-xs font-semibold">
            <span>{state.report.created} créé(s)</span>
            <span>{state.report.updated} mis à jour</span>
            <span className="text-rose-700">{state.report.rejected} rejeté(s)</span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-navy-500">
                <tr>
                  <th className="px-3 py-1.5">Ligne</th>
                  <th className="px-3 py-1.5">SKU</th>
                  <th className="px-3 py-1.5">Nom</th>
                  <th className="px-3 py-1.5">Résultat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {state.report.rows.slice(0, 200).map((row) => (
                  <tr key={`${row.line}-${row.sku}`}>
                    <td className="px-3 py-1.5">{row.line}</td>
                    <td className="px-3 py-1.5 font-mono">{row.sku || '—'}</td>
                    <td className="max-w-56 truncate px-3 py-1.5">{row.name || '—'}</td>
                    <td className={`px-3 py-1.5 ${row.status === 'rejected' ? 'text-rose-700' : row.status === 'updated' ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {row.status === 'rejected' ? row.reason : row.status === 'updated' ? 'Mis à jour' : 'Créé'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </form>
  );
}

export function MediaUploadForm() {
  const [state, formAction, pending] = useActionState(uploadMediaBulkAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert tone="warning">{state.error}</Alert> : null}
      <input
        type="file"
        name="photos"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        required
        className="block w-full text-sm"
      />
      <p className="text-xs text-navy-500">
        60 photos max par envoi, 5 Mo par image. Les doublons sont détectés par empreinte SHA-256. Aucun prix ni stock n’est déduit
        d’une photo : l’affectation à une fiche produit est manuelle.
      </p>
      <Button type="submit" loading={pending}>
        <Upload className="size-4" aria-hidden /> Téléverser dans la file
      </Button>
    </form>
  );
}

export function AssignMediaForm({
  mediaId,
  products,
}: {
  mediaId: string;
  products: { id: string; name: string; sku: string }[];
}) {
  const [state, formAction, pending] = useActionState(assignMediaAction, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="mediaId" value={mediaId} />
      <Select name="productId" required className="h-9 max-w-56 text-xs" aria-label="Produit à associer">
        <option value="">Choisir un produit…</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>{product.sku} — {product.name}</option>
        ))}
      </Select>
      <Button type="submit" size="sm" variant="outline" loading={pending}>Associer</Button>
      {state.error ? <span className="text-xs text-rose-700">{state.error}</span> : null}
    </form>
  );
}

export function ReindexVisualForm({ remaining }: { remaining: number }) {
  const [state, formAction, pending] = useActionState(reindexVisualAction, initial);

  return (
    <form action={formAction} className="space-y-2">
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <input type="hidden" name="batch" value={20} />
      <p className="text-xs text-navy-500">{remaining} photo(s) sans vecteur visuel.</p>
      <Button type="submit" variant="outline" loading={pending} disabled={remaining === 0}>
        <Images className="size-4" aria-hidden /> Indexer 20 photos
      </Button>
    </form>
  );
}

export function ImportHelp() {
  return (
    <Card className="p-4 text-xs leading-relaxed text-navy-600">
      <h2 className="mb-1 text-sm font-bold text-navy-900">Format CSV attendu</h2>
      <pre className="mt-2 overflow-x-auto rounded bg-navy-950 p-3 text-[11px] text-navy-100">{`sku,nom,prix,stock,categorie,marque,description_courte,prix_promo,mots_cles
MED-0100,Perceuse à percussion 850 W,78500,12,Outillage industriel,Bosch,Perceuse 850 W,69900,perceuse|chantier
MED-0101,Ciment CPJ 35 50 kg,5200,400,Matériaux de base,Dangote,Sac de 50 kg,,ciment|beton`}</pre>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        <li>Encodage UTF-8, séparateur virgule ou point-virgule, guillemets acceptés.</li>
        <li>Un SKU existant est mis à jour ; un SKU nouveau crée la fiche.</li>
        <li>Les lignes sans prix positif ou sans stock valide sont rejetées et listées.</li>
        <li>Les catégories et marques inconnues sont créées automatiquement.</li>
      </ul>
    </Card>
  );
}
