import type { Config } from '@react-router/dev/config';
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { writeServiceWorker } from '../../scripts/vite/service-worker';
import { optimizePrerenderedPages, writeCrawlerFiles } from '../../scripts/vite/web-output';
import { webToolAliases, webToolMetadata } from './src/toolMetadata.generated';

const projectRoot = join(import.meta.dirname, '../..');
const buildDirectory = join(import.meta.dirname, 'build');
const webOutDir = join(projectRoot, 'out', 'web');
const shellPages = ['/', '/tools', '/apps', '/extension', '/about'];
const publicPaths = [...shellPages, ...webToolMetadata.map((tool) => `/tools/${tool.slug}`)];
const prerenderPaths = [
  ...publicPaths,
  ...webToolAliases.map((tool) => `/tools/${tool.slug}`),
  '/desktop',
];
const figletFontFiles = new Set<string>(
  JSON.parse(
    readFileSync(join(projectRoot, 'packages', 'tools', 'src', 'figletFontNames.json'), 'utf8'),
  ).map((font: string) => `${font}.js`),
);

function siteOrigin(): string | undefined {
  const value = process.env.SITE_URL?.trim();

  if (!value) return undefined;

  const url = new URL(value);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('SITE_URL must use http or https.');
  }

  return url.origin;
}

export default {
  appDirectory: 'src',
  buildDirectory: 'build',
  serverModuleFormat: 'cjs',
  ssr: false,
  routeDiscovery: { mode: 'initial' },
  prerender: { paths: prerenderPaths, concurrency: 4 },
  async buildEnd() {
    rmSync(webOutDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    mkdirSync(webOutDir, { recursive: true });
    cpSync(join(buildDirectory, 'client'), webOutDir, { recursive: true });
    optimizePrerenderedPages(webOutDir);

    writeServiceWorker(
      webOutDir,
      shellPages,
      (file) => !file.startsWith('desktop-') && !figletFontFiles.has(file),
    );

    writeCrawlerFiles(webOutDir, publicPaths, siteOrigin());
  },
} satisfies Config;
