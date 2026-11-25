import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { readabilityScoreTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('readability score tool', () => {
  it('reports scores with bands and a summary', async () => {
    const result = await readabilityScoreTool.run({ fields: {}, text: 'The cat sat on the mat.' });

    assert.equal(result.summary, 'Flesch 116.1 \u00B7 grade -1.4 \u00B7 fog 2.4');
    assert.match(result.text, /Flesch reading ease: 116.1 \(Very easy\)/);
  });

  it('emits JSON and rejects text without words', async () => {
    const json = await readabilityScoreTool.run({
      fields: { output: 'json' },
      text: 'The cat sat on the mat.',
    });

    assert.equal(JSON.parse(json.text).words, 6);

    await assert.rejects(
      async () => readabilityScoreTool.run({ fields: {}, text: '123' }),
      /at least one English word/,
    );

    assert.ok(contentOf(readabilityScoreTool).faq?.length);
  });
});
