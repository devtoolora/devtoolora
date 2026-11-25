import { defineConfig } from 'vitest/config';
import { webAliases } from './scripts/vite/web-aliases';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: { alias: webAliases },
  test: {
    include: [
      'packages/*/test/**/*.test.{ts,tsx}',
      'apps/vscode/test/**/*.test.{ts,tsx}',
      'apps/web/test/**/*.test.{ts,tsx}',
      'tests/release/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.spec.ts',
      // These read out/web and apps/vscode/dist; `npm run test:release` runs them after a build.
      'tests/release/inlineStylesheets.test.ts',
      'tests/release/packageVerification.*.test.ts',
      'tests/release/vscodeWebviewBuild.test.ts',
    ],
    coverage: {
      include: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx,js}'],
      reporter: ['text-summary', 'html'],
      // Measured floor minus one point; raise it as coverage grows.
      thresholds: { branches: 70, functions: 78, lines: 82, statements: 74 },
    },
    environment: 'node',
    globals: false,
    testTimeout: 60_000,
  },
});
