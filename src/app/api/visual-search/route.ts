import { NextResponse } from 'next/server';
import { searchByImage, providerInfo } from '@/lib/visual';
import { recordSearch } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Recherche visuelle : l'image est comparée aux photos du catalogue.
 * L'image de requête n'est jamais conservée : elle est traitée en mémoire.
 */
export async function POST(request: Request) {
  const provider = providerInfo();
  if (!provider.available) {
    return NextResponse.json({ available: false, reason: provider.note, provider }, { status: 503 });
  }

  const ip = request.headers.get('x-forwarded-for') ?? 'local';
  const limit = rateLimit(`visual:${ip}`, 12, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { available: true, error: 'Trop de recherches par photo. Patientez une minute.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const file = formData.get('image');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Aucune image reçue.' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Image vide.' }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: `Image trop lourde (max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} Mo).` }, { status: 413 });
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return NextResponse.json({ error: 'Format non supporté (JPEG, PNG, WebP ou AVIF).' }, { status: 415 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await searchByImage(buffer, file.type, 8);

    if (!result.available) {
      return NextResponse.json({ available: false, reason: result.reason, provider: result.provider });
    }

    const user = await getCurrentUser().catch(() => null);
    await recordSearch('[photo]', result.matches.length, 'VISUAL', user?.id).catch(() => undefined);

    return NextResponse.json(
      {
        available: true,
        provider: result.provider,
        confident: result.confident,
        calibrated: result.calibrated,
        message: result.message,
        matches: result.matches.map((match) => ({
          id: match.product.id,
          name: match.product.name,
          slug: match.product.slug,
          sku: match.product.sku,
          price: match.product.effectivePrice,
          promoPrice: match.product.promoPrice,
          onPromo: match.product.onPromo,
          imageUrl: match.product.imageUrl,
          brandName: match.product.brandName,
          stock: match.product.stock,
          reserved: match.product.reserved,
          score: match.score,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[visual-search]', error);
    return NextResponse.json({ error: 'La recherche visuelle a échoué. Réessayez avec une autre photo.' }, { status: 500 });
  }
}
