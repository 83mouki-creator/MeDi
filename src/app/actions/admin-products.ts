'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { products, productImages, productAttributes, categories, brands, inventoryMovements } from '@/db/schema';
import { requirePermission, clientIpFrom } from '@/lib/auth';
import { adminProductSchema, fieldErrors } from '@/lib/validation';
import { buildSearchText } from '@/lib/catalog';
import { audit } from '@/lib/audit';
import { newId, slugify, normalizeText } from '@/lib/utils';
import { storeImage, deleteStoredImage, UploadError } from '@/lib/storage';

export type AdminState = { error?: string; success?: string; fieldErrors?: Record<string, string> };

function parseBool(value: FormDataEntryValue | null) {
  return value === 'on' || value === 'true' || value === '1';
}

/** Crée ou met à jour une fiche produit (autorisation vérifiée côté serveur). */
export async function saveProductAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const id = String(formData.get('id') ?? '');
  let actor;
  try {
    actor = await requirePermission('products.write');
  } catch {
    return { error: 'Action non autorisée pour votre rôle.' };
  }

  const parsed = adminProductSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    sku: String(formData.get('sku') ?? ''),
    slug: String(formData.get('slug') ?? ''),
    shortDescription: String(formData.get('shortDescription') ?? ''),
    description: String(formData.get('description') ?? ''),
    price: formData.get('price') ?? '',
    promoPrice: formData.get('promoPrice') ? formData.get('promoPrice') : null,
    promoStartsAt: formData.get('promoStartsAt') || null,
    promoEndsAt: formData.get('promoEndsAt') || null,
    stock: formData.get('stock') ?? '0',
    lowStockThreshold: formData.get('lowStockThreshold') || null,
    allowPreorder: parseBool(formData.get('allowPreorder')),
    isActive: parseBool(formData.get('isActive')),
    isFeatured: parseBool(formData.get('isFeatured')),
    categoryId: String(formData.get('categoryId') ?? '') || null,
    brandId: String(formData.get('brandId') ?? '') || null,
    supplierId: String(formData.get('supplierId') ?? '') || null,
    warranty: String(formData.get('warranty') ?? ''),
    keywords: String(formData.get('keywords') ?? ''),
    attributes: [],
  });

  if (!parsed.success) {
    return { error: 'Vérifiez les champs signalés.', fieldErrors: fieldErrors(parsed.error) };
  }

  const data = parsed.data;
  const sku = data.sku.toUpperCase();

  const duplicate = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.sku, sku), id ? sql`${products.id} <> ${id}` : sql`true`))
    .limit(1);
  if (duplicate[0]) return { fieldErrors: { sku: 'Cette référence existe déjà.' } };

  const [categoryRow] = data.categoryId
    ? await db.select({ name: categories.name }).from(categories).where(eq(categories.id, data.categoryId)).limit(1)
    : [];
  const [brandRow] = data.brandId
    ? await db.select({ name: brands.name }).from(brands).where(eq(brands.id, data.brandId)).limit(1)
    : [];

  const keywords = (data.keywords ?? '').split(/[|,]/).map((k) => k.trim()).filter(Boolean);
  const searchText = buildSearchText({
    name: data.name,
    sku,
    shortDescription: data.shortDescription,
    keywords,
    brandName: brandRow?.name ?? null,
    categoryName: categoryRow?.name ?? null,
  });

  const values = {
    sku,
    name: data.name,
    slug: data.slug?.trim() ? slugify(data.slug) : slugify(`${data.name}-${sku}`),
    shortDescription: data.shortDescription || null,
    description: data.description || null,
    price: String(data.price),
    promoPrice: data.promoPrice && data.promoPrice > 0 ? String(data.promoPrice) : null,
    promoStartsAt: data.promoStartsAt ? new Date(data.promoStartsAt) : null,
    promoEndsAt: data.promoEndsAt ? new Date(data.promoEndsAt) : null,
    stock: data.stock,
    lowStockThreshold: data.lowStockThreshold ?? null,
    allowPreorder: Boolean(data.allowPreorder),
    isActive: Boolean(data.isActive),
    isFeatured: Boolean(data.isFeatured),
    categoryId: data.categoryId || null,
    brandId: data.brandId || null,
    supplierId: data.supplierId || null,
    warranty: data.warranty || null,
    keywords,
    searchText,
    updatedAt: new Date(),
  };

  try {
    if (id) {
      const before = await db.select().from(products).where(eq(products.id, id)).limit(1);
      if (!before[0]) return { error: 'Produit introuvable.' };

      await db.update(products).set(values).where(eq(products.id, id));

      if (before[0].stock !== data.stock) {
        await db.insert(inventoryMovements).values({
          id: newId('mov_'),
          productId: id,
          type: 'ADJUSTMENT',
          quantity: data.stock - before[0].stock,
          stockAfter: data.stock,
          reservedAfter: before[0].reserved,
          reason: `Modification manuelle du stock (${actor.email})`,
          userId: actor.id,
        });
      }

      // Caractéristiques techniques
      const attrNames = formData.getAll('attributeName').map(String);
      const attrValues = formData.getAll('attributeValue').map(String);
      const attributes = attrNames
        .map((name, index) => ({ name: name.trim(), value: (attrValues[index] ?? '').trim() }))
        .filter((a) => a.name && a.value);
      await db.delete(productAttributes).where(eq(productAttributes.productId, id));
      for (const [position, attribute] of attributes.entries()) {
        await db.insert(productAttributes).values({ id: newId('att_'), productId: id, name: attribute.name, value: attribute.value, position });
      }

      await audit(actor, { action: 'product.updated', entity: 'product', entityId: id, metadata: { sku, price: data.price } });
    } else {
      const productId = newId('prd_');
      await db.insert(products).values({ id: productId, ...values });

      if (data.stock > 0) {
        await db.insert(inventoryMovements).values({
          id: newId('mov_'),
          productId,
          type: 'INITIAL',
          quantity: data.stock,
          stockAfter: data.stock,
          reservedAfter: 0,
          reason: 'Création du produit',
          userId: actor.id,
        });
      }

      const attrNames = formData.getAll('attributeName').map(String);
      const attrValues = formData.getAll('attributeValue').map(String);
      const attributes = attrNames
        .map((name, index) => ({ name: name.trim(), value: (attrValues[index] ?? '').trim() }))
        .filter((a) => a.name && a.value);
      for (const [position, attribute] of attributes.entries()) {
        await db.insert(productAttributes).values({ id: newId('att_'), productId, name: attribute.name, value: attribute.value, position });
      }

      // Photos téléversées à la création
      const files = formData.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
      for (const [index, file] of files.entries()) {
        try {
          const stored = await storeImage({ file, name: `${sku}-${index + 1}` });
          await db.insert(productImages).values({
            id: newId('img_'),
            productId,
            url: stored.url,
            publicId: stored.publicId,
            alt: `${data.name} — photo ${index + 1}`,
            position: index,
            width: stored.width,
            height: stored.height,
            checksum: stored.checksum,
          });
        } catch (error) {
          if (error instanceof UploadError) {
            console.warn('[product] image refusée', error.message);
          } else throw error;
        }
      }

      await audit(actor, { action: 'product.created', entity: 'product', entityId: productId, metadata: { sku, price: data.price } });
      revalidatePath('/admin/produits');
      revalidatePath('/catalogue');
      redirect(`/admin/produits/${productId}?cree=1`);
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'digest' in error) throw error;
    console.error('[admin] produit', error);
    return { error: 'Enregistrement impossible. Vérifiez les données.' };
  }

  revalidatePath('/admin/produits');
  revalidatePath(`/produit/${values.slug}`);
  revalidatePath('/catalogue');
  return { success: 'Produit enregistré.' };
}

