import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { logTimestampNormalizerTool as tool } from '../src/catalog/logsDiagnostics/log-timestamp-normalizer/tool';

describe('log timestamp normalizer tool', () => {
  it('declares its metadata', () => {
    assert.equal(tool.id, 'log-timestamp-normalizer');
    assert.equal(tool.name, 'Log Timestamp Normalizer');
    assert.equal(tool.category, 'Logs & Diagnostics');
    assert.equal(tool.inputKind, 'text');
    assert.equal(tool.outputKind, 'text');
    assert.equal(tool.sensitiveInput, true);

    assert.deepEqual(
      tool.fields?.map((field) => field.id),
      ['target', 'timeZone', 'year', 'dateOrder', 'mode'],
    );

    assert.deepEqual(tool.relatedToolIds, [
      'timestamp-convert',
      'log-filter',
      'time-zone-converter',
    ]);

    assert.equal(tool.samples?.length, 6);
  });

  it('runs every sample', async () => {
    for (const sample of tool.samples ?? []) {
      const result = await tool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

      assert.ok(result.text, sample.label);
      assert.notEqual(result.text, sample.text, sample.label);
      assert.ok(result.summary, sample.label);
    }
  });

  it('normalizes in replace and prefix mode with a summary', async () => {
    const fields = {
      dateOrder: 'mdy',
      mode: 'replace',
      target: 'iso-utc',
      timeZone: 'UTC',
      year: '2026',
    };
    const replaced = await tool.run({ fields, text: 'Oct 27 10:48:01 a\nplain\n1793090881 b' });
    const prefixed = await tool.run({
      fields: { ...fields, mode: 'prefix' },
      text: '1793090881 b',
    });

    assert.equal(replaced.text, '2026-10-27T10:48:01Z a\nplain\n2026-10-27T08:48:01Z b');
    assert.equal(replaced.summary, '3 lines · 2 normalized · 1 unchanged · 2 formats');
    assert.equal(prefixed.text, '2026-10-27T08:48:01Z\t1793090881 b');
    assert.equal(prefixed.summary, '1 line · 1 normalized · 0 unchanged · 1 format');
  });

  it('rejects an invalid year and time zone', async () => {
    await assert.rejects(
      async () => tool.run({ fields: { year: 'abc' }, text: 'x' }),
      (error) =>
        error instanceof ToolError && error.message === 'Year must be between 1970 and 2100.',
    );

    await assert.rejects(
      async () => tool.run({ fields: { timeZone: 'Mars/Olympus', year: '2026' }, text: 'x' }),
      ToolError,
    );
  });
});
