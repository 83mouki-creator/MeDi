import { createHash, randomBytes, createHash as sha1 } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { env } from './env';
import { slugify } from './utils';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export const MAX_IMAGE_BYTES = Number(process.env.UPLOAD_MAX_BYTES ?? 5 * 1024 * 1024);

export type StoredImage = {
  url: string;
  publicId: string | null;
  width: number;
  height: number;
  bytes: number;
  checksum: string;
  filename: string;
};

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/** Valide un fichier image : type MIME, taille, et contenu réellement décodable. */
export async function validateImage(file: File): Promise<Buffer> {
  if (!file || file.size === 0) throw new UploadError('Fichier vide.');
  if (file.size > MAX_IMAGE_BYTES) {
    throw new UploadError(`Image trop lourde (max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} Mo).`);
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new UploadError('Format non supporté. Utilisez JPEG, PNG, WebP ou AVIF.');
  }
  const buffer = Buffer.from(await file.arrayBuffer());

  // Vérification du contenu réel (protège contre un fichier renommé).
  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.format || !['jpeg', 'png', 'webp', 'avif'].includes(meta.format)) {
      throw new UploadError('Le contenu du fichier n’est pas une image valide.');
    }
    if ((meta.width ?? 0) < 200 || (meta.height ?? 0) < 200) {
      throw new UploadError('Image trop petite (minimum 200 × 200 px).');
    }
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError('Image illisible ou corrompue.');
  }

  return buffer;
}

/** Normalise l'image : redimensionnement borné, conversion WebP, fond blanc pour la transparence. */
export async function normalizeImage(buffer: Buffer) {
  const pipeline = sharp(buffer, { failOn: 'error' })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .webp({ quality: 82, effort: 4 });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export async function storeImage(input: {
  file: File;
  /** nom de fichier de base (sans extension) ; slugifié */
  name?: string;
  folder?: string;
}): Promise<StoredImage> {
  const original = await validateImage(input.file);
  const checksum = createHash('sha256').update(original).digest('hex');
  const { data, width, height } = await normalizeImage(original);

  const base = slugify(input.name?.replace(/\.[a-z0-9]+$/i, '') ?? input.file.name.replace(/\.[a-z0-9]+$/i, '')) || 'image';
  const unique = `${base}-${randomBytes(4).toString('hex')}`;

  if (env.storage.driver === 'cloudinary' && env.storage.cloudinary.cloudName) {
    return cloudinaryUpload({ data, filename: unique, folder: input.folder ?? env.storage.cloudinary.folder, width, height, checksum });
  }

  const dir = path.join(process.cwd(), env.storage.localDir);
  await mkdir(dir, { recursive: true });
  const filename = `${unique}.webp`;
  await writeFile(path.join(dir, filename), data);

  return {
    url: `${env.storage.publicBase}/${filename}`,
    publicId: filename,
    width,
    height,
    bytes: data.byteLength,
    checksum,
    filename: `${unique}.webp`,
  };
}

async function cloudinaryUpload(params: {
  data: Buffer;
  filename: string;
  folder: string;
  width: number;
  height: number;
  checksum: string;
}): Promise<StoredImage> {
  const { cloudName, apiKey, apiSecret } = env.storage.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) throw new UploadError('Cloudinary non configuré.');

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = params.folder;
  const signature = sha1(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest('hex');

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(params.data)], { type: 'image/webp' }), `${params.filename}.webp`);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(30_000),
  });

  const json = (await response.json()) as { secure_url?: string; public_id?: string; width?: number; height?: number; bytes?: number; error?: { message?: string } };
  if (!response.ok || !json.secure_url) {
    throw new UploadError(json.error?.message ?? 'Échec du téléversement Cloudinary.');
  }

  return {
    url: json.secure_url,
    publicId: json.public_id ?? null,
    width: json.width ?? params.width,
    height: json.height ?? params.height,
    bytes: json.bytes ?? params.data.byteLength,
    checksum: params.checksum,
    filename: `${params.filename}.webp`,
  };
}

/** Supprime un fichier local (uniquement pour le driver `local`). */
export async function deleteStoredImage(publicId: string | null, url: string) {
  if (env.storage.driver !== 'local') return;
  const target = publicId ?? path.basename(url);
  if (!target || target.includes('..') || target.includes('/')) return;
  try {
    await unlink(path.join(process.cwd(), env.storage.localDir, target));
  } catch {
    // Fichier déjà absent : rien à faire.
  }
}

export function storageInfo() {
  return {
    driver: env.storage.driver,
    configured: env.storage.configured,
    note:
      env.storage.driver === 'local'
        ? 'Stockage local (public/uploads). En production Vercel, configurez Cloudinary : le système de fichiers y est éphémère.'
        : 'Cloudinary configuré.',
  };
}
