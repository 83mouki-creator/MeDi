import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, brands } from '@/db/schema';
import { saveCategoryAction, saveBrandAction } from '@/app/actions/admin-products';
import { Card } from '@/components/ui/primitives';
import { Field, Input, Select } from '@/components/ui/form';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const [categoryRows, brandRows] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        parentId: categories.parentId,
        position: categories.position,
        productCount: sql<number>`(SELECT count(*)::int FROM products p WHERE p.category_id = ${categories.id})`,
      })
      .from(categories)
      .orderBy(asc(categories.position), asc(categories.name)),
    db
      .select({
        id: brands.id,
        name: brands.name,
        slug: brands.slug,
        productCount: sql<number>`(SELECT count(*)::int FROM products p WHERE p.brand_id = ${brands.id})`,
      })
      .from(brands)
      .orderBy(asc(brands.name)),
  ]);

  const roots = categoryRows.filter((c) => !c.parentId);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">Catégories et marques</h1>
        <p className="text-sm text-navy-600">Les catégories structurent la navigation et les pages indexables du catalogue.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-bold">Nouvelle catégorie</h2>
          <form action={saveCategoryAction} className="space-y-3">
            <Field label="Nom" htmlFor="new-cat-name" required>
              <Input id="new-cat-name" name="name" required maxLength={80} placeholder="Ex. Peinture et finitions" />
            </Field>
            <Field label="Catégorie parente (facultatif)" htmlFor="new-cat-parent">
              <Select id="new-cat-parent" name="parentId" defaultValue="">
                <option value="">Aucune (catégorie racine)</option>
                {roots.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Description (SEO)" htmlFor="new-cat-desc">
              <Input id="new-cat-desc" name="description" maxLength={300} />
            </Field>
            <Button type="submit">Créer la catégorie</Button>
          </form>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-bold">Nouvelle marque</h2>
          <form action={saveBrandAction} className="space-y-3">
            <Field label="Nom de la marque" htmlFor="new-brand-name" required>
              <Input id="new-brand-name" name="name" required maxLength={80} placeholder="Ex. Nasco" />
            </Field>
            <Button type="submit">Créer la marque</Button>
          </form>
          <p className="mt-3 text-xs text-navy-500">
            Les marques et fournisseurs affichés doivent correspondre à des références réellement distribuées par la boutique.
          </p>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <h2 className="border-b border-navy-100 bg-navy-50 px-4 py-2.5 text-sm font-bold">Catégories ({categoryRows.length})</h2>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-navy-500">
            <tr>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Parente</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2 text-right">Produits</th>
              <th className="px-3 py-2">Renommer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {categoryRows.map((category) => (
              <tr key={category.id}>
                <td className="px-3 py-2 font-medium">{category.name}</td>
                <td className="px-3 py-2 text-xs text-navy-500">
                  {categoryRows.find((c) => c.id === category.parentId)?.name ?? '—'}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-navy-500">{category.slug}</td>
                <td className="px-3 py-2 text-right">{category.productCount}</td>
                <td className="px-3 py-2">
                  <form action={saveCategoryAction} className="flex gap-1">
                    <input type="hidden" name="id" value={category.id} />
                    <input type="hidden" name="parentId" value={category.parentId ?? ''} />
                    <Input name="name" defaultValue={category.name} className="h-9 max-w-40" aria-label={`Renommer ${category.name}`} />
                    <Button type="submit" size="sm" variant="outline">OK</Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-x-auto">
        <h2 className="border-b border-navy-100 bg-navy-50 px-4 py-2.5 text-sm font-bold">Marques ({brandRows.length})</h2>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-navy-500">
            <tr>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2 text-right">Produits</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {brandRows.map((brand) => (
              <tr key={brand.id}>
                <td className="px-3 py-2 font-medium">{brand.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-navy-500">{brand.slug}</td>
                <td className="px-3 py-2 text-right">{brand.productCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
