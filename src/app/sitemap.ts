import type { MetadataRoute } from 'next';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/catalogue', priority: 0.9, changeFrequency: 'daily' },
  { path: '/recherche-visuelle', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/livraison', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/paiement', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/retours', priority: 0.4, changeFrequency: 'yearly' },
  { path: '/contact', priority: 0.5, changeFrequency: 'yearly' },
  { path: '/cgv', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/confidentialite', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/mentions-legales', priority: 0.3, changeFrequency: 'yearly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.appUrl.replace(/\/$/, '');
  const now = new Date();

  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `${base}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  try {
    const [productRows, categoryRows] = await Promise.all([
      db.execute(sql`
        SELECT slug, updated_at FROM products
        WHERE is_active AND NOT is_archived
        ORDER BY updated_at DESC
        LIMIT 5000
      `),
      db.execute(sql`SELECT slug, updated_at FROM categories WHERE is_active ORDER BY position`),
    ]);

    const products = (productRows.rows as { slug: string; updated_at: string }[]).map((row) => ({
      url: `${base}/produit/${row.slug}`,
      lastModified: new Date(row.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

    const categories = (categoryRows.rows as { slug: string; updated_at: string }[]).map((row) => ({
      url: `${base}/categorie/${row.slug}`,
      lastModified: new Date(row.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    return [...staticEntries, ...categories, ...products];
  } catch {
    // Base indisponible : le plan du site reste valable pour les pages statiques.
    return staticEntries;
  }
}
