import Link from 'next/link';
import { requirePagePermission } from '@/lib/auth';
import { getAdminI18n } from '@/lib/i18n/admin-server';
import Image from 'next/image';
import { Plus, Search } from 'lucide-react';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { formatFCFA, parsePage, sanitizeSearch } from '@/lib/utils';
import { Badge, Card, EmptyState } from '@/components/ui/primitives';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form';
import { Pagination } from '@/components/pagination';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePagePermission('products.read');
  const { t } = await getAdminI18n();
  const params = await searchParams;
  const q = sanitizeSearch(typeof params.q === 'string' ? params.q : '');
  const status = typeof params.status === 'string' ? params.status : 'active';
  const page = parsePage(params.page);
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
          <h1 className="text-xl font-extrabold tracking-tight">{t('Mes produits')}</h1>
          <p className="text-sm text-navy-600">
            {t('{total} produit(s) affiché(s). Ouvrez un produit pour changer son prix, sa photo ou son stock.', { total })}
          </p>
        </div>
        <ButtonLink href="/admin/produits/nouveau">
          <Plus className="size-4" aria-hidden /> {t('Nouveau produit')}
        </ButtonLink>
      </header>

      <Card className="p-3">
        <form method="get" className="grid gap-2 sm:grid-cols-[1fr_200px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy-400" aria-hidden />
            <Input name="q" defaultValue={q} className="pl-9" placeholder={t('Rechercher dans mes produits (nom, référence)')} aria-label={t('Rechercher un produit dans l’administration')} />
          </div>
          <Select name="status" defaultValue={status} aria-label={t('Filtrer par état')}>
            <option value="active">{t('Publiés')}</option>
            <option value="inactive">{t('Masqués')}</option>
            <option value="low">{t('Stock faible')}</option>
            <option value="archived">{t('Archivés')}</option>
            <option value="all">{t('Tous')}</option>
          </Select>
          <Button type="submit">{t('Filtrer')}</Button>
        </form>
      </Card>

      {list.length === 0 ? (
        <EmptyState
          title={t('Aucun produit')}
          description="Créez un produit ou importez votre catalogue CSV."
          action={<ButtonLink href="/admin/produits/nouveau">{t('Ajouter un produit')}</ButtonLink>}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-500">
              <tr>
                <th className="px-3 py-2">{t('Produit')}</th>
                <th className="px-3 py-2">{t('Catégorie')}</th>
                <th className="px-3 py-2 text-right">{t('Prix')}</th>
                <th className="px-3 py-2 text-center">{t('Stock')}</th>
                <th className="px-3 py-2 text-center">{t('Réservé')}</th>
                <th className="px-3 py-2">{t('État')}</th>
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
                        <Badge tone="neutral">{t('Archivé')}</Badge>
                      ) : !row.is_active ? (
                        <Badge tone="neutral">{t('Masqué')}</Badge>
                      ) : available <= 0 ? (
                        <Badge tone="danger">{t('Épuisé')}</Badge>
                      ) : available <= 5 ? (
                        <Badge tone="warning">{t('Stock faible')}</Badge>
                      ) : (
                        <Badge tone="success">{t('En ligne')}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / perPage))} basePath="/admin/produits" searchParams={{ q, status }}   labels={{ nav: t('Pagination'), previous: t('Page précédente'), next: t('Page suivante') }}
      />
    </div>
  );
}
