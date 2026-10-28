import { afterAll, beforeAll } from 'vitest';
import { pool } from '@/db';

/**
 * La base de test doit avoir été préparée avec `npm run test:setup`.
 * Chaque fichier de test part d'un état vide (TRUNCATE) pour être reproductible.
 */
beforeAll(async () => {
  const result = await pool.query<{ exists: boolean }>(
    "SELECT to_regclass('public.products') IS NOT NULL AS exists",
  );
  if (!result.rows[0]?.exists) {
    throw new Error(
      'Base de test non initialisée. Lancez `npm run test:setup` (ou `npm run db:local` puis `npm run test:setup`).',
    );
  }
});

afterAll(async () => {
  await pool.end().catch(() => undefined);
});
