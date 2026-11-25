import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { listBrowserWorkerTools } from '@devtoolora/browser-catalog';
import { summaryText } from '../src/catalog/documentsPdf/pdf-compare/tool';
import { result } from './tools.helpers';

const tools = listBrowserWorkerTools();
const tool = tools.find((entry) => entry.id === 'pdf-compare');
const alias = tools.find((entry) => entry.id === 'pdf-diff');

function defaults(fields: typeof tool): Record<string, string | undefined> {
  return Object.fromEntries((fields?.fields ?? []).map((field) => [field.id, field.defaultValue]));
}

describe('pdf compare tool', () => {
  it('declares its fields and the pdf-diff alias', () => {
    assert.deepEqual(
      tool?.fields?.map((field) => [field.id, field.label, field.type, field.defaultValue]),
      [
        ['beforePdf', 'Before PDF', 'file', undefined],
        ['afterPdf', 'After PDF', 'file', undefined],
        ['pages', 'Pages', 'text', undefined],
        ['output', 'Output', 'select', 'split'],
        ['ignoreWhitespace', 'Ignore spaces and tabs', 'checkbox', 'true'],
        ['ignoreCase', 'Ignore letter case', 'checkbox', 'false'],
      ],
    );

    assert.equal(tool?.samples?.length, 6);
    assert.equal(tool?.isolatedWorker, undefined);
    assert.equal(alias?.aliasOf, 'pdf-compare');
    assert.equal(alias?.samples?.length, 2);
    assert.deepEqual(defaults(alias), defaults(tool));
  });

  it('shows the changed and added rows of the first sample', async () => {
    const sample = tool?.samples?.[0]?.fields ?? {};
    const output = await result('pdf-compare', '', {
      ...(defaults(tool) as Record<string, string>),
      ...sample,
    });

    assert.equal(output.textDiff?.layout, 'split');
    assert.equal(output.textDiff?.showLineEndings, false);
    assert.equal(output.summary, '1 changed · 1 added · 0 removed · 1 matched · pages 1 vs 1.');

    const changed = output.textDiff?.rows.find((row) => row.kind === 'changed');

    assert.equal(changed?.before?.text, 'Revenue 100');
    assert.equal(changed?.after?.text, 'Revenue 120');
    assert.equal(output.artifact?.fileName, 'before-vs-after.json');
    assert.equal(output.artifacts?.[0]?.fileName, 'before-vs-after.txt');

    const report = JSON.parse(output.text) as Record<string, unknown>;

    assert.equal(report.changed, 1);
    assert.equal(report.counts, undefined);

    assert.deepEqual(
      [report.changed, report.added, report.removed, report.unchanged],
      [1, 1, 0, 1],
    );

    const readable = Buffer.from(output.artifacts?.[0]?.base64 ?? '', 'base64').toString('utf8');

    assert.match(readable, /^PDF Compare report \(not an applyable patch\)$/m);
    assert.doesNotMatch(readable, /\[(?:LF|CRLF|CR|none)\]/);
    assert.match(readable, /^Changed: 1; added: 1; removed: 0; matched: 1$/m);
    assert.deepEqual(report.before, { name: 'before.pdf', pageStarts: [{ line: 1, page: 1 }] });
  });

  it('runs every sample in every output mode', async () => {
    for (const sample of tool?.samples ?? []) {
      const output = await result('pdf-compare', '', {
        ...(defaults(tool) as Record<string, string>),
        ...sample.fields,
      });

      assert.match(output.text, /Revenue 1[02]0|Approved|No text differences/, sample.label);
    }

    const base = { ...defaults(tool), ...tool?.samples?.[0]?.fields };
    const readable = await result('pdf-compare', '', { ...base, output: 'text' });

    assert.equal(readable.textDiff, undefined);
    assert.equal(readable.artifact?.fileName, 'before-vs-after.txt');
    assert.equal(readable.language, 'text');
  });

  it('reports identical documents and requires both files', async () => {
    const base = { ...defaults(tool), ...tool?.samples?.[0]?.fields };
    const same = await result('pdf-compare', '', { ...base, afterPdf: base.beforePdf ?? '' });

    assert.equal(same.summary, 'No text differences in pages 1.');

    await assert.rejects(
      result('pdf-compare', '', { ...base, afterPdf: '' }),
      (error: Error) => error.message === 'After PDF is required.',
    );

    await assert.rejects(
      result('pdf-compare', '', { ...base, beforePdf: '' }),
      (error: Error) => error.message === 'Before PDF is required.',
    );
  });

  it('words the summary with both page lists only when they differ', () => {
    const none = { added: 0, changed: 0, matched: 3, removed: 0 };

    assert.equal(summaryText(none, [1, 2], [1, 2]), 'No text differences in pages 1-2.');
    assert.equal(summaryText(none, [1, 2], [3, 4]), 'No text differences in pages 1-2 vs 3-4.');
  });
});
