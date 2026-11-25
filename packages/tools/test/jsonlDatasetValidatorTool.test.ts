import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { jsonlDatasetValidatorTool } from '../src/catalog/aiPrompts';
import { contentOf } from './toolContent';

const tool = jsonlDatasetValidatorTool;
const run = (text: string, fields: Record<string, string> = {}) => tool.run({ fields, text });
const decode = (base64 = '') => Buffer.from(base64, 'base64').toString();
const fileOf = (bytes: Uint8Array) =>
  `data:application/octet-stream;base64,${Buffer.from(bytes).toString('base64')}`;
const rejects = (action: () => unknown, message: string) =>
  assert.rejects(
    async () => action(),
    (error) => error instanceof ToolError && error.message === message,
  );
const example = JSON.stringify({
  messages: [
    { content: 'Hi', role: 'user' },
    { content: 'Hello', role: 'assistant' },
  ],
});

describe('JSONL dataset validator tool', () => {
  it('declares itself with fresh automatic results and a file field', () => {
    assert.equal(tool.id, 'jsonl-dataset-validator');
    assert.equal(tool.category, 'AI & Prompts');
    assert.equal(tool.autoRun, true);
    assert.equal(tool.freshResults, true);
    assert.deepEqual(tool.resultActions, ['copy', 'save']);

    assert.deepEqual(
      tool.fields?.map(({ defaultValue, id, type }) => [id, type, defaultValue]),
      [
        ['file', 'file', undefined],
        ['format', 'select', 'auto'],
      ],
    );

    const file = tool.fields?.[0];

    assert.equal(file?.type === 'file' && file.accept, '.jsonl,.json,.txt');
    assert.equal(file?.type === 'file' && file.maxBytes, 50 * 1024 * 1024);
  });

  it('documents itself and runs each of its six samples', async () => {
    const content = contentOf(tool);

    assert.equal(content.documentation?.length, 2);
    assert.equal(content.examples?.length, 6);
    assert.equal(content.help?.split('\n\n').length, 4);
    assert.ok((content.notes?.length ?? 0) >= 6);
    assert.ok((content.faq?.length ?? 0) >= 4 && (content.faq?.length ?? 0) <= 6);
    assert.equal(tool.samples?.length, 6);

    for (const sample of tool.samples ?? []) {
      const output = await run(sample.text ?? '', sample.fields);

      assert.ok(output.text.startsWith('Format: '), sample.label);
      assert.ok((output.summary ?? '').length > 0, sample.label);
    }
  });

  it('returns the text report and a JSON report with every count', async () => {
    const result = await run(`${example}\n${example}\n{"messages":[]}\n`);
    const json = JSON.parse(decode(result.artifacts?.[0]?.base64));

    assert.equal(result.artifact?.fileName, 'dataset-report.txt');
    assert.equal(decode(result.artifact?.base64), result.text);
    assert.equal(result.artifacts?.[0]?.fileName, 'dataset-report.json');
    assert.equal(result.noWrap, undefined);
    assert.deepEqual(json.issueCount, { errors: 1, warnings: 1 });
    assert.equal(json.stats.duplicates, 1);
    assert.equal(json.format, 'openai-chat');

    assert.equal(
      result.summary,
      'OpenAI chat · 3 lines · 2 valid · 1 invalid · 1 error · 1 warning',
    );
  });

  it('reads a file instead of the text when one is chosen', async () => {
    const bytes = new TextEncoder().encode(`${example}\r\n`);
    const result = await run('not json', { file: fileOf(bytes), format: 'openai-chat' });

    assert.equal(result.summary, 'OpenAI chat · 1 line · 1 valid · 0 invalid · no issues');

    await rejects(
      () => run('', { file: fileOf(new Uint8Array([0xff])) }),
      'The file is not valid UTF-8.',
    );
  });

  it('reports format and detection errors', async () => {
    await rejects(() => run(example, { format: 'anthropic' }), 'Choose a listed format.');

    await rejects(
      () => run('{"prompt":"x"}'),
      'Could not detect the format from line 1; choose one.',
    );
  });
});
