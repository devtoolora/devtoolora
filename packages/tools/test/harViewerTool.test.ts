import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { harViewerTool as tool } from '../src/catalog/logsDiagnostics/har-viewer/tool';
import { harBasic } from './fixtures/har';

describe('har viewer tool', () => {
  it('declares its metadata', () => {
    assert.equal(tool.id, 'har-viewer');
    assert.equal(tool.name, 'HAR Viewer');
    assert.equal(tool.category, 'Logs & Diagnostics');
    assert.equal(tool.inputKind, 'optionalText');
    assert.equal(tool.outputKind, 'json');
    assert.equal(tool.sensitiveInput, true);

    assert.deepEqual(
      tool.fields?.map((field) => [field.id, field.defaultValue]),
      [
        ['file', undefined],
        ['view', 'table'],
      ],
    );

    assert.deepEqual(tool.relatedToolIds, [
      'http-status',
      'user-agent-parser',
      'json-lines-inspector',
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

  it('renders the three views', async () => {
    const table = await tool.run({ fields: { view: 'table' }, text: harBasic });
    const failures = await tool.run({ fields: { view: 'failures' }, text: harBasic });
    const summary = await tool.run({ fields: { view: 'summary' }, text: harBasic });

    assert.equal(table.summary, '3 requests · 1.5 kB · 2 failures · 2.0 s');

    assert.deepEqual(table.jsonTable?.rows[2], [
      '3',
      'GET',
      '0',
      'https://example.com/logo.svg',
      'svg',
      '-',
      '50 ms',
      '-',
    ]);

    assert.equal(failures.jsonTable?.rows.length, 2);
    assert.equal(failures.jsonTable?.rows[1]?.[4], 'net::ERR_CONNECTION_REFUSED');
    assert.match(summary.text ?? '', /Content size: 1\.5 kB/);
    assert.match(summary.text ?? '', /Slowest 5:\n {2}300 ms {2}POST /);
  });

  it('prefers the file and rejects bad input', async () => {
    const file = `data:application/json;base64,${btoa('{"log":{"entries":[]}}')}`;
    const result = await tool.run({ fields: { file }, text: 'x' });

    assert.equal(result.summary, '0 requests · 0 B · 0 failures · -');

    await assert.rejects(
      async () => tool.run({ fields: { file: 'nope' }, text: '' }),
      (error) => error instanceof ToolError && error.message === 'HAR file data is invalid.',
    );

    await assert.rejects(
      async () => tool.run({ fields: {}, text: '{"log":{}}' }),
      (error) =>
        error instanceof ToolError && error.message === 'HAR input has no log.entries array.',
    );
  });

  it('renders unknown times and empty urls without noise', async () => {
    const text = JSON.stringify({
      log: {
        entries: [{ request: { method: 'GET', url: '' }, response: { status: 200 }, time: -1 }],
        version: '1.2',
      },
    });
    const table = await tool.run({ fields: { view: 'table' }, text });
    const summary = await tool.run({ fields: { view: 'summary' }, text });

    assert.equal(table.jsonTable?.rows[0]?.[6], '-');
    assert.doesNotMatch(summary.text ?? '', /GET $/m);
  });

  it('bounds the hosts list', async () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({
      request: { method: 'GET', url: `https://h${String(i).padStart(2, '0')}.example.com/` },
      response: { status: 200 },
    }));
    const result = await tool.run({
      fields: { view: 'summary' },
      text: JSON.stringify({ log: { entries } }),
    });

    assert.match(result.text ?? '', /h09\.example\.com/);
    assert.doesNotMatch(result.text ?? '', /h10\.example\.com/);
    assert.match(result.text ?? '', /… and 2 more hosts/);
  });

  it('accepts files with mime parameters and rejects blank or oversized ones', async () => {
    const encode = (value: string) => btoa(value);
    const file = `data:application/json;charset=utf-8;base64,${encode('{"log":{"entries":[]}}')}`;

    assert.equal(
      (await tool.run({ fields: { file }, text: '' })).summary?.startsWith('0 requests'),
      true,
    );

    await assert.rejects(
      async () => tool.run({ fields: { file: `data:;base64,${encode('  ')}` }, text: '' }),
      (error) => error instanceof ToolError && error.message === 'HAR input is empty.',
    );

    await assert.rejects(
      async () =>
        tool.run({
          fields: { file: `data:text/plain;base64,${'A'.repeat(14_000_000)}` },
          text: '',
        }),
      (error) =>
        error instanceof ToolError && error.message === 'HAR file must be no larger than 10 MiB.',
    );
  });

  it('renders an empty failures view', async () => {
    const text = JSON.stringify({ log: { entries: [{ response: { status: 200 } }] } });
    const result = await tool.run({ fields: { view: 'failures' }, text });

    assert.deepEqual(result.jsonTable?.rows, []);
  });

  it('keeps tabs and line breaks in url, method and error out of the TSV', async () => {
    const tab = String.fromCharCode(9);
    const text = JSON.stringify({
      log: {
        entries: [
          {
            _error: `bad${tab}err\nx`,
            request: { method: `G${tab}T`, url: `https://a/${tab}b\r\nc` },
            response: { status: 0 },
          },
        ],
      },
    });

    for (const view of ['table', 'failures']) {
      const lines = ((await tool.run({ fields: { view }, text })).text ?? '').split('\n');

      assert.equal(lines.length, 2, view);
      assert.equal(lines[1]?.split(tab).length, view === 'table' ? 8 : 5, view);
    }
  });

  it('pluralises the hosts overflow hint', async () => {
    const entries = Array.from({ length: 11 }, (_, i) => ({
      request: { method: 'GET', url: `https://h${String(i).padStart(2, '0')}.example.com/` },
      response: { status: 200 },
    }));
    const result = await tool.run({
      fields: { view: 'summary' },
      text: JSON.stringify({ log: { entries } }),
    });

    assert.match(result.text ?? '', /… and 1 more host\n/);
  });

  it('renders empty method and URL as a dash in the summary', async () => {
    const har = JSON.stringify({
      log: { entries: [{ request: { method: '', url: '' }, response: { bodySize: 10 }, time: 5 }] },
    });
    const result = await tool.run({ fields: { view: 'summary' }, text: har });

    assert.match(result.text ?? '', /Largest 5:\n {2}10 B {2}-$/);
  });
});
