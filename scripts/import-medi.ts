/**
 * Import du catalogue réel MeDi (photos fournisseur → fiches produits).
 *
 * Idempotent : les fiches déjà présentes (par référence) ne sont pas écrasées
 * sauf avec `--update`, afin qu'une modification faite dans /admin ne soit
 * jamais perdue lors d'un redéploiement.
 *
 *   npm run catalogue:medi            # crée ce qui manque
 *   npm run catalogue:medi -- --update
 *   npm run catalogue:medi -- --dry-run
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { db, pool } from '../src/db';
import { brands, categories, productAttributes, productImages, products } from '../src/db/schema';
import { buildSearchText } from '../src/lib/catalog';
import { newId, slugify } from '../src/lib/utils';
import { loadCatalogue } from './catalogue-data';

type ImageIndex = Record<string, { url: string; checksum: string; width: number; height: number }>;

const DRY = process.argv.includes('--dry-run');
const UPDATE = process.argv.includes('--update');

async function main() {
  console.log(`→ Catalogue réel MeDi${DRY ? ' (simulation)' : ''}`);

  const manifest = await loadCatalogue();
  const images = JSON.parse(await readFile(path.join('data', 'catalogue', 'images.json'), 'utf8')) as ImageIndex;

  const categoryIdBySlug = new Map<string, string>();
  const allCategories = await db.select({ id: categories.id, slug: categories.slug, parentId: categories.parentId }).from(categories);
  for (const row of allCategories) categoryIdBySlug.set(row.slug, row.id);

  let createdCategories = 0;

  const ensureCategory = async (params: { slug: string; name: string; description?: string; parentId: string | null }) => {
    const existing = categoryIdBySlug.get(params.slug);
    if (existing) return existing;
    const id = newId('cat_');
    if (!DRY) {
      await db
        .insert(categories)
        .values({ id, slug: params.slug, name: params.name, description: params.description ?? null, parentId: params.parentId, position: 99 })
        .onConflictDoNothing();
    }
    categoryIdBySlug.set(params.slug, id);
    createdCategories += 1;
    console.log(`   + catégorie ${params.name}${params.parentId ? ' (sous-catégorie)' : ''}`);
    return id;
  };

  // 1. Catégories racines + sous-catégories
  for (const root of manifest.categories) {
    const parentId = await ensureCategory({ slug: root.slug, name: root.name, description: root.description, parentId: null });
    for (const child of root.children ?? []) {
      await ensureCategory({ slug: child.slug, name: child.name, description: child.description, parentId });
    }
  }

  // 2. Sous-catégories rattachées aux rayons déjà existants
  for (const sub of manifest.sousCategoriesExistantes) {
    const parentId = categoryIdBySlug.get(sub.parent);
    if (!parentId) {
      console.warn(`   ⚠️  rayon parent « ${sub.parent} » introuvable — ${sub.name} créé à la racine`);
    }
    await ensureCategory({ slug: sub.slug, name: sub.name, parentId: parentId ?? null });
  }

  const categoryNames = new Map<string, string>();
  for (const row of await db.select({ id: categories.id, slug: categories.slug, name: categories.name }).from(categories)) {
    categoryNames.set(row.slug, row.name);
  }

  // 3. Marques
  const brandRows = await db.select({ id: brands.id, name: brands.name, slug: brands.slug }).from(brands);
  const brandIdByName = new Map(brandRows.map((b) => [b.slug, b.id]));
  for (const product of manifest.produits) {
    const slug = slugify(product.brand);
    if (brandIdByName.has(slug)) continue;
    const id = newId('brd_');
    if (!DRY) await db.insert(brands).values({ id, slug, name: product.brand }).onConflictDoNothing();
    brandIdByName.set(slug, id);
    console.log(`   + marque ${product.brand}`);
  }

  // 4. Produits
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let imagesLinked = 0;

  for (const item of manifest.produits) {
    const sku = item.sku.toUpperCase();
    const categoryId = categoryIdBySlug.get(item.category) ?? null;
    const brandId = brandIdByName.get(slugify(item.brand)) ?? null;
    const image = images[item.sku];

    if (!categoryId) console.warn(`   ⚠️  ${sku} : catégorie « ${item.category} » introuvable`);
    if (!image) console.warn(`   ⚠️  ${sku} : photo non générée (lancez npm run images:products)`);

    const attributes = Object.entries(item.attributes ?? {}).map(([name, value]) => ({ name, value }));
    const slug = slugify(`${item.name}-${sku}`);
    const searchText = buildSearchText({
      name: item.name,
      sku,
      shortDescription: item.shortDescription,
      keywords: item.keywords ?? [],
      brandName: item.brand,
      categoryName: categoryNames.get(item.category) ?? null,
      attributes,
    });

    const existing = await db.select({ id: products.id }).from(products).where(eq(products.sku, sku)).limit(1);
    const isUpdate = Boolean(existing[0]);

    if (isUpdate && !UPDATE) {
      skipped += 1;
      continue;
    }

    const values = {
      sku,
      slug,
      name: item.name,
      shortDescription: item.shortDescription ?? null,
      description: item.description ?? null,
      price: String(item.price),
      stock: item.stock,
      lowStockThreshold: 3,
      isActive: true,
      isArchived: false,
      isFeatured: Boolean(item.featured),
      searchText,
      keywords: item.keywords ?? [],
      categoryId,
      brandId,
      updatedAt: new Date(),
    };

    let productId = existing[0]?.id;
    if (!DRY) {
      if (isUpdate && productId) {
        await db.update(products).set(values).where(eq(products.id, productId));
        await db.delete(productAttributes).where(eq(productAttributes.productId, productId));
        updated += 1;
      } else {
        productId = newId('prd_');
        await db.insert(products).values({ id: productId, ...values });
        created += 1;
      }

      for (const [index, attribute] of attributes.entries()) {
        await db.insert(productAttributes).values({
          id: newId('att_'),
          productId: productId!,
          name: attribute.name,
          value: attribute.value,
          position: index,
        });
      }

      if (image) {
        const existingImage = await db
          .select({ id: productImages.id })
          .from(productImages)
          .where(eq(productImages.checksum, image.checksum))
          .limit(1);
        if (existingImage[0]) {
          await db
            .update(productImages)
            .set({ productId: productId!, url: image.url, alt: item.name, position: 0, width: image.width, height: image.height })
            .where(eq(productImages.id, existingImage[0].id));
        } else {
          await db.insert(productImages).values({
            id: newId('img_'),
            productId: productId!,
            url: image.url,
            alt: item.name,
            position: 0,
            width: image.width,
            height: image.height,
            checksum: image.checksum,
          });
        }
        imagesLinked += 1;
      }
    } else if (isUpdate) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  // 5. Archivage du catalogue de démonstration (jamais supprimé : l'historique
  //    des commandes reste lisible).
  const realCount = await db.execute(
    sql`SELECT count(*)::int AS n FROM products WHERE is_archived = false AND is_active = true AND sku NOT LIKE 'MED-%'`,
  );
  const reels = (realCount.rows as { n: number }[])[0]?.n ?? 0;

  // Seules les 47 références de démonstration (MED-0001 … MED-0047) sont
  // archivées : une référence saisie par la boutique n'est jamais touchée.
  const archivedRows =
    DRY || reels === 0
      ? []
      : (
          await db.execute(sql`
            UPDATE products SET is_archived = true, is_active = false, updated_at = now()
            WHERE is_archived = false AND sku IN (
              SELECT 'MED-' || lpad(n::text, 4, '0') FROM generate_series(1, 47) AS n
            )
            RETURNING id
          `)
        ).rows;

  console.log(
    `\n${created} fiche(s) créée(s), ${updated} mise(s) à jour, ${skipped} conservée(s) telle(s) quelle(s), ` +
      `${imagesLinked} photo(s) liée(s), ${createdCategories} catégorie(s) ajoutée(s).`,
  );
  console.log(`Catalogue de démonstration archivé : ${archivedRows.length} référence(s).`);

  const total = await db.execute(sql`SELECT count(*)::int AS n FROM products WHERE is_archived = false AND is_active = true`);
  console.log(`Produits publiés : ${(total.rows as { n: number }[])[0]?.n ?? 0}`);
}

main()
  .catch((error) => {
    console.error('❌ Import interrompu :', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
