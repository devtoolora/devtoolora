import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';

const STYLES_DIR = 'apps/web/src/styles';
const ALLOWED_CLASSES = ['page-frame', 'sr-only'];
const REMOVED_FILES = [
  'decorations.css',
  'hero.css',
  'home.css',
  'responsive.css',
  'sections.css',
  'tools.css',
];

function selectorClasses(css: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...withoutComments.matchAll(/([^{};]+)\{/g)]
    .map(([, selector = '']) => selector.trim())
    .filter((selector) => !selector.startsWith('@'));

  return selectors.flatMap((selector) =>
    [...selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(([, name = '']) => name),
  );
}

describe('global web styles', () => {
  it('keeps only the shared utility classes global', () => {
    const classes = new Set(
      readdirSync(STYLES_DIR)
        .filter((file) => /\.(css|scss)$/.test(file))
        .flatMap((file) => selectorClasses(readFileSync(join(STYLES_DIR, file), 'utf8'))),
    );

    const unexpected = [...classes].filter((name) => !ALLOWED_CLASSES.includes(name)).sort();

    assert.deepEqual(unexpected, []);
  });

  it('removes the page stylesheets', () => {
    for (const file of REMOVED_FILES) assert.equal(existsSync(join(STYLES_DIR, file)), false, file);
  });
});
