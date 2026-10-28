import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || 'postgres://medi:medi@127.0.0.1:55432/medi',
  },
  verbose: true,
  strict: false,
});
