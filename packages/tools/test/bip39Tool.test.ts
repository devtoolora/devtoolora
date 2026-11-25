import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError, type ToolResult } from '@devtoolora/core';
import { bip39Tool } from '../src/catalog/crypto/bip39/tool';

const run = async (text: string, fields: Record<string, string> = {}): Promise<ToolResult> =>
  bip39Tool.run({ fields, text });

describe('bip39 tool', () => {
  it('runs every sample with text and a summary', async () => {
    for (const sample of bip39Tool.samples ?? []) {
      const result = await run(sample.text ?? '', sample.fields ?? {});

      assert.ok(result.text, sample.label);
      assert.ok(result.summary, sample.label);
    }
  });

  it('summarizes validation results', async () => {
    const samples = bip39Tool.samples ?? [];
    const summaries = await Promise.all(
      samples.map(async (sample) => (await run(sample.text ?? '', sample.fields ?? {})).summary),
    );

    assert.equal(summaries[0], '12 words · 128-bit entropy · checksum valid');
    assert.equal(summaries[2], '12 words · checksum invalid');
    assert.equal(summaries[3], '12 words · checksum invalid · 1 unknown word');
    assert.equal(summaries[5], '3 mnemonics · 24 words');
  });

  it('keeps secrets out of the summary and shows the seed on request', async () => {
    const sample = bip39Tool.samples?.[0];
    const result = await run(sample?.text ?? '', sample?.fields ?? {});

    assert.match(result.text, /^Seed: c55257c3/m);
    assert.doesNotMatch(result.summary ?? '', /abandon|c55257/);
  });

  it('validates the generate limits', async () => {
    await assert.rejects(
      run('', { count: '11', mode: 'generate' }),
      /Count must be an integer between 1 and 10\./,
    );

    await assert.rejects(
      run('', { mode: 'generate', words: '13' }),
      /Words must be 12, 15, 18, 21 or 24\./,
    );
  });

  it('rejects oversized input', async () => {
    await assert.rejects(
      run('a '.repeat(600)),
      (error) => error instanceof ToolError && /1,024 characters/.test(error.message),
    );
  });
});
