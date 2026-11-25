import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { tokenCounterTool, tokenEstimatorTool } from '../src/catalog/aiPrompts';

const context = { fields: {}, text: 'Hello world' };

describe('token estimator tool', () => {
  it('declares itself and its alias', () => {
    assert.equal(tokenEstimatorTool.id, 'token-estimator');
    assert.equal(tokenEstimatorTool.category, 'AI & Prompts');
    assert.equal(tokenEstimatorTool.inputKind, 'text');
    assert.equal(tokenEstimatorTool.fields, undefined);

    for (const tool of [tokenEstimatorTool, tokenCounterTool]) {
      assert.equal(tool.autoRun, true);
      assert.equal(tool.freshResults, true);
    }

    assert.equal(tokenCounterTool.id, 'token-counter');
    assert.equal(tokenCounterTool.aliasOf, 'token-estimator');
  });

  it('prints the context fit with one decimal', async () => {
    const fit = async (length: number) =>
      (await tokenEstimatorTool.run({ fields: {}, text: 'a'.repeat(length) })).text;

    assert.match(await fit(3412), /8,192 tokens: 12\.5%/);
    assert.match(await fit(170_664), /128,000 tokens: 40\.0%/);
  });

  it('writes the summary, counts and both artifacts', async () => {
    const result = await tokenEstimatorTool.run(context);
    const lines = result.text.split('\n');

    assert.equal(lines[0], '≈ 3 tokens (range 2-4, ±20%)');
    assert.equal(lines[1], 'Heuristic estimate, not a tokenizer; real counts vary by model.');
    assert.match(result.text, /Words: 2/);
    assert.match(result.text, /8,192 tokens: 0\.0%/);
    assert.equal(result.artifact?.fileName, 'token-estimate.txt');
    assert.equal(result.artifacts?.[0]?.fileName, 'token-estimate.json');

    const json = JSON.parse(Buffer.from(result.artifacts?.[0]?.base64 ?? '', 'base64').toString());

    assert.deepEqual(Object.keys(json), [
      'estimate',
      'low',
      'high',
      'margin',
      'counts',
      'contextFit',
    ]);
  });

  it('reports the text limit', async () => {
    await assert.rejects(
      async () => tokenEstimatorTool.run({ fields: {}, text: 'a'.repeat(1_000_001) }),
      (error) =>
        error instanceof ToolError &&
        error.message === 'Text must be at most 1,000,000 characters (UTF-16 units).',
    );
  });
});
