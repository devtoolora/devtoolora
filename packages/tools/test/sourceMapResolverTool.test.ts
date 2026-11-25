import assert from 'node:assert/strict';
import { ToolError } from '@devtoolora/core';
import { describe, it } from 'vitest';
import { sourceMapResolverTool } from '../src/catalog/logsDiagnostics';
import { fieldsOf } from './tools.helpers';

const decode = (base64: string | undefined): string =>
  Buffer.from(base64 ?? '', 'base64').toString('utf8');

describe('source map resolver tool', () => {
  it('declares its fields', () => {
    const tool = sourceMapResolverTool;

    assert.equal(tool.id, 'source-map-resolver');
    assert.equal(tool.inputKind, 'text');
    assert.equal(tool.sensitiveInput, true);
    assert.equal(tool.supportsSelection, true);
    assert.equal(tool.autoRun, true);
    assert.equal(tool.freshResults, true);
    assert.deepEqual(tool.resultActions, ['copy', 'scratch', 'save']);

    assert.deepEqual(tool.relatedToolIds, [
      'stack-trace-cleaner',
      'log-filter',
      'raw-log-redactor',
    ]);

    assert.deepEqual(
      fieldsOf(tool)?.map(
        ({ accept, defaultValue, id, label, maxBytes, multiple, required, type }) => ({
          accept,
          defaultValue,
          id,
          label,
          maxBytes,
          multiple,
          required,
          type,
        }),
      ),
      [
        {
          accept: '.map,application/json',
          defaultValue: undefined,
          id: 'maps',
          label: 'Source maps',
          maxBytes: 50 * 1024 * 1024,
          multiple: true,
          required: true,
          type: 'file',
        },
        {
          accept: undefined,
          defaultValue: 'false',
          id: 'context',
          label: 'Show original source lines',
          maxBytes: undefined,
          multiple: undefined,
          required: undefined,
          type: 'checkbox',
        },
        {
          accept: undefined,
          defaultValue: 'trace',
          id: 'output',
          label: 'Output',
          maxBytes: undefined,
          multiple: undefined,
          required: undefined,
          type: 'select',
        },
      ],
    );
  });

  it('resolves the first sample and names its artifacts', async () => {
    const sample = sourceMapResolverTool.samples?.[0];
    const result = await sourceMapResolverTool.run({
      fields: sample?.fields ?? {},
      text: sample?.text ?? '',
    });

    assert.ok(result.text.includes('src/app.ts:1:10'));
    assert.equal(result.artifact?.fileName, 'resolved-trace.txt');
    assert.equal(result.artifacts?.[0]?.fileName, 'source-map-report.json');
    assert.equal(decode(result.artifacts?.[0]?.base64).includes('"frames"'), true);
    assert.match(result.summary ?? '', /^Resolved \d+ of \d+ frames/);
  });

  it('puts the JSON report first for the JSON output', async () => {
    const sample = sourceMapResolverTool.samples?.at(-1);
    const result = await sourceMapResolverTool.run({
      fields: sample?.fields ?? {},
      text: sample?.text ?? '',
    });

    assert.equal(result.artifact?.fileName, 'source-map-report.json');
    assert.equal(result.artifacts?.[0]?.fileName, 'resolved-trace.txt');
    assert.equal(result.language, 'json');
    assert.equal(JSON.parse(result.text).frames.length > 0, true);
  });

  it('requires source maps', async () => {
    await assert.rejects(
      async () =>
        sourceMapResolverTool.run({
          fields: { context: 'false', output: 'trace' },
          text: 'at a.js:1:1',
        }),
      (error: Error) => error instanceof ToolError && error.message === 'Source maps is required.',
    );
  });
});
