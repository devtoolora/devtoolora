import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { inlineStylesheets } from './inline-stylesheets';

// Prerendered pages paint without JavaScript; hydration must not compete with fonts.
const MODULE_PRELOAD = /(<link rel="modulepreload" href="[^"]+")\/>/g;

export function optimizePrerenderedPages(outDir: string): void {
  const readStylesheet = (href: string) => readFileSync(join(outDir, href.slice(1)), 'utf8');
  const pages = readdirSync(outDir, { encoding: 'utf8', recursive: true }).filter((file) =>
    file.endsWith('.html'),
  );

  for (const page of pages) {
    const pagePath = join(outDir, page);

    const html = inlineStylesheets(readFileSync(pagePath, 'utf8'), readStylesheet);

    writeFileSync(pagePath, html.replace(MODULE_PRELOAD, '$1 fetchpriority="low"/>'));
  }
}

export function writeCrawlerFiles(outDir: string, publicPaths: string[], origin?: string): void {
  const robots = origin
    ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
    : 'User-agent: *\nAllow: /\n';

  writeFileSync(join(outDir, 'robots.txt'), robots);

  if (!origin) return;

  const urls = publicPaths.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join('\n');

  writeFileSync(
    join(outDir, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
}
