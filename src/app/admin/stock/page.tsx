import Link from 'next/link';
import { getLowStockList } from '@/lib/admin';
import { StockAdjustForm } from '@/components/admin/stock-adjust';
import { Badge, Card, EmptyState } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function StockPage() {
  const products = await getLowStockList(60);
  const alerts = products.filter((p) => p.available <= p.threshold);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight">Stock</h1>
        <p className="text-sm text-navy-600">
          Le stock disponible affiché est le stock physique moins les unités réservées par des commandes en cours. Toute
          modification est tracée dans un mouvement horodaté.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-navy-500">Produits suivis</p>
          <p className="mt-1 text-2xl font-extrabold">{products.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-navy-500">Sous le seuil d’alerte</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-600">{alerts.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-navy-500">Épuisés</p>
          <p className="mt-1 text-2xl font-extrabold text-rose-600">{products.filter((p) => p.available <= 0).length}</p>
        </Card>
      </div>

      {products.length === 0 ? (
        <EmptyState title="Aucun produit" description="Créez ou importez des produits pour suivre leur stock." />
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <Card key={product.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/admin/produits/${product.id}`} className="font-semibold text-navy-900 hover:text-accent-700">
                    {product.name}
                  </Link>
                  <p className="text-xs text-navy-500">
                    {product.sku} · physique {product.stock} · réservé {product.reserved} · disponible {product.available} · seuil {product.threshold}
                  </p>
                </div>
                <Badge tone={product.available <= 0 ? 'danger' : product.available <= product.threshold ? 'warning' : 'success'}>
                  {product.available <= 0 ? 'Épuisé' : product.available <= product.threshold ? 'Stock faible' : 'OK'}
                </Badge>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-accent-700">Ajuster le stock</summary>
                <div className="mt-3">
                  <StockAdjustForm productId={product.id} currentStock={product.stock} reserved={product.reserved} />
                </div>
              </details>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
