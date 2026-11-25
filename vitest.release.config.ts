import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config';

// The release tests the base config leaves out; run them after `npm run build`.
const releaseTests = (baseConfig.test?.exclude ?? []).filter((path) =>
  path.startsWith('tests/release/'),
);

export default defineConfig({
  ...baseConfig,
  test: { ...baseConfig.test, exclude: ['**/node_modules/**'], include: releaseTests },
});
