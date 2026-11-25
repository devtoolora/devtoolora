import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { exitCodeReferenceTool as tool } from '../src/catalog/logsDiagnostics/exit-code-reference/tool';

describe('exit code reference tool', () => {
  it('declares its metadata', () => {
    assert.equal(tool.id, 'exit-code-reference');
    assert.equal(tool.name, 'Exit Code & errno Reference');
    assert.equal(tool.category, 'Logs & Diagnostics');
    assert.equal(tool.inputKind, 'optionalText');
    assert.equal(tool.outputKind, 'json');
    assert.equal(tool.sensitiveInput, true);

    assert.deepEqual(
      tool.fields?.map((field) => [field.id, field.defaultValue]),
      [['table', 'all']],
    );

    assert.deepEqual(tool.relatedToolIds, [
      'http-status',
      'stack-trace-cleaner',
      'chmod-calculator',
    ]);

    assert.equal(tool.samples?.length, 6);
  });

  it('runs every sample', async () => {
    for (const sample of tool.samples ?? []) {
      const result = await tool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

      assert.ok(result.text, sample.label);
      assert.ok(result.summary, sample.label);
    }
  });

  it('summarizes a query by matched table', async () => {
    const result = await tool.run({ fields: { table: 'all' }, text: '2' });

    assert.equal(result.summary, '2 · exit code · signal SIGINT · errno ENOENT');
    assert.equal(result.jsonTable?.rows.length, 3);

    assert.deepEqual(result.jsonTable?.rows[2], [
      'errno',
      '2',
      'ENOENT',
      'No such file or directory',
    ]);

    assert.match(result.text ?? '', /^Table {6}Code {2}Name/);
    assert.equal(result.artifact?.fileName, 'exit-codes.txt');
  });

  it('names the signal behind exit codes 129 to 158', async () => {
    const run = async (text: string) =>
      (await tool.run({ fields: { table: 'all' }, text })).summary;

    assert.equal(await run('130'), '130 · exit code · signal SIGINT · errno EOWNERDEAD');
    assert.equal(await run('137'), '137 · exit code · signal SIGKILL');
  });

  it('summarizes full tables', async () => {
    const summaries = await Promise.all(
      ['all', 'errno', 'signals', 'exit'].map(
        async (table) => (await tool.run({ fields: { table }, text: '' })).summary,
      ),
    );

    assert.deepEqual(summaries, ['185 entries', '131 errno values', '31 signals', '23 exit codes']);
  });

  it('reports unknown names', () => {
    assert.throws(
      () => tool.run({ fields: { table: 'all' }, text: 'FOO' }),
      new ToolError('No exit code, errno or signal named "FOO".'),
    );
  });
});
