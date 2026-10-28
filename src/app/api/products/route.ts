import { NextResponse } from 'next/server';
import { getProductsByIds } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get('ids') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id.length < 60)
    .slice(0, 20);

  if (ids.length === 0) return NextResponse.json({ products: [] });

  try {
    const products = await getProductsByIds(ids);
    return NextResponse.json({ products }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[api/products]', error);
    return NextResponse.json({ products: [] }, { status: 500 });
  }
}
