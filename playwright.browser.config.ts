import { defineConfig, devices } from '@playwright/test';

const previewPort = Number(process.env.DEV_TOOLORA_TEST_PORT || '4173');

if (!Number.isInteger(previewPort) || previewPort < 1 || previewPort > 65535)
  throw new Error('DEV_TOOLORA_TEST_PORT must be an integer from 1 through 65535.');

const isGate = Boolean(process.env.DEV_TOOLORA_GATE);
const previewUrl = `http://127.0.0.1:${previewPort}`;

export default defineConfig({
  testDir: '.',
  testMatch: ['apps/web/tests/browser/**/*.spec.ts', 'apps/vscode/test/browser/**/*.spec.ts'],
  // The slowest real test takes 16 s; a hung test must not cost two minutes.
  timeout: 30_000,
  use: {
    baseURL: previewUrl,
    // The hero renders through SwiftShader in headless Chromium and keeps the shared GPU busy;
    // tests that assert running animations opt back out.
    contextOptions: { reducedMotion: 'reduce' },
  },
  webServer: {
    command: `vite preview --config apps/web/vite.preview.config.ts --host 127.0.0.1 --port ${previewPort} --strictPort`,
    url: previewUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      ...(isGate ? { grep: /@gate/ } : { grepInvert: /@gate/ }),
    },
    ...(isGate ? [{ name: 'webkit', use: { ...devices['Desktop Safari'] }, grep: /@gate/ }] : []),
  ],
});
