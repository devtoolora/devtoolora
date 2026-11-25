import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  generateClipShapeCss,
  generateFlexboxCss,
  generateGridCss,
  generateKeyframesCss,
  generateShadowCss,
  generateTextShadowCss,
  parseTextShadowLayers,
  generateTriangleCss,
} from '@devtoolora/functions/css';

describe('CSS functions', () => {
  it('generates independent grid, flexbox, and visual CSS values', () => {
    assert.match(
      generateGridCss({
        columns: 3,
        rows: 2,
        columnGap: 16,
        rowGap: 16,
        minTrack: 120,
        autoFlow: 'row',
        justifyItems: 'stretch',
        alignItems: 'stretch',
        justifyContent: 'stretch',
        alignContent: 'stretch',
      }),
      /repeat\(3, minmax\(120px, 1fr\)\)/,
    );

    assert.match(
      generateFlexboxCss({
        direction: 'row',
        wrap: 'wrap',
        justify: 'center',
        align: 'center',
        alignContent: 'stretch',
        gap: 16,
        grow: 1,
        shrink: 1,
        basis: 120,
        order: 0,
      }),
      /flex: 1 1 120px/,
    );

    assert.match(
      generateShadowCss([{ x: 0, y: 12, blur: 28, spread: 0, color: '#000', inset: false }]),
      /box-shadow/,
    );

    assert.match(generateTriangleCss(48, 'up', '#2563eb'), /border-bottom/);

    assert.match(
      generateClipShapeCss({
        kind: 'polygon',
        points: [
          [50, 0],
          [100, 100],
          [0, 100],
        ],
      }),
      /polygon/,
    );
  });

  it('generates animation CSS', () => {
    assert.match(
      generateKeyframesCss({
        name: 'fade-in',
        preset: 'fade-up',
        distance: 16,
        scale: 90,
        opacity: 0,
        duration: 600,
        delay: 0,
        iterations: '1',
        direction: 'normal',
        fillMode: 'both',
        easing: 'ease-out',
      }),
      /@keyframes fade-in/,
    );
  });

  it('generates text-shadow CSS from validated layers in input order', () => {
    const one = '[{"x":2,"y":2,"blur":4,"color":"rgba(15, 23, 42, 0.35)"}]';

    assert.equal(
      generateTextShadowCss(parseTextShadowLayers(one)),
      '.text {\n  text-shadow: 2px 2px 4px rgba(15, 23, 42, 0.35);\n}',
    );

    assert.match(
      generateTextShadowCss([
        { blur: 0, color: '#000', x: 0, y: 1.456 },
        { blur: 8, color: '#fff', x: -3, y: 0 },
      ]),
      /text-shadow: 0px 1\.46px 0px #000, -3px 0px 8px #fff;/,
    );
  });

  it('rejects invalid text-shadow layers', () => {
    const layer = { blur: 4, color: '#000', x: 2, y: 2 };
    const bad = [
      JSON.stringify(Array.from({ length: 6 }, () => layer)),
      JSON.stringify([{ ...layer, x: 101 }]),
      JSON.stringify([{ ...layer, blur: -1 }]),
      JSON.stringify([{ ...layer, spread: 0 }]),
      JSON.stringify([{ ...layer, color: 'red' }]),
      '{"x":1}',
      'nope',
    ];

    for (const json of bad) assert.throws(() => parseTextShadowLayers(json), json);
  });
});
