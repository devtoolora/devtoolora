import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { testSemverRange } from '../src/dev';

describe('semver range', () => {
  const desugar = (range: string, includePrerelease = false) =>
    testSemverRange(range, '', { includePrerelease }).desugared;
  const matches = (range: string, version: string, includePrerelease = false) =>
    testSemverRange(range, version, { includePrerelease }).rows[0]?.status === 'match';

  it('lets a partial tilde range reach prereleases when they are included', () => {
    assert.equal(desugar('~1.2', true), '>=1.2.0-0 <1.3.0-0');
    assert.equal(desugar('~1', true), '>=1.0.0-0 <2.0.0-0');
    assert.equal(desugar('~1.x', true), '>=1.0.0-0 <2.0.0-0');
    assert.equal(desugar('~1.2.3', true), '>=1.2.3 <1.3.0-0');
    assert.equal(desugar('~0', true), '<1.0.0-0');
    assert.equal(desugar('~0.0', true), '<0.1.0-0');
    assert.equal(matches('~1.2', '1.2.0-rc.1', true), true);
    assert.equal(matches('~1.2', '1.2.0-rc.1'), false);
  });

  it('desugars npm ranges like node-semver', () => {
    const vectors: Array<[string, string]> = [
      ['^1.2.3', '>=1.2.3 <2.0.0-0'],
      ['^0.2.3', '>=0.2.3 <0.3.0-0'],
      ['^0.0.3', '>=0.0.3 <0.0.4-0'],
      ['^1.2.x', '>=1.2.0 <2.0.0-0'],
      ['^0.0.x', '<0.1.0-0'],
      ['^0.0', '<0.1.0-0'],
      ['^1.x', '>=1.0.0 <2.0.0-0'],
      ['^0.x', '<1.0.0-0'],
      ['~1.2.3', '>=1.2.3 <1.3.0-0'],
      ['~1.2', '>=1.2.0 <1.3.0-0'],
      ['~1', '>=1.0.0 <2.0.0-0'],
      ['~>1.2', '>=1.2.0 <1.3.0-0'],
      ['~1.2.3-beta.2', '>=1.2.3-beta.2 <1.3.0-0'],
      ['1.2.3 - 2.3.4', '>=1.2.3 <=2.3.4'],
      ['1.2 - 2.3.4', '>=1.2.0 <=2.3.4'],
      ['1.2.3 - 2.3', '>=1.2.3 <2.4.0-0'],
      ['1.2.3 - 2', '>=1.2.3 <3.0.0-0'],
      ['*', '*'],
      ['', '*'],
      ['1.x', '>=1.0.0 <2.0.0-0'],
      ['1.2.x', '>=1.2.0 <1.3.0-0'],
      ['>1.2', '>=1.3.0'],
      ['>1', '>=2.0.0'],
      ['<1.2', '<1.2.0-0'],
      ['<=1.2', '<1.3.0-0'],
      ['>= 1.2.3', '>=1.2.3'],
      ['>=1.2.3 <2 || 3.x', '>=1.2.3 <2.0.0-0 || >=3.0.0 <4.0.0-0'],
      ['=1.2.3', '1.2.3'],
      ['v1.2.3', '1.2.3'],
    ];

    for (const [range, expected] of vectors) assert.equal(desugar(range), expected, range);

    assert.throws(() => desugar('^01.2.3'), {
      message: 'Invalid range: ^01.2.3 is not a valid comparator.',
    });

    assert.throws(() => desugar('1.2.3 || garbage'), {
      message: 'Invalid range: garbage is not a valid comparator.',
    });

    assert.throws(() => desugar('1'.repeat(1_025)), {
      message: 'Range is limited to 1,024 characters.',
    });
  });

  it('simplifies null and any sets like node-semver', () => {
    const vectors: Array<[string, string]> = [
      ['>*', '<0.0.0-0'],
      ['1.2.3 || <0.0.0-0', '1.2.3'],
      ['<0.0.0-0 || >*', '<0.0.0-0'],
      ['* || 1.2.3', '*'],
      ['1.2.3 *', '1.2.3'],
      [' >= 1.2.3  <  2 ', '>=1.2.3 <2.0.0-0'],
      ['^ 1.2', '>=1.2.0 <2.0.0-0'],
      ['1.2.3+build.5 - 2.0.0', '>=1.2.3 <=2.0.0'],
      ['>=0.0.0 <1', '<1.0.0-0'],
    ];

    for (const [range, expected] of vectors) assert.equal(desugar(range), expected, range);

    assert.throws(() => desugar('>'), { message: 'Invalid range: > is not a valid comparator.' });
  });

  it('lowers partial bounds when prereleases are included', () => {
    assert.equal(desugar('^1.2', true), '>=1.2.0-0 <2.0.0-0');
    assert.equal(desugar('1.2.3 - 2.3.4', true), '>=1.2.3-0 <2.3.5-0');
    assert.equal(desugar('1.2 - 2.x', true), '>=1.2.0-0 <3.0.0-0');
    assert.equal(desugar('1.x', true), '>=1.0.0-0 <2.0.0-0');
    assert.equal(desugar('>=0.0.0-0 <1', true), '<1.0.0-0');
    assert.equal(matches('^1.2', '1.2.0-rc.1', true), true);
  });

  it('applies the prerelease rule', () => {
    assert.equal(matches('>1.2.3-alpha.3', '1.2.3-alpha.7'), true);
    assert.equal(matches('>1.2.3-alpha.3', '3.4.5-alpha.9'), false);
    assert.equal(matches('~1.2.3-beta.2', '1.2.3-beta.4'), true);
    assert.equal(matches('~1.2.3-beta.2', '1.2.4-beta.2'), false);
    assert.equal(matches('^1.2.3', '1.5.0-rc.1'), false);
    assert.equal(matches('^1.2.3', '1.5.0-rc.1', true), true);
    assert.equal(matches('^1.2.3', '2.0.0-rc.1', true), false);
  });

  it('reports every line and the highest and lowest match', () => {
    const report = testSemverRange('^1.2.3', '1.2.3\nv1.4.0\n\n2.0.0\n1.2', {
      includePrerelease: false,
    });

    assert.deepEqual(
      report.rows.map((row) => [row.line, row.status, row.version]),
      [
        [1, 'match', '1.2.3'],
        [2, 'match', '1.4.0'],
        [4, 'no match', '2.0.0'],
        [5, 'invalid', undefined],
      ],
    );

    assert.match(report.rows[3]?.reason ?? '', /complete SemVer/);
    assert.equal(report.highest, '1.4.0');
    assert.equal(report.lowest, '1.2.3');

    assert.throws(
      () => testSemverRange('*', '1.0.0\n'.repeat(10_001), { includePrerelease: false }),
      { message: 'Versions are limited to 10,000 lines.' },
    );
  });

  it('keeps going past prerelease and invalid lines', () => {
    const report = testSemverRange('>=1.0.0', '2.0.0-rc.1\r\nnope\r\n1.0.0+build.1\r\n', {
      includePrerelease: false,
    });

    assert.deepEqual(
      report.rows.map((row) => [row.input, row.status, row.version]),
      [
        ['2.0.0-rc.1', 'no match', '2.0.0-rc.1'],
        ['nope', 'invalid', undefined],
        ['1.0.0+build.1', 'match', '1.0.0+build.1'],
      ],
    );

    assert.equal(report.highest, '1.0.0+build.1');

    assert.equal(
      testSemverRange('*', '1.0.0\n'.repeat(10_000), { includePrerelease: false }).rows.length,
      10_000,
    );

    assert.equal(testSemverRange('^2', '1.0.0', { includePrerelease: false }).highest, undefined);
  });
});
