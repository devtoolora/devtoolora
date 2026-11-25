import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { textChunkerTool, textSplitterTool } from '../src/catalog/aiPrompts';

const run = (fields: Record<string, string>, text: string) =>
  textChunkerTool.run({ fields: { overlap: '10', size: '50', boundary: 'none', ...fields }, text });
const decode = (base64 = '') => Buffer.from(base64, 'base64').toString();

describe('text chunker tool', () => {
  it('declares itself and its alias', () => {
    assert.equal(textChunkerTool.id, 'text-chunker');
    assert.equal(textChunkerTool.category, 'AI & Prompts');
    assert.equal(textSplitterTool.id, 'text-splitter');
    assert.equal(textSplitterTool.aliasOf, 'text-chunker');

    for (const tool of [textChunkerTool, textSplitterTool]) {
      assert.equal(tool.autoRun, true);
      assert.equal(tool.freshResults, true);
    }
  });

  it('writes JSON by default', async () => {
    const result = await run({}, 'a'.repeat(120));
    const chunks = JSON.parse(result.text);

    assert.equal(chunks.length, 3);

    assert.deepEqual(Object.keys(chunks[0]), [
      'index',
      'start',
      'end',
      'chars',
      'estimatedTokens',
      'text',
    ]);

    assert.equal(result.artifact?.fileName, 'chunks.json');
    assert.match(result.summary ?? '', /3 chunks/);
    assert.match(result.summary ?? '', /largest ≈ 13 tokens/);
  });

  it('writes JSON Lines and headed text', async () => {
    const lines = await run({ output: 'jsonl' }, 'a'.repeat(120));

    assert.equal(lines.text.split('\n').length, 3);
    assert.equal(lines.artifact?.fileName, 'chunks.jsonl');
    assert.equal(decode(lines.artifact?.base64), lines.text);

    const text = await run({ output: 'text' }, 'a'.repeat(120));

    assert.match(text.text, /^--- chunk 1\/3 · chars 0-49 · ≈ 13 tokens ---\n/);
    assert.match(text.text, /--- chunk 3\/3 · chars 80-119 · ≈ 10 tokens ---/);
    assert.equal(text.artifact?.fileName, 'chunks.txt');
  });

  it('reports limits and bad values', async () => {
    await assert.rejects(
      async () => run({ overlap: '26' }, 'abc'),
      (error) => error instanceof ToolError && error.message.includes('at most 25 for size 50'),
    );

    await assert.rejects(
      async () => run({ output: 'xml' }, 'abc'),
      (error) => error instanceof ToolError,
    );

    await assert.rejects(
      async () => run({ size: 'x' }, 'abc'),
      (error) => error instanceof ToolError && error.message.includes('50-100,000'),
    );
  });

  it('limits the rendered output, not the raw text', async () => {
    const text = '\u0001'.repeat(1_000_000);
    const big = { overlap: '0', size: '100000' };

    await assert.rejects(
      async () => run({ ...big, output: 'json' }, text),
      (error) => error instanceof ToolError && error.message.includes('5,000,000 characters'),
    );

    assert.equal((await run({ ...big, output: 'text' }, text)).text.length < 5_000_000, true);
  });
});