export async function archiveProductAction(formData: FormData) {
  const actor = await requirePermission('products.write').catch(() => null);
  if (!actor) redirect('/admin');
  const id = String(formData.get('id') ?? '');
  const archived = formData.get('archived') === '1';

  await db.update(products).set({ isArchived: archived, isActive: archived ? false : true, updatedAt: new Date() }).where(eq(products.id, id));
  await audit(actor, { action: archived ? 'product.archived' : 'product.restored', entity: 'product', entityId: id });
  revalidatePath('/admin/produits');
  revalidatePath('/catalogue');
  redirect('/admin/produits');
}

/** Ajustement de stock tracé (réapprovisionnement, casse, inventaire). */
export async function adjustStockAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  let actor;
  try {
    actor = await requirePermission('products.write');
  } catch {
    return { error: 'Action non autorisée.' };
  }

  const productId = String(formData.get('productId') ?? '');
  const mode = String(formData.get('mode') ?? 'delta');
  const quantity = Number(formData.get('quantity') ?? 0);
  const reason = String(formData.get('reason') ?? '').trim();

  if (!Number.isFinite(quantity) || quantity === 0) return { error: 'Indiquez une quantité non nulle.' };
  if (reason.length < 3) return { error: 'Un motif est requis pour tracer le mouvement.' };

  const ip = clientIpFrom(await headers());

  try {
    await db.transaction(async (tx) => {
      const rows = await tx.select().from(products).where(eq(products.id, productId)).for('update');
      const product = rows[0];
      if (!product) throw new Error('Produit introuvable.');

      const newStock = mode === 'set' ? Math.trunc(quantity) : product.stock + Math.trunc(quantity);
      if (newStock < 0) throw new Error('Le stock ne peut pas devenir négatif.');
      if (newStock < product.reserved) throw new Error(`Stock inférieur aux ${product.reserved} unité(s) déjà réservées.`);

      await tx.update(products).set({ stock: newStock, updatedAt: new Date() }).where(eq(products.id, productId));
      await tx.insert(inventoryMovements).values({
        id: newId('mov_'),
        productId,
        type: mode === 'set' ? 'ADJUSTMENT' : quantity > 0 ? 'RESTOCK' : 'ADJUSTMENT',
        quantity: newStock - product.stock,
        stockAfter: newStock,
        reservedAfter: product.reserved,
        reason,
        userId: actor.id,
      });
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Ajustement impossible.' };
  }

  await audit(actor, { action: 'stock.adjusted', entity: 'product', entityId: productId, metadata: { mode, quantity, reason }, ip });
  revalidatePath('/admin/stock');
  revalidatePath(`/admin/produits/${productId}`);
  return { success: 'Stock mis à jour et mouvement enregistré.' };
}

export async function uploadProductImagesAction(formData: FormData) {
  const actor = await requirePermission('products.write').catch(() => null);
  if (!actor) redirect('/admin');
  const productId = String(formData.get('productId') ?? '');
  const files = formData.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);

  const product = await db.select({ id: products.id, name: products.name, sku: products.sku }).from(products).where(eq(products.id, productId)).limit(1);
  if (!product[0]) redirect('/admin/produits');

  const existing = await db.select({ id: productImages.id }).from(productImages).where(eq(productImages.productId, productId));

  for (const [index, file] of files.entries()) {
    try {
      const stored = await storeImage({ file, name: `${product[0].sku}-${existing.length + index + 1}` });
      await db.insert(productImages).values({
        id: newId('img_'),
        productId,
        url: stored.url,
        publicId: stored.publicId,
        alt: `${product[0].name} — photo ${existing.length + index + 1}`,
        position: existing.length + index,
        width: stored.width,
        height: stored.height,
        checksum: stored.checksum,
      });
    } catch (error) {
      if (error instanceof UploadError) console.warn('[image] refusée :', error.message);
      else console.error('[image] échec', error);
    }
  }

  await audit(actor, { action: 'product.images_uploaded', entity: 'product', entityId: productId, metadata: { count: files.length } });
  revalidatePath(`/admin/produits/${productId}`);
  redirect(`/admin/produits/${productId}`);
}

