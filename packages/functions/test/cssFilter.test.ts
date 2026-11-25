import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { filterFunctions, generateFilterCss, type FilterFunction } from '../src/css';

const identity = Object.fromEntries(
  filterFunctions.map((entry) => [entry.id, entry.identity]),
) as Record<FilterFunction, number>;

describe('generateFilterCss', () => {
  it('prints none when every function is at identity', () => {
    assert.equal(generateFilterCss(identity, 'filter'), '.filter {\n  filter: none;\n}');
  });

  it('omits identity functions and keeps the listed order', () => {
    assert.equal(
      generateFilterCss({ ...identity, brightness: 110, contrast: 120, saturate: 130 }, 'filter'),
      '.filter {\n  filter: brightness(110%) contrast(120%) saturate(130%);\n}',
    );

    assert.equal(
      generateFilterCss({ ...identity, 'hue-rotate': 90, blur: 4.5 }, 'filter'),
      '.filter {\n  filter: blur(4.5px) hue-rotate(90deg);\n}',
    );
  });

  it('prints the prefixed line first for backdrop-filter', () => {
    assert.equal(
      generateFilterCss({ ...identity, blur: 8 }, 'backdrop-filter'),
      '.filter {\n  -webkit-backdrop-filter: blur(8px);\n  backdrop-filter: blur(8px);\n}',
    );

    assert.equal(
      generateFilterCss(identity, 'backdrop-filter'),
      '.filter {\n  -webkit-backdrop-filter: none;\n  backdrop-filter: none;\n}',
    );
  });
});
