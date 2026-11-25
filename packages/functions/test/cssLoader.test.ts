import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { generateLoaderCss, type LoaderOptions } from '../src/css';

const base: LoaderOptions = {
  color: '#2563eb',
  duration: 800,
  loaderSize: 48,
  preset: 'ring',
  thickness: 4,
  trackColor: '#cbd5e1',
};

describe('generateLoaderCss', () => {
  it('prints the ring with markup comment, keyframes, rule and reduced-motion block', () => {
    const css = generateLoaderCss(base);

    assert.ok(
      css.startsWith('/* <span class="loader" role="status" aria-label="Loading"></span> */'),
    );

    for (const part of [
      '@keyframes loader-ring',
      'border: 4px solid #cbd5e1;',
      'border-top-color: #2563eb;',
      'animation: loader-ring 800ms linear infinite;',
      'animation-duration: 2400ms;',
    ])
      assert.ok(css.includes(part), part);
  });

  it('prints dual-ring, bar and pulse', () => {
    assert.ok(
      generateLoaderCss({ ...base, preset: 'dual-ring' }).includes(
        'border-color: #2563eb transparent;',
      ),
    );

    const bar = generateLoaderCss({ ...base, preset: 'bar' });

    for (const part of [
      'width: 192px;',
      'background: linear-gradient(#2563eb 0 0) 0 0 / 40% 100% no-repeat, #cbd5e1;',
      'background-position: 166.67% 0;',
      'border-radius: 2px;',
    ])
      assert.ok(bar.includes(part), part);

    assert.doesNotMatch(generateLoaderCss({ ...base, preset: 'pulse' }), /border:/);
  });

  it('rejects non-color and non-opaque values', () => {
    assert.throws(() => generateLoaderCss({ ...base, color: 'rgb(0 0 0 / 50%)' }), /opaque/);
    assert.throws(() => generateLoaderCss({ ...base, trackColor: 'url(x)' }), /not supported/);
  });

  it('makes every preset a box, because the documented span is inline otherwise', () => {
    for (const preset of ['bar', 'dual-ring', 'pulse', 'ring'] as const)
      assert.match(
        generateLoaderCss({ ...base, preset }),
        /\.loader \{\n {2}display: inline-block;/,
      );
  });
});
