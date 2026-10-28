import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';
import { resolveDatabaseUrl, resolveDirectUrl } from './src/lib/db-url';

config({ path: '.env.local' });
config({ path: '.env' });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: {
    // Même résolution que les migrations : DIRECT_URL, sinon les noms posés par
    // l'intégration Neon sur Vercel, sinon la dérivation de l'URL poolée.
    url:
      resolveDirectUrl() ||
      resolveDatabaseUrl() ||
      'postgres://medi:medi@127.0.0.1:55432/medi',
  },
  verbose: true,
  strict: false,
});
