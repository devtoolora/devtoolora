import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { chmodCalculatorTool } from '../src/catalog/devUtilities';
import { contentOf } from './toolContent';

describe('chmod Calculator tool', () => {
  it('renders the permission table and exports exact JSON without source replacement', async () => {
    const result = await chmodCalculatorTool.run({ fields: {}, text: '4644' });

    assert.ok(result.jsonTable);
    assert.equal(result.jsonTable.presentation, 'plain');
    assert.deepEqual(result.jsonTable.rows[0], ['owner', 'Yes', 'Yes', 'No', 'setuid', 'rwS']);
    assert.match(result.summary ?? '', /4644 = rwSr--r--.*setuid/);
    assert.equal(result.artifact?.fileName, 'chmod-report.json');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    assert.deepEqual(chmodCalculatorTool.resultActions, ['copy', 'scratch', 'save']);
    const report = JSON.parse(result.text);

    assert.equal(report.originalInput, '4644');
    assert.equal(report.groups.owner.execute, false);
    assert.equal(report.symbolic.owner, 'rwS');
  });

  it('provides complete samples, guides and a report-only view', async () => {
    assert.equal(contentOf(chmodCalculatorTool).documentation?.length, 2);
    assert.equal(chmodCalculatorTool.samples?.length, 14);

    for (const sample of chmodCalculatorTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 1);
      const result = await chmodCalculatorTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );
    }

    const result = await chmodCalculatorTool.run({ fields: { output: 'report' }, text: ' 0755 ' });

    assert.equal(result.jsonTable, undefined);
    assert.equal(JSON.parse(result.text).originalInput, ' 0755 ');
    assert.equal(JSON.parse(result.text).fullOctal, '0755');
  });

  it('validates input and output options before returning an audit', async () => {
    await assert.rejects(
      async () => chmodCalculatorTool.run({ fields: {}, text: '888' }),
      /octal digits/,
    );

    await assert.rejects(
      async () => chmodCalculatorTool.run({ fields: { output: 'unknown' }, text: '755' }),
      /Permission table or JSON audit/,
    );

    assert.equal(
      JSON.parse((await chmodCalculatorTool.run({ fields: {}, text: '000' })).text).compact,
      '---------',
    );
  });
});
