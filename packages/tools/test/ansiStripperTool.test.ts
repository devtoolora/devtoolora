import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { logOutput } from '../src/catalog/logsDiagnostics/shared';
import { ToolError } from '@devtoolora/core';
import {
  ansiStripperTool as tool,
  ansiToHtmlTool as alias,
} from '../src/catalog/logsDiagnostics/ansi-stripper/tool';

const ESC = String.fromCharCode(27);

describe('ansi stripper tool', () => {
  it('declares its metadata', () => {
    assert.equal(tool.id, 'ansi-stripper');
    assert.equal(tool.name, 'ANSI Escape Stripper & ANSI to HTML');
    assert.equal(tool.category, 'Logs & Diagnostics');
    assert.equal(tool.inputKind, 'text');
    assert.equal(tool.outputKind, 'text');
    assert.equal(tool.sensitiveInput, true);

    assert.deepEqual(
      tool.fields?.map((field) => [field.id, field.defaultValue]),
      [['mode', 'strip']],
    );

    assert.deepEqual(tool.relatedToolIds, ['log-filter', 'html-entities', 'stack-trace-cleaner']);
    assert.equal(tool.samples?.length, 6);
  });

  it('runs every sample of the tool and the alias', async () => {
    for (const sample of [...(tool.samples ?? []), ...(alias.samples ?? [])]) {
      const result = await (alias.samples?.includes(sample) ? alias : tool).run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.ok(result.text, sample.label);
      assert.ok(result.summary, sample.label);
    }
  });

  it('strips with a summary', async () => {
    const result = await tool.run({
      fields: { mode: 'strip' },
      text: `${ESC}[31mred${ESC}[0m\nplain`,
    });

    assert.equal(result.text, 'red\nplain');
    assert.equal(result.summary, '2 sequences removed · 2 lines');
    assert.equal(result.artifact?.fileName, 'plain.log');

    const single = await tool.run({ fields: {}, text: `${ESC}[1mx` });

    assert.equal(single.summary, '1 sequence removed · 1 line');

    const trailing = await tool.run({ fields: {}, text: 'a\nb\n' });

    assert.equal(trailing.summary, '0 sequences removed · 2 lines');
  });

  it('converts to html with a summary', async () => {
    const result = await tool.run({
      fields: { mode: 'html' },
      text: `${ESC}[31mred${ESC}[0m ${ESC}[32mgreen`,
    });

    assert.equal(
      result.text,
      '<pre class="ansi"><span style="color:#cd0000">red</span> <span style="color:#00cd00">green</span></pre>',
    );

    assert.equal(result.summary, 'HTML · 2 styled spans');
    assert.equal(result.language, 'html');
    assert.equal(result.artifact?.fileName, 'output.html');
    assert.equal(result.artifact?.mimeType, 'text/html;charset=utf-8');

    const single = await tool.run({ fields: { mode: 'html' }, text: `${ESC}[31mx` });

    assert.equal(single.summary, 'HTML · 1 styled span');
  });

  it('rejects oversized input', async () => {
    await assert.rejects(
      async () => tool.run({ fields: {}, text: 'x'.repeat(1_048_577) }),
      (error) =>
        error instanceof ToolError && error.message === 'Log input exceeds 1,048,576 characters.',
    );
  });

  it('declares the alias', () => {
    assert.equal(alias.id, 'ansi-to-html');
    assert.equal(alias.name, 'ANSI to HTML Converter');
    assert.equal(alias.aliasOf, 'ansi-stripper');
    assert.equal(alias.fields?.[0]?.defaultValue, 'html');
    assert.equal(alias.samples?.length, 6);
    assert.ok(alias.samples?.every((sample) => sample.fields?.mode === 'html'));
  });

  it('falls back to plain text for languages that only exist on the prototype', () => {
    assert.equal(
      logOutput('x', 'x.txt', 'constructor', 's').artifact?.mimeType,
      'text/plain;charset=utf-8',
    );
  });
});
