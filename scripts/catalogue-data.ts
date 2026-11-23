/**
 * Chargeur des manifestes de catalogue (un fichier JSON par lot de photos).
 *
 * Les lots sont fusionnés : `data/catalogue/medi-*.json` (hors `images.json`).
 * Les catégories déclarées par plusieurs lots sont fusionnées sans doublon.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export type ManifestProduct = {
  sku: string;
  sourceFile: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  shortDescription?: string;
  description?: string;
  attributes?: Record<string, string>;
  keywords?: string[];
  featured?: boolean;
};

export type ManifestCategory = {
  slug: string;
  name: string;
  description?: string;
  children?: { slug: string; name: string; description?: string }[];
};

export type Catalogue = {
  categories: ManifestCategory[];
  sousCategoriesExistantes: { parent: string; slug: string; name: string }[];
  produits: ManifestProduct[];
};

type RawManifest = Partial<Catalogue> & { produits?: ManifestProduct[] };

const DIR = path.join('data', 'catalogue');

export async function loadCatalogue(): Promise<Catalogue> {
  const files = (await readdir(DIR))
    .filter((name) => name.startsWith('medi-') && name.endsWith('.json'))
    .sort();

  const catalogue: Catalogue = { categories: [], sousCategoriesExistantes: [], produits: [] };
  const skus = new Set<string>();

  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(DIR, file), 'utf8')) as RawManifest;

    for (const category of raw.categories ?? []) {
      const existing = catalogue.categories.find((c) => c.slug === category.slug);
      if (!existing) {
        catalogue.categories.push({ ...category });
        continue;
      }
      for (const child of category.children ?? []) {
        if (!(existing.children ?? []).some((c) => c.slug === child.slug)) {
          existing.children = [...(existing.children ?? []), child];
        }
      }
    }

    for (const sub of raw.sousCategoriesExistantes ?? []) {
      if (!catalogue.sousCategoriesExistantes.some((s) => s.slug === sub.slug)) catalogue.sousCategoriesExistantes.push(sub);
    }

    for (const product of raw.produits ?? []) {
      if (skus.has(product.sku)) {
        console.warn(`   ⚠️  ${product.sku} présent dans plusieurs lots — le premier est conservé`);
        continue;
      }
      skus.add(product.sku);
      catalogue.produits.push(product);
    }
  }

  return catalogue;
}
