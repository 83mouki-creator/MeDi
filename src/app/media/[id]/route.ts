import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { storedImages } from '@/db/schema';

/**
 * Sert une photo conservée en base (voir `src/lib/storage.ts`).
 *
 * URL : `/media/<id>.webp` — l'extension est décorative, elle n'est pas stockée.
 * Le contenu est immuable (une ligne ne change jamais) : le cache navigateur et
 * CDN peut donc être très long, ce qui évite de relire la base à chaque affichage.
 */
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clean = id.replace(/\.(webp|png|jpe?g)$/i, '');

  if (!/^[A-Za-z0-9_-]{4,64}$/.test(clean)) {
    return new Response('Image introuvable', { status: 404 });
  }

  let row: { mimeType: string; data: Buffer } | undefined;
  try {
    const rows = await db
      .select({ mimeType: storedImages.mimeType, data: storedImages.data })
      .from(storedImages)
      .where(eq(storedImages.id, clean))
      .limit(1);
    row = rows[0];
  } catch (error) {
    console.error('[media] lecture impossible', clean, error);
    return new Response('Image momentanément indisponible', { status: 503 });
  }

  if (!row) return new Response('Image introuvable', { status: 404 });

  // `Buffer` est une vue sur un ArrayBuffer plus grand : on isole la plage utile.
  const bytes = new Uint8Array(row.data.byteLength);
  bytes.set(row.data);

  return new Response(bytes.buffer, {
    status: 200,
    headers: {
      'Content-Type': row.mimeType || 'image/webp',
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
