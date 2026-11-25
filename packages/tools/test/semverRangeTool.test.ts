import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { semverRangeTool } from '../src/catalog/devUtilities';
import { contentOf } from './toolContent';
import { fieldsOf } from './tools.helpers';

describe('semver range tool', () => {
  it('declares its fields', () => {
    assert.equal(semverRangeTool.id, 'semver-range');
    assert.equal(semverRangeTool.name, 'Semver Range Tester');
    assert.equal(semverRangeTool.category, 'Dev Utilities');
    assert.equal(semverRangeTool.inputKind, 'text');
    assert.equal(semverRangeTool.outputKind, 'text');

    assert.deepEqual(
      semverRangeTool.fields?.map(({ defaultValue, id, label, type }) => [
        id,
        label,
        type,
        defaultValue,
      ]),
      [
        ['range', 'Range', 'text', undefined],
        ['includePrerelease', 'Include prereleases', 'checkbox', 'false'],
      ],
    );

    assert.equal(semverRangeTool.fields?.[0]?.required, true);
    assert.equal(fieldsOf(semverRangeTool)?.[0]?.placeholder, '^1.2.3');

    assert.deepEqual(semverRangeTool.relatedToolIds, [
      'semver-compare',
      'sort-lines',
      'conventional-commit',
    ]);

    assert.equal(contentOf(semverRangeTool).faq?.length, 5);
    assert.ok((semverRangeTool.samples?.length ?? 0) >= 6);
  });

  it('marks every version line and exports the text', async () => {
    const result = await semverRangeTool.run({
      fields: { includePrerelease: 'false', range: '^1.2.3' },
      text: '1.2.3\nv1.4.0\n\n2.0.0\n1.2',
    });

    assert.equal(result.summary, '2 of 4 versions match · highest 1.4.0 · lowest 1.2.3.');
    assert.equal(result.language, 'plaintext');
    assert.equal(result.artifact?.fileName, 'semver-range.txt');

    assert.equal(
      result.text,
      [
        'Range: >=1.2.3 <2.0.0-0',
        '',
        '✓ 1.2.3',
        '✓ v1.4.0',
        '✗ 2.0.0',
        '! 1.2 — Version line 5 must be a complete SemVer such as 1.2.3 or 1.2.3-beta.1+build.7. No v prefix, ranges, missing parts or leading zeroes in core numbers.',
      ].join('\n'),
    );

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );
  });

  it('includes prereleases when asked', async () => {
    const fields = { includePrerelease: 'false', range: '^1.2.3' };
    const without = await semverRangeTool.run({ fields, text: '1.5.0-rc.1' });
    const withPrereleases = await semverRangeTool.run({
      fields: { ...fields, includePrerelease: 'true' },
      text: '1.5.0-rc.1',
    });

    assert.equal(without.summary, '0 of 1 version matches.');

    assert.equal(
      withPrereleases.summary,
      '1 of 1 version matches · highest 1.5.0-rc.1 · lowest 1.5.0-rc.1.',
    );
  });

  it('runs every sample', async () => {
    for (const sample of semverRangeTool.samples ?? []) {
      const result = await semverRangeTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.match(result.text ?? '', /^Range: /);
    }
  });

  it('reports invalid ranges and checkbox values', async () => {
    await assert.rejects(
      async () => semverRangeTool.run({ fields: { range: '1.2.3 || garbage' }, text: '1.2.3' }),
      { message: 'Invalid range: garbage is not a valid comparator.' },
    );

    await assert.rejects(
      async () =>
        semverRangeTool.run({
          fields: { includePrerelease: 'yes', range: '^1.2.3' },
          text: '1.2.3',
        }),
      { message: 'Checkbox values must be true or false.' },
    );
  });
});
