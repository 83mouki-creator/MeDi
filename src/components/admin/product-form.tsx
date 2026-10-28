'use client';

import { useActionState, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { saveProductAction, type AdminState } from '@/app/actions/admin-products';
import { Button } from '../ui/button';
import { Field, Input, Select, Textarea } from '../ui/form';
import { Alert, Card } from '../ui/primitives';

type Option = { id: string; name: string };

const initial: AdminState = {};

export function ProductForm({
  product,
  categories,
  brands,
  suppliers,
  attributes,
}: {
  product?: {
    id: string;
    sku: string;
    slug: string;
    name: string;
    shortDescription: string | null;
    description: string | null;
    price: string;
    promoPrice: string | null;
    promoStartsAt: string | null;
    promoEndsAt: string | null;
    stock: number;
    lowStockThreshold: number | null;
    allowPreorder: boolean;
    isActive: boolean;
    isFeatured: boolean;
    categoryId: string | null;
    brandId: string | null;
    supplierId: string | null;
    warranty: string | null;
    keywords: string[];
  };
  categories: Option[];
  brands: Option[];
  suppliers: Option[];
  attributes: { name: string; value: string }[];
}) {
  const [state, formAction, pending] = useActionState(saveProductAction, initial);
  const [rows, setRows] = useState(attributes.length > 0 ? attributes : [{ name: '', value: '' }]);

  return (
    <form action={formAction} className="space-y-4" encType="multipart/form-data">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-bold">Informations principales</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom du produit" htmlFor="name" required error={state.fieldErrors?.name} className="sm:col-span-2">
            <Input id="name" name="name" defaultValue={product?.name ?? ''} required maxLength={160} />
          </Field>
          <Field label="Référence (SKU)" htmlFor="sku" required error={state.fieldErrors?.sku}>
            <Input id="sku" name="sku" defaultValue={product?.sku ?? ''} required maxLength={60} placeholder="MED-0001" />
          </Field>
          <Field label="Slug URL (facultatif)" htmlFor="slug" error={state.fieldErrors?.slug} hint="Généré automatiquement si vide.">
            <Input id="slug" name="slug" defaultValue={product?.slug ?? ''} maxLength={80} />
          </Field>
          <Field label="Catégorie" htmlFor="categoryId">
            <Select id="categoryId" name="categoryId" defaultValue={product?.categoryId ?? ''}>
              <option value="">—</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Marque" htmlFor="brandId">
            <Select id="brandId" name="brandId" defaultValue={product?.brandId ?? ''}>
              <option value="">—</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Fournisseur" htmlFor="supplierId">
            <Select id="supplierId" name="supplierId" defaultValue={product?.supplierId ?? ''}>
              <option value="">—</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Garantie" htmlFor="warranty">
            <Input id="warranty" name="warranty" defaultValue={product?.warranty ?? ''} maxLength={120} placeholder="12 mois" />
          </Field>
          <Field label="Description courte" htmlFor="shortDescription" className="sm:col-span-2">
            <Textarea id="shortDescription" name="shortDescription" rows={2} maxLength={300} defaultValue={product?.shortDescription ?? ''} />
          </Field>
          <Field label="Description commerciale" htmlFor="description" className="sm:col-span-2">
            <Textarea id="description" name="description" rows={5} maxLength={8000} defaultValue={product?.description ?? ''} />
          </Field>
          <Field label="Mots-clés de recherche" htmlFor="keywords" className="sm:col-span-2" hint="Séparés par des virgules (ex. perceuse, perforateur, chantier).">
            <Input id="keywords" name="keywords" defaultValue={(product?.keywords ?? []).join(', ')} maxLength={500} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-bold">Prix et stock</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Prix (FCFA)" htmlFor="price" required error={state.fieldErrors?.price}>
            <Input id="price" name="price" type="number" min={1} step={1} defaultValue={product?.price ?? ''} required />
          </Field>
          <Field label="Prix promo (FCFA)" htmlFor="promoPrice" error={state.fieldErrors?.promoPrice}>
            <Input id="promoPrice" name="promoPrice" type="number" min={0} step={1} defaultValue={product?.promoPrice ?? ''} />
          </Field>
          <Field label="Début promo" htmlFor="promoStartsAt">
            <Input id="promoStartsAt" name="promoStartsAt" type="datetime-local" defaultValue={product?.promoStartsAt ?? ''} />
          </Field>
          <Field label="Fin promo" htmlFor="promoEndsAt">
            <Input id="promoEndsAt" name="promoEndsAt" type="datetime-local" defaultValue={product?.promoEndsAt ?? ''} />
          </Field>
          <Field label="Stock physique" htmlFor="stock" required error={state.fieldErrors?.stock} hint="Toute variation est journalisée.">
            <Input id="stock" name="stock" type="number" min={0} step={1} defaultValue={product?.stock ?? 0} required />
          </Field>
          <Field label="Seuil stock faible" htmlFor="lowStockThreshold">
            <Input id="lowStockThreshold" name="lowStockThreshold" type="number" min={0} step={1} defaultValue={product?.lowStockThreshold ?? ''} placeholder="5" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isActive" defaultChecked={product?.isActive ?? true} className="size-4 accent-accent-500" />
            Visible dans la boutique
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isFeatured" defaultChecked={product?.isFeatured ?? false} className="size-4 accent-accent-500" />
            Mise en avant
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="allowPreorder" defaultChecked={product?.allowPreorder ?? false} className="size-4 accent-accent-500" />
            Autoriser la précommande hors stock
          </label>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-bold">Caractéristiques techniques</h2>
        {rows.map((row, index) => (
          <div key={index} className="flex gap-2">
            <Input
              name="attributeName"
              defaultValue={row.name}
              placeholder="Ex. Puissance"
              aria-label={`Nom de la caractéristique ${index + 1}`}
              maxLength={80}
            />
            <Input
              name="attributeValue"
              defaultValue={row.value}
              placeholder="Ex. 850 W"
              aria-label={`Valeur de la caractéristique ${index + 1}`}
              maxLength={200}
            />
            <button
              type="button"
              onClick={() => setRows((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current))}
              className="grid size-11 shrink-0 place-items-center rounded-lg border border-navy-200 text-navy-500 hover:bg-rose-50 hover:text-danger-500"
              aria-label="Supprimer cette caractéristique"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setRows((current) => [...current, { name: '', value: '' }])}>
          <Plus className="size-4" aria-hidden /> Ajouter une caractéristique
        </Button>
      </Card>

      {!product ? (
        <Card className="space-y-2 p-4">
          <h2 className="text-sm font-bold">Photos</h2>
          <p className="text-xs text-navy-500">
            Formats acceptés : JPEG, PNG, WebP, AVIF — 5 Mo max par image, minimum 200 × 200 px. Les images sont redimensionnées
            et converties en WebP ; elles ne sont jamais stockées en base de données.
          </p>
          <input type="file" name="images" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="block w-full text-sm" />
        </Card>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={pending}>
          {product ? 'Enregistrer les modifications' : 'Créer le produit'}
        </Button>
      </div>
    </form>
  );
}
