import { cookies } from 'next/headers';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { products, brands, categories } from '../db/schema';
import { env } from './env';
import { computeAvailability, computePricing, type Availability } from './pricing';
import { toFcfa } from './utils';
import { getStoreSettings } from './settings';

export type CartLineInput = { productId: string; quantity: number };

export type CartLine = {
  productId: string;
  sku: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  brandName: string | null;
  categoryName: string | null;
  unitPrice: number;
  basePrice: number;
  onPromo: boolean;
  discountPercent: number;
  quantity: number;
  available: number;
  stock: number;
  allowPreorder: boolean;
  availability: Availability;
  lineTotal: number;
  issue: string | null;
};

export type CartSummary = {
  lines: CartLine[];
  itemCount: number;
  distinctCount: number;
  subtotal: number;
  hasIssues: boolean;
  isEmpty: boolean;
};

const MAX_LINES = 60;
const MAX_QTY = 999;

/** Lit le panier depuis le cookie httpOnly. Le contenu n'est jamais considéré comme fiable. */
export async function readCart(): Promise<CartLineInput[]> {
  const store = await cookies();
  const raw = store.get(env.cartCookieName)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((i): i is { productId: string; quantity: number } =>
        Boolean(i && typeof (i as CartLineInput).productId === 'string' && Number.isFinite((i as CartLineInput).quantity)),
      )
      .map((i) => ({ productId: i.productId, quantity: Math.min(MAX_QTY, Math.max(1, Math.trunc(i.quantity))) }))
      .slice(0, MAX_LINES);
  } catch {
    return [];
  }
}

export async function writeCart(items: CartLineInput[]) {
  const store = await cookies();
  const cleaned = items
    .filter((i) => i.productId && i.quantity > 0)
    .map((i) => ({ productId: i.productId, quantity: Math.min(MAX_QTY, Math.trunc(i.quantity)) }))
    .slice(0, MAX_LINES);

  if (cleaned.length === 0) {
    store.delete(env.cartCookieName);
    return;
  }
  store.set(env.cartCookieName, encodeURIComponent(JSON.stringify(cleaned)), {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

/**
 * Recalcule entièrement le panier côté serveur à partir de la base :
 * prix, promotions, disponibilité. Les prix du navigateur ne sont jamais utilisés.
 */
/**
 * Normalise une liste de lignes fournie par le client : entiers positifs,
 * quantités bornées, doublons fusionnés. Aucune valeur du navigateur n'est
 * utilisée telle quelle pour le calcul des montants.
 */
export function sanitizeCartItems(items: CartLineInput[]): CartLineInput[] {
  const merged = new Map<string, number>();
  for (const item of items) {
    if (!item || typeof item.productId !== 'string' || item.productId.length === 0) continue;
    const raw = Number(item.quantity);
    // Quantité nulle ou négative = tentative de manipulation : la ligne est ignorée.
    if (!Number.isFinite(raw) || raw < 1) continue;
    const quantity = Math.min(MAX_QTY, Math.floor(raw));
    merged.set(item.productId, Math.min(MAX_QTY, (merged.get(item.productId) ?? 0) + quantity));
  }
  return [...merged.entries()].slice(0, MAX_LINES).map(([productId, quantity]) => ({ productId, quantity }));
}

export async function getCartSummary(items?: CartLineInput[]): Promise<CartSummary> {
  const lines = sanitizeCartItems(items ?? (await readCart()));
  if (lines.length === 0) {
    return { lines: [], itemCount: 0, distinctCount: 0, subtotal: 0, hasIssues: false, isEmpty: true };
  }

  const settings = await getStoreSettings();
  const defaultThreshold = settings.lowStockThreshold;

  const ids = [...new Set(lines.map((l) => l.productId))];
  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      slug: products.slug,
      name: products.name,
      price: products.price,
      promoPrice: products.promoPrice,
      promoStartsAt: products.promoStartsAt,
      promoEndsAt: products.promoEndsAt,
      stock: products.stock,
      reserved: products.reserved,
      lowStockThreshold: products.lowStockThreshold,
      allowPreorder: products.allowPreorder,
      isActive: products.isActive,
      isArchived: products.isArchived,
      brandName: brands.name,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(inArray(products.id, ids), eq(products.isActive, true), eq(products.isArchived, false)));

  const byId = new Map(rows.map((r) => [r.id, r]));

  // Image principale récupérée séparément (une seule requête pour toutes les lignes).
  const imageRows = ids.length
    ? await db.execute(sql`
        SELECT DISTINCT ON (product_id) product_id, url
        FROM product_images
        WHERE product_id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
        ORDER BY product_id, position ASC
      `)
    : { rows: [] as Record<string, unknown>[] };

  const imageById = new Map<string, string>();
  for (const r of imageRows.rows as Record<string, unknown>[]) {
    imageById.set(String(r.product_id), String(r.url));
  }

  const result: CartLine[] = [];
  let subtotal = 0;
  let hasIssues = false;

  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product) {
      hasIssues = true;
      continue;
    }
    const pricing = computePricing(product);
    const availability = computeAvailability(product, defaultThreshold);
    let quantity = line.quantity;
    let issue: string | null = null;

    if (!availability.canOrder) {
      // La ligne reste visible pour que le client puisse la retirer, mais elle
      // n'entre pas dans le total : un produit épuisé n'est jamais facturé.
      issue = 'Produit épuisé — retirez-le de votre panier.';
      hasIssues = true;
      result.push({
        productId: product.id,
        sku: product.sku,
        slug: product.slug,
        name: product.name,
        imageUrl: imageById.get(product.id) ?? null,
        brandName: product.brandName ?? null,
        categoryName: product.categoryName ?? null,
        unitPrice: pricing.price,
        basePrice: pricing.basePrice,
        onPromo: pricing.onPromo,
        discountPercent: pricing.discountPercent,
        quantity,
        available: 0,
        stock: product.stock,
        allowPreorder: product.allowPreorder,
        availability: availability.state,
        lineTotal: 0,
        issue,
      });
      continue;
    } else if (availability.state !== 'PREORDER' && quantity > availability.available) {
      issue = `Seulement ${availability.available} unité(s) disponible(s). Quantité ajustée.`;
      quantity = availability.available;
      hasIssues = true;
    }

    const lineTotal = pricing.price * quantity;
    subtotal += lineTotal;

    result.push({
      productId: product.id,
      sku: product.sku,
      slug: product.slug,
      name: product.name,
      imageUrl: imageById.get(product.id) ?? null,
      brandName: product.brandName ?? null,
      categoryName: product.categoryName ?? null,
      unitPrice: pricing.price,
      basePrice: pricing.basePrice,
      onPromo: pricing.onPromo,
      discountPercent: pricing.discountPercent,
      quantity,
      available: availability.available,
      stock: product.stock,
      allowPreorder: product.allowPreorder,
      availability: availability.state,
      lineTotal,
      issue,
    });
  }

  return {
    lines: result,
    itemCount: result.reduce((sum, l) => sum + l.quantity, 0),
    distinctCount: result.length,
    subtotal,
    hasIssues,
    isEmpty: result.length === 0,
  };
}

export function cartToPayload(summary: CartSummary) {
  return summary.lines.map((l) => ({ productId: l.productId, quantity: l.quantity }));
}

export function subtotalFrom(summary: CartSummary) {
  return toFcfa(summary.subtotal);
}
