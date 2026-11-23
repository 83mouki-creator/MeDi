import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { env } from './env';
import { getProductsByIds, type ProductCard } from './catalog';

/**
 * Recherche visuelle.
 *
 * Le descripteur par défaut (`local`) est calculé dans l'application avec sharp :
 * grille de couleurs 3×3 + histogramme RGB + densité de contours. C'est une
 * véritable comparaison d'images (pas une simulation), mais elle reste un
 * descripteur perceptif bas de gamme : elle retrouve bien un produit photographié
 * sous un autre angle avec le même fond, et classe des alternatives proches en
 * couleur/forme. Elle ne « comprend » pas l'objet.
 *
 * Pour une reconnaissance robuste, configurez un fournisseur d'embeddings de
 * vision (VISION_PROVIDER=http, modèle type CLIP) : même interface, vecteurs
 * sémantiques, score calibré. Voir docs/RECHERCHE-VISUELLE.md.
 */

export type VisualProviderInfo = {
  id: 'local' | 'http' | 'none';
  label: string;
  dim: number | null;
  available: boolean;
  semantic: boolean;
  note: string;
};

export type VisualMatch = {
  product: ProductCard;
  score: number;
  imageUrl: string | null;
  imageId: string;
};

export type VisualSearchResult =
  | {
      available: true;
      provider: VisualProviderInfo;
      matches: VisualMatch[];
      /** true si le meilleur score atteint le seuil de « correspondance probable » */
      confident: boolean;
      /**
       * true uniquement pour un fournisseur sémantique (embeddings calibrés).
       * Avec le descripteur local, aucun résultat n'est présenté comme certain.
       */
      calibrated: boolean;
      message: string;
      alternatives: VisualMatch[];
    }
  | { available: false; provider: VisualProviderInfo; reason: string };

export const LOCAL_MODEL_ID = 'medi-local-descriptor-v1';
const LOCAL_DIM = 27 + 24 + 16; // 67

// ─────────────────────────── Descripteur local ───────────────────────────

async function localDescriptor(buffer: Buffer): Promise<number[]> {
  const { data } = await sharp(buffer)
    .rotate()
    .resize(64, 64, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const size = 64;
  const channels = 3;
  const px = (x: number, y: number, c: number) => data[(y * size + x) * channels + c] ?? 0;

  // 1) moyenne RGB sur une grille 3×3 (27 valeurs)
  const gridMeans: number[] = [];
  for (let gy = 0; gy < 3; gy++) {
    for (let gx = 0; gx < 3; gx++) {
      const sums = [0, 0, 0];
      let count = 0;
      for (let y = gy * 21; y < (gy + 1) * 21; y++) {
        for (let x = gx * 21; x < (gx + 1) * 21; x++) {
          for (let c = 0; c < 3; c++) sums[c]! += px(x, y, c);
          count++;
        }
      }
      for (let c = 0; c < 3; c++) gridMeans.push(sums[c]! / Math.max(1, count) / 255);
    }
  }

  // 2) histogramme RGB (8 classes par canal = 24 valeurs)
  const histogram: number[] = [];
  for (let c = 0; c < 3; c++) {
    const bins = new Array(8).fill(0);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const bucket = Math.min(7, Math.floor((px(x, y, c) / 256) * 8));
        bins[bucket] += 1;
      }
    }
    const total = size * size;
    for (const b of bins) histogram.push(b / total);
  }

  // 3) densité de contours sur une grille 4×4 (16 valeurs)
  const edges: number[] = [];
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      let sum = 0;
      let count = 0;
      for (let y = gy * 16; y < (gy + 1) * 16 - 1; y++) {
        for (let x = gx * 16; x < (gx + 1) * 16 - 1; x++) {
          const gray = (i: number, j: number) => (px(i, j, 0) * 0.299 + px(i, j, 1) * 0.587 + px(i, j, 2) * 0.114);
          const dx = Math.abs(gray(x + 1, y) - gray(x, y));
          const dy = Math.abs(gray(x, y + 1) - gray(x, y));
          sum += dx + dy;
          count++;
        }
      }
      edges.push(Math.min(1, sum / Math.max(1, count) / 64));
    }
  }

  return l2Normalize([...gridMeans, ...histogram, ...edges]);
}

// ─────────────────────────── Fournisseur HTTP (CLIP, etc.) ───────────────────────────

