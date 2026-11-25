import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { compareSemanticVersions } from '../src/dev';

describe('exact SemVer comparison', () => {
  it('follows the specification precedence chain in both directions', () => {
    const sequence = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0',
      '2.0.0',
      '2.1.0',
      '2.1.1',
    ];

    for (let index = 0; index < sequence.length; index += 1) {
      for (let other = 0; other < sequence.length; other += 1) {
        const comparison = compareSemanticVersions(sequence[index]!, sequence[other]!);

        assert.equal(comparison.comparison, Math.sign(index - other));

        assert.equal(
          comparison.result,
          index === other ? 'equal' : index > other ? 'left is newer' : 'right is newer',
        );
      }
    }
  });

  it('distinguishes equal precedence from identical text and retains parsed identifiers', () => {
    const report = compareSemanticVersions(' \t1.2.3-alpha.1+001.sha\r\n', '1.2.3-alpha.1+002.sha');

    assert.equal(report.comparison, 0);
    assert.equal(report.identical, false);
    assert.equal(report.criterion, 'equal');
    assert.deepEqual(report.left.core, ['1', '2', '3']);
    assert.deepEqual(report.left.prerelease, ['alpha', '1']);
    assert.deepEqual(report.left.build, ['001', 'sha']);
    assert.equal(report.left.input, ' \t1.2.3-alpha.1+001.sha\r\n');
    assert.equal(report.left.version, '1.2.3-alpha.1+001.sha');
    assert.equal(compareSemanticVersions('1.2.3', '1.2.3').identical, true);
  });

  it('compares exact large numbers and nonnumeric identifiers in ASCII order', () => {
    assert.equal(
      compareSemanticVersions('9007199254740993.0.0', '9007199254740992.0.0').comparison,
      1,
    );

    assert.equal(
      compareSemanticVersions('1.0.0-9007199254740993', '1.0.0-9007199254740992').comparison,
      1,
    );

    assert.equal(compareSemanticVersions('1.9.0', '1.10.0').comparison, -1);
    assert.equal(compareSemanticVersions('1.0.0-Alpha', '1.0.0-alpha').comparison, -1);
    assert.equal(compareSemanticVersions('1.0.0-01x', '1.0.0-1').comparison, 1);
    assert.equal(compareSemanticVersions('1.0.0--', '1.0.0-0').comparison, 1);
    const large = '9'.repeat(1020) + '.0.0';

    assert.equal(compareSemanticVersions(large, large).comparison, 0);
  });

  it('rejects complete invalid versions on either side instead of accepting prefixes', () => {
    const invalid = [
      '',
      '1',
      '1.2',
      'v1.2.3',
      '=1.2.3',
      '^1.2.3',
      '1.2.*',
      '1.2.3.4',
      '01.2.3',
      '1.02.3',
      '1.2.03',
      '1.2.3-01',
      '1.2.3-a.01',
      '1.2.3-',
      '1.2.3+',
      '1.2.3-a..b',
      '1.2.3+a..b',
      '1.2.3+💥',
      '1.2.3\u0000',
      '1.2.3junk',
      '\u00A01.2.3',
      '1.2.3\u2028',
      '9'.repeat(1025),
    ];

    for (const version of invalid) {
      assert.throws(() => compareSemanticVersions(version, '1.2.3'), /Left version/);
      assert.throws(() => compareSemanticVersions('1.2.3', version), /Right version/);
    }

    assert.equal(compareSemanticVersions('0.0.0-0+00', '0.0.0-0+0').comparison, 0);
  });

  it('explains the decisive component', () => {
    assert.equal(compareSemanticVersions('1.0.0', '2.0.0').criterion, 'major');
    assert.equal(compareSemanticVersions('1.0.0', '1.1.0').criterion, 'minor');
    assert.equal(compareSemanticVersions('1.0.0', '1.0.1').criterion, 'patch');
    assert.equal(compareSemanticVersions('1.0.0-a', '1.0.0').criterion, 'release');
    assert.equal(compareSemanticVersions('1.0.0-a', '1.0.0-b').criterion, 'prerelease-identifier');
    assert.equal(compareSemanticVersions('1.0.0-a', '1.0.0-a.1').criterion, 'prerelease-length');
  });
});
