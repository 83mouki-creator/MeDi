'use client';

import { useEffect, useState } from 'react';
import { ProductRail } from './product-card';
import { SectionHeading } from './ui/primitives';
import type { ProductCard } from '@/lib/catalog';

const STORAGE_KEY = 'medi_recent_products';

export function rememberProduct(productId: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const next = [productId, ...ids.filter((id) => id !== productId)].slice(0, 12);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible (navigation privée) : on ignore */
  }
}

/** Produits récemment consultés — stockés côté navigateur, jamais envoyés au serveur. */
export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const [products, setProducts] = useState<ProductCard[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const ids: string[] = JSON.parse(raw);
        const filtered = ids.filter((id) => id !== excludeId).slice(0, 8);
        if (filtered.length === 0) return;
        const response = await fetch(`/api/products?ids=${encodeURIComponent(filtered.join(','))}`);
        if (!response.ok) return;
        const data = (await response.json()) as { products: ProductCard[] };
        if (!cancelled) {
          const order = new Map(filtered.map((id, index) => [id, index]));
          setProducts([...data.products].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99)));
        }
      } catch {
        /* silencieux */
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [excludeId]);

  if (products.length === 0) return null;

  return (
    <section className="container-page py-6">
      <SectionHeading title="Produits récemment consultés" subtitle="Reprenez là où vous vous êtes arrêté." />
      <ProductRail products={products} />
    </section>
  );
}