export async function deleteProductImageAction(formData: FormData) {
  const actor = await requirePermission('products.write').catch(() => null);
  if (!actor) redirect('/admin');
  const imageId = String(formData.get('imageId') ?? '');
  const rows = await db.select().from(productImages).where(eq(productImages.id, imageId)).limit(1);
  const image = rows[0];
  if (!image) redirect('/admin/produits');

  await db.delete(productImages).where(eq(productImages.id, imageId));
  await deleteStoredImage(image.publicId, image.url);
  await audit(actor, { action: 'product.image_deleted', entity: 'product_image', entityId: imageId });
  revalidatePath(`/admin/produits/${image.productId}`);
  redirect(`/admin/produits/${image.productId}`);
}

/** Gestion simple des catégories et marques depuis l'administration. */
export async function saveCategoryAction(formData: FormData) {
  const actor = await requirePermission('products.write').catch(() => null);
  if (!actor) redirect('/admin/categories');
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const parentId = String(formData.get('parentId') ?? '') || null;
  if (name.length < 2) redirect('/admin/categories?erreur=nom');

  if (id) {
    await db.update(categories).set({ name, description, parentId, updatedAt: new Date() }).where(eq(categories.id, id));
    await audit(actor, { action: 'category.updated', entity: 'category', entityId: id });
  } else {
    const newCategoryId = newId('cat_');
    await db.insert(categories).values({
      id: newCategoryId,
      slug: slugify(name),
      name,
      description,
      parentId,
      position: 50,
    });
    await audit(actor, { action: 'category.created', entity: 'category', entityId: newCategoryId });
  }
  revalidatePath('/admin/categories');
  revalidatePath('/catalogue');
  redirect('/admin/categories');
}

export async function saveBrandAction(formData: FormData) {
  const actor = await requirePermission('products.write').catch(() => null);
  if (!actor) redirect('/admin/categories');
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (name.length < 2) redirect('/admin/categories?erreur=marque');

  if (id) {
    await db.update(brands).set({ name, updatedAt: new Date() }).where(eq(brands.id, id));
  } else {
    await db.insert(brands).values({ id: newId('brd_'), slug: slugify(name), name });
  }
  await audit(actor, { action: id ? 'brand.updated' : 'brand.created', entity: 'brand', entityId: id || name });
  revalidatePath('/admin/categories');
  redirect('/admin/categories');
}
