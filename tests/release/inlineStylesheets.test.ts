import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { inlineStylesheets } from '../../scripts/vite/inline-stylesheets';

const PAGE = `<head><link rel="stylesheet" href="/assets/a.css"/><link rel="stylesheet" href="/assets/b.css#"/></head>`;
const STYLESHEETS: Record<string, string> = { '/assets/a.css': 'A', '/assets/b.css': 'B' };

function readFixture(href: string): string {
  const css = STYLESHEETS[href];

  if (css === undefined) throw new Error(`Unexpected stylesheet ${href}.`);

  return css;
}

describe('inline stylesheets', () => {
  it('inlines each stylesheet before its link and keeps cascade order', () => {
    const html = inlineStylesheets(PAGE, readFixture);
    const styleA = html.indexOf('<style data-inline-href="/assets/a.css">A</style>');
    const linkA = html.indexOf('href="/assets/a.css"');
    const styleB = html.indexOf('<style data-inline-href="/assets/b.css">B</style>');
    const linkB = html.indexOf('href="/assets/b.css#"');

    assert.ok(styleA !== -1 && styleB !== -1, html);
    assert.ok(styleA < linkA && linkA < styleB && styleB < linkB, html);
  });

  it('keeps the links for hydration but stops them blocking', () => {
    const html = inlineStylesheets(PAGE, readFixture);

    assert.match(html, /<link rel="stylesheet" href="\/assets\/a\.css" media="print"\/>/);
    assert.match(html, /<link rel="stylesheet" href="\/assets\/b\.css#" media="print"\/>/);
  });

  it('strips the trailing hash when reading', () => {
    const hrefs: string[] = [];

    inlineStylesheets(PAGE, (href) => {
      hrefs.push(href);

      return readFixture(href);
    });

    assert.deepEqual(hrefs, ['/assets/a.css', '/assets/b.css']);
  });

  it('refuses stylesheets that would close the style element', () => {
    assert.throws(() => inlineStylesheets(PAGE, () => 'a{}</style><script>'), /close/);
  });

  it('refuses relative url() references that would break at the page path', () => {
    assert.throws(() => inlineStylesheets(PAGE, () => 'a{background:url(font.woff2)}'), /relative/);

    assert.doesNotThrow(() =>
      inlineStylesheets(PAGE, () => 'a{background:url("/assets/font.woff2"),url(data:x)}'),
    );
  });

  it('prerendered pages have no render-blocking stylesheets', () => {
    const webRoot = join(process.cwd(), 'out/web');
    const pages = readdirSync(webRoot, { recursive: true, encoding: 'utf8' }).filter((file) =>
      file.endsWith('.html'),
    );

    assert.ok(pages.length > 0, 'out/web has no HTML pages; run npm run build:web.');

    for (const page of pages) {
      const html = readFileSync(join(webRoot, page), 'utf8');
      const blocking = html.match(/<link rel="stylesheet"(?![^>]*media="print")[^>]*>/g) ?? [];

      assert.deepEqual(blocking, [], `${page} has render-blocking stylesheets.`);
      assert.ok(html.includes('<style data-inline-href='), `${page} has no inline stylesheet.`);
    }
  });
});
