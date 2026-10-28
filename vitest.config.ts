import { defineConfig } from 'vitest/config';
import path from 'node:path';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://medi:medi@127.0.0.1:55432/medi_test';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    setupFiles: ['tests/setup.ts'],
    // Une seule base de test : les fichiers ne doivent pas s'exécuter en parallèle.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      APP_URL: 'http://localhost:3000',
      SESSION_SECRET: 'test-secret-not-for-production-0123456789',
      VISION_PROVIDER: 'local',
      STORAGE_DRIVER: 'local',
      STORAGE_LOCAL_DIR: 'public/uploads',
      STORAGE_PUBLIC_BASE: '/uploads',
      WAVE_MODE: 'MANUAL',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
