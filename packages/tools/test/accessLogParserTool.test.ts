import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { accessLogParserTool as tool } from '../src/catalog/logsDiagnostics/access-log-parser/tool';

const text =
  '1.1.1.1 - - [27/Oct/2026:10:48:01 +0000] "GET /a HTTP/1.1" 200 10 "-" "curl/8"\n1.1.1.1 - - [27/Oct/2026:10:48:09 +0200] "GET /b HTTP/1.1" 404 -\nnope';

describe('access log parser tool', () => {
  it('declares its metadata', () => {
    assert.equal(tool.id, 'access-log-parser');
    assert.equal(tool.name, 'Access Log Parser');
    assert.equal(tool.category, 'Logs & Diagnostics');
    assert.equal(tool.inputKind, 'text');
    assert.equal(tool.outputKind, 'json');
    assert.equal(tool.sensitiveInput, true);

    assert.deepEqual(
      tool.fields?.map((field) => [field.id, field.defaultValue]),
      [
        ['view', 'table'],
        ['top', '10'],
      ],
    );

    assert.deepEqual(tool.relatedToolIds, [
      'log-filter',
      'json-lines-inspector',
      'log-timestamp-normalizer',
      'user-agent-parser',
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

  it('counts only 4xx and 5xx as errors', async () => {
    const odd = `${text}\n1.1.1.1 - - [27/Oct/2026:10:48:09 +0200] "GET /c HTTP/1.1" 999 -`;
    const table = await tool.run({ fields: { top: '10', view: 'table' }, text: odd });
    const errors = await tool.run({ fields: { top: '10', view: 'errors' }, text: odd });

    assert.equal(table.summary, '4 lines · 3 parsed · 1 error');
    assert.equal(errors.jsonTable?.rows.length, 1);
  });

  it('renders the table, errors and summary views', async () => {
    const table = await tool.run({ fields: { top: '10', view: 'table' }, text });
    const errors = await tool.run({ fields: { top: '10', view: 'errors' }, text });
    const summary = await tool.run({ fields: { top: '1', view: 'summary' }, text });

    assert.equal(table.summary, '3 lines · 2 parsed · 1 error');
    assert.equal(table.jsonTable?.rows.length, 2);
    assert.equal(table.jsonTable?.rows[0]?.[2], '2026-10-27T10:48:01.000Z');
    assert.equal(table.text?.split('\n')[0], table.jsonTable?.columns.join('\t'));
    assert.equal(errors.jsonTable?.rows.length, 1);
    assert.equal(errors.jsonTable?.rows[0]?.[6], '-');
    assert.match(summary.text ?? '', /Unparsed \(first 20 line numbers\): 3\n/);
    assert.match(summary.text ?? '', /Top paths:\n {2}1 {2}\/a\n/);
    assert.match(summary.text ?? '', /Total bytes: 10$/);
  });

  it('rejects an invalid top and unparseable input', async () => {
    await assert.rejects(
      async () => tool.run({ fields: { top: '0' }, text }),
      (error) =>
        error instanceof ToolError &&
        error.message.startsWith('Top must be a whole number between 1 and 100.'),
    );

    await assert.rejects(
      async () => tool.run({ fields: {}, text: 'nope' }),
      (error) =>
        error instanceof ToolError &&
        error.message === 'No access log lines in the expected common or combined format.',
    );
  });

  it('keeps tab, CR and LF inside a field out of the TSV columns', async () => {
    const tab = String.fromCharCode(9);
    const line = `1.1.1.1 - - [27/Oct/2026:10:48:01 +0000] "GET /a${tab}b HTTP/1.1" 200 1 "-" "x${tab}y"`;
    const result = await tool.run({ fields: { top: '10', view: 'table' }, text: line });
    const cols = (result.text ?? '').split('\n')[1]?.split(tab);

    assert.equal(cols?.length, 9);
    assert.equal(cols?.[4], '/a b');
    assert.equal(cols?.[8], 'x y');
  });

  it('shows an empty user agent as a dash and bounds methods by top', async () => {
    const line = (method: string) =>
      `1.1.1.1 - - [27/Oct/2026:10:48:01 +0000] "${method} / HTTP/1.1" 200 1`;
    const result = await tool.run({
      fields: { top: '2', view: 'summary' },
      text: ['GET', 'POST', 'PUT', 'HEAD'].map(line).join('\n'),
    });

    assert.match(result.text ?? '', /Top user agents:\n {2}4 {2}-\n/);
    assert.match(result.text ?? '', /Methods: GET 1, HEAD 1\n/);
  });

  it('does not split a surrogate pair when cutting the user agent', async () => {
    const agent = `${'a'.repeat(78)}${String.fromCodePoint(0x1f600)}tail`;
    const line = `1.1.1.1 - - [27/Oct/2026:10:48:01 +0000] "GET / HTTP/1.1" 200 1 "-" "${agent}"`;
    const result = await tool.run({ fields: { top: '10', view: 'table' }, text: line });
    const cell = result.jsonTable?.rows[0]?.[8] ?? '';

    assert.equal(cell, `${'a'.repeat(78)}${String.fromCodePoint(0x1f600)}…`);
  });

  it('keeps the dash-for-bytes sample distinct', () => {
    const texts = tool.samples?.map((sample) => sample.text);

    assert.equal(new Set(texts).size, texts?.length);
  });

  it('shows an empty referer and user agent as a dash in the table', async () => {
    const line = '1.1.1.1 - - [27/Oct/2026:10:48:01 +0000] "GET / HTTP/1.1" 200 1';
    const result = await tool.run({ fields: { top: '10', view: 'table' }, text: line });

    assert.deepEqual(result.jsonTable?.rows[0]?.slice(7), ['-', '-']);
  });
});
