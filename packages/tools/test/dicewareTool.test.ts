import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { dicewareTool } from '../src/catalog/crypto/diceware/tool';

const run = (text: string, fields: Record<string, string> = {}) =>
  dicewareTool.run({ fields, text });

describe('diceware tool', () => {
  it('runs every sample with text and a summary', async () => {
    for (const sample of dicewareTool.samples ?? []) {
      const result = await run(sample.text ?? '', sample.fields ?? {});

      assert.ok(result.text, sample.label);
      assert.ok(result.summary, sample.label);
    }
  });

  it('summarizes generated and rolled passphrases', async () => {
    const samples = dicewareTool.samples ?? [];
    const [first, , rolled, , , many] = await Promise.all(
      samples.map((sample) => run(sample.text ?? '', sample.fields ?? {})),
    );

    assert.match(first?.summary ?? '', /^6 words · 77\.5 bits · 1 passphrase$/);
    assert.equal(rolled?.summary, '5 words · 64.6 bits · from dice rolls');
    assert.equal(many?.summary, '7 words · 90.5 bits · 3 passphrases');
    assert.equal(many?.text.split('\n').length, 3);
  });

  it('rejects malformed dice rolls', () => {
    assert.throws(
      () => run('1234'),
      (error) => error instanceof ToolError && /five dice digits/.test(error.message),
    );
  });
});
