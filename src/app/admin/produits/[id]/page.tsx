import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { asc, desc, eq } from 'drizzle-orm';
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react';
import { db } from '@/db';
import { products, productImages, productAttributes, categories, brands, suppliers, inventoryMovements } from '@/db/schema';
import { ProductForm } from '@/components/admin/product-form';
import { StockAdjustForm } from '@/components/admin/stock-adjust';
import { uploadProductImagesAction, deleteProductImageAction, archiveProductAction } from '@/app/actions/admin-products';
import { Badge, Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatFCFA } from '@/lib/utils';
import { computePricing, computeAvailability } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  const product = rows[0];
  if (!product) notFound();

  const [images, attributes, categoryRows, brandRows, supplierRows, movements] = await Promise.all([
    db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.position)),
    db.select().from(productAttributes).where(eq(productAttributes.productId, id)).orderBy(asc(productAttributes.position)),
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.position)),
    db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name)),
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).orderBy(asc(suppliers.name)),
    db.select().from(inventoryMovements).where(eq(inventoryMovements.productId, id)).orderBy(desc(inventoryMovements.createdAt)).limit(15),
  ]);

  const pricing = computePricing(product);
  const availability = computeAvailability(product, 5);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/admin/produits" className="inline-flex items-center gap-1 text-xs font-medium text-navy-500 hover:text-accent-700">
            <ArrowLeft className="size-3.5" aria-hidden /> Produits
          </Link>
          <h1 className="text-xl font-extrabold tracking-tight">{product.name}</h1>
          <p className="text-xs text-navy-500">
            Réf. <span className="font-mono">{product.sku}</span> · prix affiché {formatFCFA(pricing.price)}
            {pricing.onPromo ? ` (promo -${pricing.discountPercent}%)` : ''} · {availability.label}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={product.isArchived ? 'neutral' : product.isActive ? 'success' : 'warning'}>
            {product.isArchived ? 'Archivé' : product.isActive ? 'En ligne' : 'Masqué'}
          </Badge>
          <Link href={`/produit/${product.slug}`} target="_blank" className="inline-flex items-center gap-1 rounded-lg border border-navy-200 px-3 py-1.5 text-xs font-semibold hover:bg-navy-50">
            <ExternalLink className="size-3.5" aria-hidden /> Voir la fiche
          </Link>
        </div>
      </div>

      {query.cree === '1' ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Produit créé. Ajoutez maintenant les photos et complétez les caractéristiques.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <ProductForm
            product={{
              id: product.id,
              sku: product.sku,
              slug: product.slug,
              name: product.name,
              shortDescription: product.shortDescription,
              description: product.description,
              price: product.price,
              promoPrice: product.promoPrice,
              promoStartsAt: product.promoStartsAt ? product.promoStartsAt.toISOString().slice(0, 16) : null,
              promoEndsAt: product.promoEndsAt ? product.promoEndsAt.toISOString().slice(0, 16) : null,
              stock: product.stock,
              lowStockThreshold: product.lowStockThreshold,
              allowPreorder: product.allowPreorder,
              isActive: product.isActive,
              isFeatured: product.isFeatured,
              categoryId: product.categoryId,
              brandId: product.brandId,
              supplierId: product.supplierId,
              warranty: product.warranty,
              keywords: product.keywords,
            }}
            categories={categoryRows}
            brands={brandRows}
            suppliers={supplierRows}
            attributes={attributes.map((a) => ({ name: a.name, value: a.value }))}
          />

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-bold">Mouvements de stock récents</h2>
            {movements.length === 0 ? (
              <p className="text-sm text-navy-500">Aucun mouvement enregistré.</p>
            ) : (
              <table className="w-full min-w-[460px] text-xs">
                <thead className="text-left text-navy-500">
                  <tr>
                    <th className="py-1">Date</th>
                    <th className="py-1">Type</th>
                    <th className="py-1 text-right">Qté</th>
                    <th className="py-1 text-right">Stock</th>
                    <th className="py-1">Motif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="py-1.5">{formatDateTime(movement.createdAt)}</td>
                      <td className="py-1.5">{movement.type}</td>
                      <td className={`py-1.5 text-right font-semibold ${movement.quantity < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                      </td>
                      <td className="py-1.5 text-right">{movement.stockAfter}</td>
                      <td className="py-1.5 text-navy-500">{movement.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-bold">Photos ({images.length})</h2>
            <div className="grid grid-cols-2 gap-2">
              {images.map((image) => (
                <div key={image.id} className="relative overflow-hidden rounded-lg border border-navy-100">
                  <Image src={image.url} alt={image.alt ?? ''} width={200} height={200} className="aspect-square w-full object-cover" />
                  <form action={deleteProductImageAction} className="absolute right-1 top-1">
                    <input type="hidden" name="imageId" value={image.id} />
                    <button type="submit" className="grid size-7 place-items-center rounded-md bg-white/90 text-danger-500 shadow hover:bg-white" aria-label="Supprimer cette photo">
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </form>
                </div>
              ))}
            </div>
            <form action={uploadProductImagesAction} className="mt-3 space-y-2" encType="multipart/form-data">
              <input type="hidden" name="productId" value={product.id} />
              <input type="file" name="images" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="block w-full text-xs" required />
              <Button type="submit" size="sm" variant="outline">Téléverser les photos</Button>
              <p className="text-[11px] text-navy-500">
                Les images sont redimensionnées (1600 px max), converties en WebP et dédupliquées par empreinte.
              </p>
            </form>
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-bold">Stock</h2>
            <StockAdjustForm productId={product.id} currentStock={product.stock} reserved={product.reserved} />
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-bold">Archivage</h2>
            <p className="mb-2 text-xs text-navy-500">
              L’archivage retire le produit du catalogue sans supprimer l’historique des commandes.
            </p>
            <form action={archiveProductAction}>
              <input type="hidden" name="id" value={product.id} />
              <input type="hidden" name="archived" value={product.isArchived ? '0' : '1'} />
              <Button type="submit" variant="outline" size="sm">{product.isArchived ? 'Restaurer le produit' : 'Archiver le produit'}</Button>
            </form>
          </Card>
        </aside>
      </div>
    </div>
  );
}
