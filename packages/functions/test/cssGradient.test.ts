import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { generateGradientCss, parseGradientStops, type GradientOptions } from '../src/css';

const defaults: GradientOptions = {
  angle: 135,
  interpolation: 'default',
  positionX: 50,
  positionY: 50,
  repeating: false,
  shape: 'circle',
  stops: [
    { color: '#2563eb', position: 0 },
    { color: '#9333ea', position: 100 },
  ],
  type: 'linear',
};

describe('CSS gradient', () => {
  it('prints the default linear gradient exactly', () => {
    assert.deepEqual(generateGradientCss(defaults), {
      css: '.gradient {\n  background-image: linear-gradient(135deg, #2563eb 0%, #9333ea 100%);\n}',
      reordered: false,
    });
  });

  it('prints radial, conic and repeating forms', () => {
    assert.match(
      generateGradientCss({ ...defaults, type: 'radial' }).css,
      /radial-gradient\(circle at 50% 50%, #2563eb 0%/,
    );

    assert.match(
      generateGradientCss({ ...defaults, type: 'conic' }).css,
      /conic-gradient\(from 135deg at 50% 50%, #2563eb 0%/,
    );

    assert.match(
      generateGradientCss({ ...defaults, repeating: true }).css,
      /background-image: repeating-linear-gradient\(/,
    );

    assert.match(
      generateGradientCss({ ...defaults, positionX: 12.345, shape: 'ellipse', type: 'radial' }).css,
      /radial-gradient\(ellipse at 12\.35% 50%/,
    );
  });

  it('adds an interpolated line after the fallback', () => {
    const lines = generateGradientCss({ ...defaults, interpolation: 'oklch' })
      .css.split('\n')
      .filter((line) => line.includes('background-image'));

    assert.equal(lines.length, 2);
    assert.ok(!lines[0]?.includes(' in oklch'));
    assert.match(lines[1] ?? '', /linear-gradient\(135deg in oklch, #2563eb 0%/);

    assert.match(
      generateGradientCss({ ...defaults, interpolation: 'oklab', type: 'radial' }).css,
      /circle at 50% 50% in oklab, /,
    );

    assert.match(
      generateGradientCss({ ...defaults, angle: 0, interpolation: 'oklch', type: 'conic' }).css,
      /from 0deg at 50% 50% in oklch, /,
    );
  });

  it('sorts stops by position and reports the reorder', () => {
    const result = generateGradientCss({
      ...defaults,
      stops: [
        { color: 'red', position: 100 },
        { color: 'blue', position: 0 },
      ],
    });

    assert.match(result.css, /linear-gradient\(135deg, blue 0%, red 100%\)/);
    assert.equal(result.reordered, true);
  });

  it('parses valid stops and keeps colors as typed, trimmed', () => {
    assert.deepEqual(
      parseGradientStops(
        '[{"color":" oklch(62% 0.19 260) ","position":0},{"color":"red","position":0.29}]',
      ),
      [
        { color: 'oklch(62% 0.19 260)', position: 0 },
        { color: 'red', position: 0.29 },
      ],
    );
  });

  it('rejects malformed stops with a clear error', () => {
    const stop = (color: string, position: unknown) => ({ color, position });

    for (const [json, message] of [
      ['{}', /array of 2 to 8 stops/],
      ['[]', /array of 2 to 8 stops/],
      [JSON.stringify([stop('red', 0)]), /array of 2 to 8 stops/],
      [
        JSON.stringify(Array.from({ length: 9 }, (_, index) => stop('red', index))),
        /array of 2 to 8 stops/,
      ],
      [
        JSON.stringify([stop('red', 0), stop('blue', 101)]),
        /Stop 2 position must be a number between 0 and 100/,
      ],
      [
        JSON.stringify([stop('red', 0), stop('blue', '5')]),
        /Stop 2 position must be a number between 0 and 100/,
      ],
      [JSON.stringify([stop('red', 0), stop('blue', 1.234)]), /up to 2 decimals/],
      [JSON.stringify([stop('red; background: url(x)', 0), stop('blue', 1)]), /Stop 1 color/],
      [JSON.stringify([stop('2563eb', 0), stop('blue', 1)]), /Stop 1 color/],
      ['[{"__proto__":{"color":"red"},"position":0},{"color":"red","position":1}]', /Stop 1 /],
      ['[{"color":"red","position":0,"extra":1},{"color":"red","position":1}]', /Stop 1 /],
      ['not json', /valid JSON/],
    ] as const)
      assert.throws(() => parseGradientStops(json), message, json);
  });

  it('rejects stop JSON over 4,000 characters', () => {
    const json = `[{"color":"red","position":0},{"color":"blue","position":100}]${' '.repeat(4000)}`;

    assert.throws(() => parseGradientStops(json), /4,000/);
  });
});
