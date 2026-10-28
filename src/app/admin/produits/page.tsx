import Link from 'next/link';
import Image from 'next/image';
import { Plus, Search } from 'lucide-react';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { formatFCFA } from '@/lib/utils';
import { Badge, Card, EmptyState } from '@/components/ui/primitives';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form';
import { Pagination } from '@/components/pagination';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const status = typeof params.status === 'string' ? params.status : 'active';
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const perPage = 25;

  const conditions = [sql`1 = 1`];
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    conditions.push(sql`(lower(p.name) LIKE ${like} OR lower(p.sku) LIKE ${like} OR p.search_text LIKE ${like})`);
  }
  if (status === 'active') conditions.push(sql`p.is_active = true AND p.is_archived = false`);
  if (status === 'inactive') conditions.push(sql`p.is_active = false AND p.is_archived = false`);
  if (status === 'archived') conditions.push(sql`p.is_archived = true`);
  if (status === 'low') conditions.push(sql`(p.stock - p.reserved) <= coalesce(p.low_stock_threshold, 5)`);

  const where = sql.join(conditions, sql` AND `);
  const rows = await db.execute(sql`
    SELECT p.id, p.sku, p.name, p.price, p.promo_price, p.stock, p.reserved, p.is_active, p.is_archived,
      c.name AS category_name, b.name AS brand_name,
      (SELECT url FROM product_images WHERE product_id = p.id ORDER BY position LIMIT 1) AS image_url,
      count(*) OVER() AS total_count
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE ${where}
    ORDER BY p.updated_at DESC
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `);

  const list = rows.rows as Record<string, unknown>[];
  const total = list[0] ? Number(list[0].total_count) : 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Produits</h1>
          <p className="text-sm text-navy-600">{total} produit(s) correspondant au filtre</p>
        </div>
        <ButtonLink href="/admin/produits/nouveau">
          <Plus className="size-4" aria-hidden /> Nouveau produit
        </ButtonLink>
      </header>

      <Card className="p-3">
        <form method="get" className="grid gap-2 sm:grid-cols-[1fr_200px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy-400" aria-hidden />
            <Input name="q" defaultValue={q} className="pl-9" placeholder="Nom, référence, mot-clé" aria-label="Rechercher un produit" />
          </div>
          <Select name="status" defaultValue={status} aria-label="Filtrer par état">
            <option value="active">Publiés</option>
            <option value="inactive">Masqués</option>
            <option value="low">Stock faible</option>
            <option value="archived">Archivés</option>
            <option value="all">Tous</option>
          </Select>
          <Button type="submit">Filtrer</Button>
        </form>
      </Card>

      {list.length === 0 ? (
        <EmptyState
          title="Aucun produit"
          description="Créez un produit ou importez votre catalogue CSV."
          action={<ButtonLink href="/admin/produits/nouveau">Ajouter un produit</ButtonLink>}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-500">
              <tr>
                <th className="px-3 py-2">Produit</th>
                <th className="px-3 py-2">Catégorie</th>
                <th className="px-3 py-2 text-right">Prix</th>
                <th className="px-3 py-2 text-center">Stock</th>
                <th className="px-3 py-2 text-center">Réservé</th>
                <th className="px-3 py-2">État</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {list.map((row) => {
                const available = Number(row.stock) - Number(row.reserved);
                return (
                  <tr key={String(row.id)} className="hover:bg-navy-50/60">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="relative size-10 shrink-0 overflow-hidden rounded border border-navy-100 bg-white">
                          {row.image_url ? (
                            <Image src={String(row.image_url)} alt="" width={80} height={80} className="size-full object-cover" />
                          ) : null}
                        </span>
                        <div className="min-w-0">
                          <Link href={`/admin/produits/${row.id}`} className="block truncate font-medium text-navy-900 hover:text-accent-700">
                            {String(row.name)}
                          </Link>
                          <p className="text-xs text-navy-500">{String(row.sku)}{row.brand_name ? ` · ${String(row.brand_name)}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-navy-600">{row.category_name ? String(row.category_name) : '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <p className="font-semibold">{formatFCFA(row.price as string)}</p>
                      {row.promo_price ? <p className="text-xs text-accent-700">{formatFCFA(row.promo_price as string)}</p> : null}
                    </td>
                    <td className="px-3 py-2 text-center font-medium">{String(row.stock)}</td>
                    <td className="px-3 py-2 text-center text-navy-500">{String(row.reserved)}</td>
                    <td className="px-3 py-2">
                      {row.is_archived ? (
                        <Badge tone="neutral">Archivé</Badge>
                      ) : !row.is_active ? (
                        <Badge tone="neutral">Masqué</Badge>
                      ) : available <= 0 ? (
                        <Badge tone="danger">Épuisé</Badge>
                      ) : available <= 5 ? (
                        <Badge tone="warning">Stock faible</Badge>
                      ) : (
                        <Badge tone="success">En ligne</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / perPage))} basePath="/admin/produits" searchParams={{ q, status }} />
    </div>
  );
}
