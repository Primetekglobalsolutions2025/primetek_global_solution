import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    maxWorkers: 1,
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 70,
        statements: 70,
      },
      include: [
        'src/lib/auth.ts',
        'src/lib/offline-queue.ts',
        'src/lib/supabase-admin.ts',
        'src/lib/validations.ts',
        'src/lib/security/risk-engine.ts',
        'src/lib/security/device-detect.ts',
        'src/lib/security/device-trust.ts',
        'src/lib/audit.ts',
      ],
    },
  },
});
