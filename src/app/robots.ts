import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const base = env.appUrl.replace(/\/$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/compte', '/compte/', '/api/', '/panier', '/commande/', '/suivi/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