async function httpEmbedding(buffer: Buffer, mime: string): Promise<{ vector: number[]; model: string }> {
  if (!env.vision.apiUrl) throw new Error('VISION_API_URL manquant.');
  const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
  const response = await fetch(env.vision.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.vision.apiKey ? { Authorization: `Bearer ${env.vision.apiKey}` } : {}),
    },
    body: JSON.stringify({ model: env.vision.model, input: [dataUrl] }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Fournisseur d’embeddings visuels : HTTP ${response.status}`);
  }
  const json = (await response.json()) as {
    embedding?: number[];
    data?: { embedding: number[] }[];
    embeddings?: number[][];
  };
  const vector = json.embedding ?? json.data?.[0]?.embedding ?? json.embeddings?.[0];
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error('Réponse du fournisseur d’embeddings invalide.');
  }
  return { vector: l2Normalize(vector.map((v) => Number(v) || 0)), model: env.vision.model };
}

// ─────────────────────────── API publique ───────────────────────────

export function providerInfo(): VisualProviderInfo {
  if (env.vision.provider === 'none') {
    return {
      id: 'none',
      label: 'Recherche visuelle désactivée',
      dim: null,
      available: false,
      semantic: false,
      note: 'VISION_PROVIDER=none : la fonctionnalité est désactivée par configuration.',
    };
  }
  if (env.vision.provider === 'http') {
    return {
      id: 'http',
      label: `Modèle de vision (${env.vision.model})`,
      dim: env.vision.dim ?? null,
      available: Boolean(env.vision.apiUrl),
      semantic: true,
      note: env.vision.apiUrl
        ? 'Embeddings sémantiques fournis par le modèle de vision configuré.'
        : 'VISION_PROVIDER=http mais VISION_API_URL est absent : configurez l’URL du service d’embeddings.',
    };
  }
  return {
    id: 'local',
    label: 'Descripteur visuel intégré (couleurs + contours)',
    dim: LOCAL_DIM,
    available: true,
    semantic: false,
    note: 'Descripteur perceptif calculé localement : compare réellement les images, sans modèle de vision profond. Configurez VISION_PROVIDER=http pour une reconnaissance sémantique.',
  };
}

export async function embedImage(buffer: Buffer, mime = 'image/jpeg'): Promise<{ vector: number[]; model: string; dim: number }> {
  const info = providerInfo();
  if (!info.available) throw new Error(info.note);

  if (info.id === 'http') {
    const { vector, model } = await httpEmbedding(buffer, mime);
    return { vector, model, dim: vector.length };
  }
  const vector = await localDescriptor(buffer);
  return { vector, model: LOCAL_MODEL_ID, dim: vector.length };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function l2Normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}

async function loadImageBuffer(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith('/')) {
      const filePath = path.join(process.cwd(), 'public', url.replace(/^\//, ''));
      return await readFile(filePath);
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

/** Calcule et enregistre l'embedding d'une image produit (ou d'un média importé). */
export async function indexImage(params: { imageId: string; url: string; table?: 'product_images' | 'media_assets' }) {
  const table = params.table ?? 'product_images';
  const buffer = await loadImageBuffer(params.url);
  if (!buffer) return { ok: false as const, reason: 'image_illisible' };

  const { vector, model, dim } = await embedImage(buffer);
  const json = JSON.stringify(vector);

  if (table === 'product_images') {
    await db.execute(sql`
      UPDATE product_images SET embedding = ${json}::jsonb, embedding_model = ${model},
        embedding_dim = ${dim}, embedding_at = now() WHERE id = ${params.imageId}
    `);
  } else {
    await db.execute(sql`
      UPDATE media_assets SET embedding = ${json}::jsonb, embedding_model = ${model} WHERE id = ${params.imageId}
    `);
  }

  // Copie optionnelle dans pgvector si l'extension est présente (Neon la propose).
  await upsertVector(params.imageId, table, vector, model).catch(() => undefined);
  return { ok: true as const, dim, model };
}

async function upsertVector(imageId: string, table: string, vector: number[], model: string) {
  const literal = `[${vector.join(',')}]`;
  await db.execute(sql`
    INSERT INTO product_image_vectors (image_id, source_table, model, dim, embedding)
    VALUES (${imageId}, ${table}, ${model}, ${vector.length}, ${literal}::vector)
    ON CONFLICT (image_id, model) DO UPDATE SET embedding = EXCLUDED.embedding, dim = EXCLUDED.dim
  `);
}

type Candidate = {
  image_id: string;
  product_id: string;
  url: string;
  alt: string | null;
  embedding: number[];
};

async function loadCandidates(): Promise<Candidate[]> {
  const rows = await db.execute(sql`
    SELECT pi.id AS image_id, pi.product_id, pi.url, pi.alt, pi.embedding
    FROM product_images pi
    JOIN products p ON p.id = pi.product_id
    WHERE pi.embedding IS NOT NULL AND p.is_active = true AND p.is_archived = false
    LIMIT 20000
  `);
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    image_id: String(r.image_id),
    product_id: String(r.product_id),
    url: String(r.url),
    alt: (r.alt as string | null) ?? null,
    embedding: r.embedding as number[],
  }));
}

const CONFIDENT_THRESHOLD = 0.82;
/** Seuil du descripteur local : plus bas car les scores y sont comprimés. */
const LOCAL_SUGGESTIVE_FLOOR = 0.75;
const SUGGESTIVE_THRESHOLD = 0.62;

/**
 * Compare une photo envoyée par le client aux photos du catalogue.
 * Retourne le produit le plus proche, puis des alternatives.
 */
export async function searchByImage(buffer: Buffer, mime: string, limit = 8): Promise<VisualSearchResult> {
  const provider = providerInfo();
  if (!provider.available) {
    return { available: false, provider, reason: provider.note };
  }

  const { vector } = await embedImage(buffer, mime);
  const candidates = await loadCandidates();

  if (candidates.length === 0) {
    return {
      available: false,
      provider,
      reason: 'La recherche par photo est momentanément indisponible. Utilisez la recherche par mots-clés ou écrivez-nous sur WhatsApp.',
    };
  }

  const bestPerProduct = new Map<string, { score: number; imageId: string; url: string }>();
  for (const candidate of candidates) {
    const embedding = Array.isArray(candidate.embedding) ? candidate.embedding : [];
    const score = cosineSimilarity(vector, embedding);
    const current = bestPerProduct.get(candidate.product_id);
    if (!current || score > current.score) {
      bestPerProduct.set(candidate.product_id, { score, imageId: candidate.image_id, url: candidate.url });
    }
  }

  const ranked = [...bestPerProduct.entries()]
    .map(([productId, value]) => ({ productId, ...value }))
    .sort((a, b) => b.score - a.score);

  // Le descripteur local produit des scores comprimés (vecteurs tous positifs) :
  // on garde le seuil « suggestif » pour ne pas afficher des produits sans rapport.
  const floor = provider.semantic ? SUGGESTIVE_THRESHOLD : LOCAL_SUGGESTIVE_FLOOR;
  const aboveThreshold = ranked.filter((r) => r.score >= floor).slice(0, limit);
  const pool = aboveThreshold.length > 0 ? aboveThreshold : ranked.slice(0, Math.min(3, limit));
  const margin = ranked.length > 1 ? ranked[0]!.score - ranked[1]!.score : 1;

  const cards = await getProductsByIds(pool.map((r) => r.productId));
  const cardById = new Map(cards.map((c) => [c.id, c]));

  const matches: VisualMatch[] = pool
    .map((r): VisualMatch | null => {
      const product = cardById.get(r.productId);
      if (!product) return null;
      return { product, score: Math.round(r.score * 1000) / 1000, imageUrl: r.url, imageId: r.imageId };
    })
    .filter((m): m is VisualMatch => m !== null);

  const best = matches[0];
  const topScore = best?.score ?? 0;
  // Un fournisseur non sémantique (descripteur local) ne permet jamais d'affirmer
  // qu'il s'agit du même produit : on parle alors de pistes à vérifier.
  const confident = provider.semantic && topScore >= CONFIDENT_THRESHOLD;
  const calibrated = provider.semantic;

  const flat = margin < 0.02;
  const message = !best
    ? 'Aucun produit proche n’a été trouvé. Essayez une photo plus nette, sur fond neutre, ou écrivez-nous sur WhatsApp.'
    : confident
      ? `Correspondance probable : ${best.product.name} (${Math.round(best.score * 100)} % de ressemblance visuelle).`
      : `Ressemblances possibles : ${best.product.name} arrive en tête (${Math.round(best.score * 100)} %). Vérifiez la référence, les dimensions et la matière avant de commander.${flat ? ' Plusieurs articles se ressemblent sur les photos : confirmez avec la recherche par référence.' : ''}`;

  return {
    available: true,
    provider,
    matches,
    confident,
    calibrated,
    message,
    alternatives: matches.slice(1, 5),
  };
}

export function visualThresholds() {
  return { confident: CONFIDENT_THRESHOLD, suggestive: SUGGESTIVE_THRESHOLD };
}
