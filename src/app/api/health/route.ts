import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { providerInfo } from '@/lib/visual';
import { waveStatus } from '@/lib/wave';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Sonde de santé pour la supervision (Vercel / uptime).
 * N'expose aucun secret : seulement des états booléens et des compteurs.
 */
export async function GET() {
  const started = Date.now();
  let database = false;
  let productCount: number | null = null;
  let error: string | null = null;

  try {
    const result = await db.execute(sql`SELECT count(*)::int AS n FROM products WHERE is_active AND NOT is_archived`);
    productCount = (result.rows as { n: number }[])[0]?.n ?? 0;
    database = true;
  } catch (cause) {
    error = cause instanceof Error ? cause.message.slice(0, 120) : 'base indisponible';
  }

  const wave = waveStatus();
  const vision = providerInfo();

  return NextResponse.json(
    {
      status: database ? 'ok' : 'degraded',
      checks: {
        database,
        storage: env.storage.configured ? (env.storage.driver === 'cloudinary' ? 'cloudinary' : 'local') : 'non configuré',
        wave: wave.mode,
        visualSearch: vision.available ? vision.id : 'indisponible',
      },
      catalogue: { publishedProducts: productCount },
      environment: env.nodeEnv,
      latencyMs: Date.now() - started,
      ...(error ? { error } : {}),
    },
    {
      status: database ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
