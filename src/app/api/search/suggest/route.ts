import { NextResponse } from 'next/server';
import { suggest } from '@/lib/search';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').slice(0, 120);

  const limit = rateLimit(`suggest:${request.headers.get('x-forwarded-for') ?? 'local'}`, 60, 60);
  if (!limit.allowed) {
    return NextResponse.json({ suggestions: [] }, { status: 429 });
  }

  if (query.trim().length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const suggestions = await suggest(query, 8);
    return NextResponse.json(
      { suggestions },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[api/search/suggest]', error);
    return NextResponse.json({ suggestions: [] }, { status: 500 });
  }
}
