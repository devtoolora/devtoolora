import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  clipShapeFromFields,
  generateClipShapeCss,
  generateRadiusCss,
  generateTriangleCss,
  parsePolygonPoints,
} from '../src/css';

describe('CSS shapes', () => {
  it('preserves corner order and rejects flooring or range overflow', () => {
    assert.match(generateRadiusCss(0, 32, 8, 200), /border-radius: 0px 32px 8px 200px/);
    for (const number of [-1, 201, 1.5, Infinity])
      assert.throws(() => generateRadiusCss(number, 0, 0, 0));
  });

  it('generates exact border directions and validates literal colors', () => {
    for (const [direction, border] of [
      ['up', 'bottom'],
      ['down', 'top'],
      ['left', 'right'],
      ['right', 'left'],
    ])
      assert.match(
        generateTriangleCss(24, direction!, 'rgba(37,99,235,0.25)'),
        new RegExp(`border-${border}: 24px solid rgba`),
      );
    assert.match(generateTriangleCss(200, 'up', '#1234'), /200px solid #1234/);
    for (const color of ['', '#12345', 'rgba(0,0,0,2)', 'rgb(256,0,0)', 'red;display:none'])
      assert.throws(() => generateTriangleCss(10, 'up', color));
    assert.throws(() => generateTriangleCss(10, 'unknown', '#fff'));
    assert.throws(() => generateTriangleCss(1.5, 'up', '#fff'));
  });

  it('bounds and normalizes polygon pairs without silent coercion or fallback', () => {
    const points = parsePolygonPoints('[[0,0],[50.125,0],[100,100]]');

    assert.deepEqual(points, [
      [0, 0],
      [50.13, 0],
      [100, 100],
    ]);

    assert.match(
      generateClipShapeCss({ kind: 'polygon', points }),
      /polygon\(0% 0%, 50.13% 0%, 100% 100%\)/,
    );

    assert.equal(
      parsePolygonPoints(JSON.stringify(Array.from({ length: 64 }, () => [0, 0]))).length,
      64,
    );

    for (const raw of [
      'bad',
      '[]',
      '[null,[0,0],[100,100]]',
      '[["0",0],[50,0],[100,100]]',
      '[[0,0,1],[50,0],[100,100]]',
      '[[-1,0],[50,0],[100,100]]',
      '[[0,0],[50,0],[100,101]]',
      JSON.stringify(Array.from({ length: 65 }, () => [0, 0])),
      'x'.repeat(10001),
    ])
      assert.throws(() => parsePolygonPoints(raw));

    assert.throws(() =>
      generateClipShapeCss({
        kind: 'polygon',
        points: [
          [0, 0],
          [Infinity, 1],
          [1, 1],
        ],
      }),
    );
  });

  it('writes circle, ellipse and inset shapes with an optional -webkit- line', () => {
    assert.equal(
      generateClipShapeCss(clipShapeFromFields({ shape: 'circle' })),
      '.element {\n  clip-path: circle(50% at 50% 50%);\n}',
    );

    assert.equal(
      generateClipShapeCss(
        clipShapeFromFields({ centerX: '40.125', radiusX: '30', radiusY: '20', shape: 'ellipse' }),
        { webkit: true },
      ),
      '.element {\n  -webkit-clip-path: ellipse(30% 20% at 40.13% 50%);\n  clip-path: ellipse(30% 20% at 40.13% 50%);\n}',
    );

    assert.match(
      generateClipShapeCss(
        clipShapeFromFields({ insetLeft: '5', insetRound: '12', insetTop: '0', shape: 'inset' }),
      ),
      /clip-path: inset\(0% 10% 10% 5% round 12px\);/,
    );

    assert.match(
      generateClipShapeCss(clipShapeFromFields({ shape: 'inset' })),
      /inset\(10% 10% 10% 10%\);/,
    );

    for (const fields of [
      { radius: '101', shape: 'circle' },
      { centerY: '-1', shape: 'circle' },
      { radiusX: '', shape: 'ellipse' },
      { insetBottom: '50', insetTop: '50', shape: 'inset' },
      { insetLeft: '60', insetRight: '40', shape: 'inset' },
      { insetRound: '201', shape: 'inset' },
      { radius: '1e2', shape: 'circle' },
      { shape: 'star' },
    ])
      assert.throws(
        () =>
          clipShapeFromFields(fields).kind === 'polygon' ||
          generateClipShapeCss(clipShapeFromFields(fields)),
        JSON.stringify(fields),
      );
  });
});
