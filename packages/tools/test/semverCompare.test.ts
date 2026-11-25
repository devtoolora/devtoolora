import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { semverCompareTool } from '../src/catalog/devUtilities';
import { contentOf } from './toolContent';

describe('Semver Compare tool', () => {
  it('reports exact precedence, parsed version strings, reason and JSON artifact', async () => {
    const result = await semverCompareTool.run({
      fields: { left: '2.0.0-beta.1', right: '2.0.0' },
      text: '',
    });
    const report = JSON.parse(result.text);

    assert.equal(report.comparison, -1);
    assert.equal(report.result, 'right is newer');
    assert.equal(report.criterion, 'release');
    assert.deepEqual(report.left.core, ['2', '0', '0']);
    assert.match(result.summary ?? '', /Right has higher precedence.*final release/);
    assert.equal(result.artifact?.fileName, 'semver-comparison.json');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    assert.deepEqual(semverCompareTool.resultActions, ['copy', 'scratch', 'save']);
  });

  it('provides complete samples, documentation and equal-build precedence', async () => {
    assert.equal(contentOf(semverCompareTool).documentation?.length, 2);
    assert.equal(semverCompareTool.samples?.length, 12);

    for (const sample of semverCompareTool.samples ?? []) {
      assert.deepEqual(Object.keys(sample.fields ?? {}).sort(), ['left', 'right']);
      const result = await semverCompareTool.run({ fields: sample.fields ?? {}, text: '' });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );
    }

    const equal = await semverCompareTool.run({
      fields: { left: '1.0.0+001', right: '1.0.0+002' },
      text: '',
    });

    assert.match(equal.summary ?? '', /Equal precedence.*Build metadata is ignored/);
    assert.equal(JSON.parse(equal.text).identical, false);
  });

  it('rejects missing or invalid fields with side-specific actionable errors', async () => {
    await assert.rejects(
      async () => semverCompareTool.run({ fields: {}, text: '' }),
      /Left version.*complete SemVer/,
    );

    await assert.rejects(
      async () => semverCompareTool.run({ fields: { left: '1.2.3', right: '1.2.3-01' }, text: '' }),
      /Right version.*leading zeroes/,
    );
  });
});
