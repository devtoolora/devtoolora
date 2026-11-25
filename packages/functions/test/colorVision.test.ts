import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  parsePalette,
  simulatePalette,
  splitPalette,
  visionGridSvg,
} from '@devtoolora/functions/color';
import { machado2009 } from '../src/color/machado2009';

const sim = (text: string, severity: number, type: 'achromat' | 'deutan' | 'protan' | 'tritan') =>
  simulatePalette(parsePalette(`${text}, #ffffff`), { severity, types: [type] }).rows[1]?.colors[0];

describe('color vision', () => {
  it('matches the simulation vectors', () => {
    assert.equal(sim('#ff0000', 100, 'deutan'), '#a39000');
    assert.equal(sim('#ff0000', 100, 'protan'), '#6d5f00');
    assert.equal(sim('#ff0000', 100, 'tritan'), '#ff000f');
    assert.equal(sim('#ff0000', 100, 'achromat'), '#7f7f7f');
    assert.equal(sim('#2563eb', 50, 'deutan'), '#0065ea');
  });

  it('flags hard-to-tell pairs', () => {
    const run = (text: string, severity = 100) =>
      simulatePalette(parsePalette(text), {
        severity,
        types: ['protan', 'deutan', 'tritan', 'achromat'],
      }).pairs;
    const green = run('#2ca02c, #d62728')[0];

    assert.ok(green?.flags.includes('deutan'));
    assert.ok(!green?.flags.includes('protan'));
    assert.equal(Math.round((green?.deltaE.deutan ?? 0) * 1000) / 1000, 0.041);
    assert.deepEqual(run('#1f77b4, #ff7f0e'), []);
    assert.deepEqual(run('#ff0000, #00ff00', 0), []);
    assert.deepEqual(run('#101010, #111111')[0]?.flags, ['close for everyone']);
  });

  it('keeps the distance of every pair, flagged or not', () => {
    const result = simulatePalette(parsePalette('#2ca02c, #d62728, #1f77b4'), {
      severity: 100,
      types: ['deutan'],
    });

    assert.deepEqual(
      result.distances.map((pair) => [pair.a, pair.b, pair.flags]),
      [
        [0, 1, ['deutan']],
        [0, 2, []],
        [1, 2, []],
      ],
    );

    assert.deepEqual(result.pairs, [result.distances[0]]);
    assert.ok(result.distances.every((pair) => pair.deltaE.normal > 0 && pair.deltaE.deutan > 0));
  });

  it('draws colors as rows and names the hard-to-tell partner in that view', () => {
    const result = simulatePalette(parsePalette('#2ca02c, #d62728'), {
      severity: 100,
      types: ['protan', 'deutan'],
    });
    const svg = visionGridSvg(result);

    assert.match(svg, /^<svg [^>]*width="200"/);
    assert.equal(svg.match(/>≈2</g)?.length, 1);
    assert.equal(svg.match(/>≈1</g)?.length, 1);
    assert.match(svg, />≈2: hard to tell apart/);
  });

  it('splits palettes without breaking functions', () => {
    assert.deepEqual(splitPalette('rgb(1, 2, 3), #fff\n red'), ['rgb(1, 2, 3)', '#fff', 'red']);
  });

  it('rejects invalid palettes', () => {
    const opts = { severity: 100, types: ['deutan' as const] };

    assert.throws(() => simulatePalette(parsePalette('#fff'), opts), /2-12 colors/);

    assert.throws(
      () => simulatePalette(parsePalette(Array(13).fill('#fff').join(',')), opts),
      /2-12 colors/,
    );

    assert.throws(() => simulatePalette(parsePalette('rgba(0,0,0,0.5), #fff'), opts), /opaque/);
    assert.throws(() => simulatePalette(parsePalette('#000, #fff'), { ...opts, types: [] }));
  });

  it('rejects off-step severities', () => {
    for (const severity of [55, 110, -10])
      assert.throws(
        () => simulatePalette(parsePalette('#000, #fff'), { severity, types: ['deutan'] }),
        /steps of 10/,
      );
  });

  it('ships 11 matrices per type starting at the identity', () => {
    for (const matrices of Object.values(machado2009)) {
      assert.equal(matrices.length, 11);

      assert.deepEqual(matrices[0], [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ]);
    }
  });
});
