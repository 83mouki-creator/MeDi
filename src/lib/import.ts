import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { brands, categories, productImages, products } from '../db/schema';
import { buildSearchText } from './catalog';
import { newId, normalizeText, slugify } from './utils';

/**
 * Import de catalogue par CSV.
 *
 * Colonnes attendues (en-tête obligatoire, ordre libre) :
 *   sku, nom, prix, stock [, categorie, marque, description_courte, description,
 *   prix_promo, mots_cles, seuil_stock_faible, précommande]
 *
 * Règles :
 *  - aucune valeur n'est déduite d'une photo ;
 *  - un prix et un stock sont obligatoires et validés ;
 *  - les lignes invalides sont rejetées avec leur motif, sans interrompre l'import ;
 *  - un SKU existant est mis à jour (nom, prix, stock, descriptions), jamais dupliqué.
 */

export type ImportRowResult = {
  line: number;
  sku: string;
  name: string;
  status: 'created' | 'updated' | 'rejected';
  reason?: string;
};

export type ImportReport = {
  total: number;
  created: number;
  updated: number;
  rejected: number;
  rows: ImportRowResult[];
};

/** Analyseur CSV minimal mais correct (guillemets, virgules et points-virgules). */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = text.split('\n')[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (char === '\n') {
      row.push(field.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  row.push(field.trim());
  if (row.some((cell) => cell !== '')) rows.push(row);
  return rows;
}

const HEADER_ALIASES: Record<string, string> = {
  sku: 'sku',
  reference: 'sku',
  'référence': 'sku',
  ref: 'sku',
  nom: 'name',
  name: 'name',
  produit: 'name',
  prix: 'price',
  price: 'price',
  'prix fcfa': 'price',
  stock: 'stock',
  quantite: 'stock',
  'quantité': 'stock',
  categorie: 'category',
  'catégorie': 'category',
  category: 'category',
  marque: 'brand',
  brand: 'brand',
  description_courte: 'shortDescription',
  'description courte': 'shortDescription',
  description: 'description',
  prix_promo: 'promoPrice',
  'prix promo': 'promoPrice',
  promo: 'promoPrice',
  mots_cles: 'keywords',
  'mots-clés': 'keywords',
  keywords: 'keywords',
  seuil_stock_faible: 'lowStockThreshold',
  precommande: 'allowPreorder',
  'précommande': 'allowPreorder',
};

function indexHeader(header: string[]) {
  const map: Record<string, number> = {};
  header.forEach((cell, index) => {
    const key = HEADER_ALIASES[normalizeText(cell)] ?? HEADER_ALIASES[cell.toLowerCase()];
    if (key) map[key] = index;
  });
  return map;
}

function toInt(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/\s/g, '').replace(/[^\d-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function importCatalogCsv(csvText: string, options: { dryRun?: boolean } = {}): Promise<ImportReport> {
  const table = parseCsv(csvText);
  if (table.length < 2) {
    return { total: 0, created: 0, updated: 0, rejected: 0, rows: [] };
  }

  const header = table[0]!;
  const columns = indexHeader(header);
  if (columns.sku === undefined || columns.name === undefined || columns.price === undefined) {
    throw new Error('En-tête CSV invalide : les colonnes sku, nom et prix sont obligatoires.');
  }

  // Référentiels existants
  const existingCategories = await db.select({ id: categories.id, slug: categories.slug, name: categories.name }).from(categories);
  const existingBrands = await db.select({ id: brands.id, slug: brands.slug, name: brands.name }).from(brands);

  const report: ImportReport = { total: 0, created: 0, updated: 0, rejected: 0, rows: [] };
  const seenSkus = new Set<string>();

  for (let i = 1; i < table.length; i++) {
    const row = table[i]!;
    const line = i + 1;
    const get = (key: string) => (columns[key] === undefined ? '' : (row[columns[key]!] ?? '').trim());

    const sku = get('sku').toUpperCase();
    const name = get('name');
    const price = toInt(get('price'));
    const stock = toInt(get('stock'));

    const reject = (reason: string) => {
      report.rejected++;
      report.rows.push({ line, sku, name, status: 'rejected', reason });
    };

    if (!sku) { reject('Référence (sku) manquante'); continue; }
    if (seenSkus.has(sku)) { reject('Référence en double dans le fichier'); continue; }
    seenSkus.add(sku);
    if (name.length < 3) { reject('Nom trop court'); continue; }
    if (price === null || price <= 0) { reject('Prix invalide (entier FCFA positif attendu)'); continue; }
    if (stock === null || stock < 0) { reject('Stock invalide (0 ou plus attendu)'); continue; }

    const promoPrice = toInt(get('promoPrice'));
    if (promoPrice !== null && promoPrice > 0 && promoPrice >= price) {
      reject('Prix promo supérieur ou égal au prix normal');
      continue;
    }

    const categoryName = get('category');
    const brandName = get('brand');
    let categoryId: string | null = null;
    let brandId: string | null = null;

    if (categoryName) {
      const found = existingCategories.find((c) => normalizeText(c.name) === normalizeText(categoryName) || c.slug === slugify(categoryName));
      if (found) {
        categoryId = found.id;
      } else if (!options.dryRun) {
        const id = newId('cat_');
        await db.insert(categories).values({ id, slug: slugify(categoryName), name: categoryName, position: 99 }).onConflictDoNothing();
        existingCategories.push({ id, slug: slugify(categoryName), name: categoryName });
        categoryId = id;
      }
    }

    if (brandName) {
      const found = existingBrands.find((b) => normalizeText(b.name) === normalizeText(brandName) || b.slug === slugify(brandName));
      if (found) {
        brandId = found.id;
      } else if (!options.dryRun) {
        const id = newId('brd_');
        await db.insert(brands).values({ id, slug: slugify(brandName), name: brandName }).onConflictDoNothing();
        existingBrands.push({ id, slug: slugify(brandName), name: brandName });
        brandId = id;
      }
    }

    const searchText = buildSearchText({
      name,
      sku,
      shortDescription: get('shortDescription'),
      keywords: get('keywords').split(/[|,]/).map((k) => k.trim()).filter(Boolean),
      brandName,
      categoryName,
    });

    const existing = await db.select({ id: products.id }).from(products).where(eq(products.sku, sku)).limit(1);
    const isUpdate = Boolean(existing[0]);

    if (!options.dryRun) {
      const slug = slugify(`${name}-${sku}`);
      if (isUpdate) {
        await db
          .update(products)
          .set({
            name,
            slug,
            shortDescription: get('shortDescription') || null,
            description: get('description') || null,
            price: String(price),
            promoPrice: promoPrice !== null ? String(promoPrice) : null,
            stock,
            lowStockThreshold: toInt(get('lowStockThreshold')),
            allowPreorder: ['1', 'oui', 'yes', 'true'].includes(get('allowPreorder').toLowerCase()),
            searchText,
            keywords: get('keywords').split(/[|,]/).map((k) => k.trim()).filter(Boolean),
            categoryId,
            brandId,
            updatedAt: new Date(),
          })
          .where(eq(products.sku, sku));
      } else {
        await db.insert(products).values({
          id: newId('prd_'),
          sku,
          slug,
          name,
          shortDescription: get('shortDescription') || null,
          description: get('description') || null,
          price: String(price),
          promoPrice: promoPrice !== null ? String(promoPrice) : null,
          stock,
          lowStockThreshold: toInt(get('lowStockThreshold')),
          allowPreorder: ['1', 'oui', 'yes', 'true'].includes(get('allowPreorder').toLowerCase()),
          searchText,
          keywords: get('keywords').split(/[|,]/).map((k) => k.trim()).filter(Boolean),
          categoryId,
          brandId,
        });
      }
    }

    if (isUpdate) report.updated++;
    else report.created++;
    report.rows.push({ line, sku, name, status: isUpdate ? 'updated' : 'created' });
    report.total++;
  }

  return report;
}

/**
 * Réaffecte une photo importée à une fiche produit.
 * Une même image ne peut pas être affectée deux fois (somme de contrôle unique).
 */
export async function assignMediaToProduct(params: { mediaId: string; productId: string; position?: number }) {
  const rows = await db.execute(sql`SELECT id, url, checksum, width, height, filename FROM media_assets WHERE id = ${params.mediaId} LIMIT 1`);
  const media = (rows.rows as Record<string, unknown>[])[0];
  if (!media) throw new Error('Photo introuvable.');

  const product = await db.select({ id: products.id }).from(products).where(eq(products.id, params.productId)).limit(1);
  if (!product[0]) throw new Error('Produit introuvable.');

  const existing = await db.select({ id: productImages.id }).from(productImages).where(eq(productImages.checksum, String(media.checksum))).limit(1);
  if (existing[0]) {
    await db.update(productImages).set({ productId: params.productId }).where(eq(productImages.id, existing[0].id));
  } else {
    await db.insert(productImages).values({
      id: newId('img_'),
      productId: params.productId,
      url: String(media.url),
      alt: String(media.filename),
      position: params.position ?? 0,
      width: media.width === null ? null : Number(media.width),
      height: media.height === null ? null : Number(media.height),
      checksum: String(media.checksum),
    });
  }

  await db.execute(sql`UPDATE media_assets SET status = 'ASSIGNED', product_id = ${params.productId} WHERE id = ${params.mediaId}`);
}
