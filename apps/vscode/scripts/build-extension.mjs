import { build } from 'esbuild';
import { copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const figletPlugin = {
  name: 'figlet-cjs-entry',
  setup(buildContext) {
    buildContext.onResolve({ filter: /^figlet$/ }, () => ({
      path: require.resolve('figlet/dist/figlet.cjs'),
    }));
  },
};

await build({
  bundle: true,
  entryPoints: [join(projectRoot, 'src', 'extension.ts')],
  define: {
    'import.meta.url': '__filename',
  },
  external: ['vscode'],
  format: 'cjs',
  outfile: join(projectRoot, 'dist', 'extension.js'),
  platform: 'node',
  plugins: [figletPlugin],
  sourcemap: false,
  target: 'node20',
});

// MIT, LGPL and OFL require the license texts to travel with the bundled code.
copyFileSync(
  join(projectRoot, '..', '..', 'THIRD_PARTY_LICENSES.md'),
  join(projectRoot, 'dist', 'THIRD_PARTY_LICENSES.md'),
);
