import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { patternExtractorTool } from '../src/catalog/textLists';

describe('pattern extractor tool', () => {
  it('runs in an isolated worker', () => {
    assert.equal(patternExtractorTool.isolatedWorker, true);
  });

  it('extracts one match per line', async () => {
    const result = await patternExtractorTool.run({
      fields: { pattern: 'url' },
      text: 'see https://a.io/x) and http://b.io',
    });

    assert.equal(result.text, 'https://a.io/x\nhttp://b.io');
    assert.match(result.summary ?? '', /2 matches · 2 unique/);
    assert.equal(result.artifact?.fileName, 'matches.txt');
  });

  it('ignores hidden custom fields for built-in patterns', async () => {
    const result = await patternExtractorTool.run({
      fields: { custom: '(', pattern: 'number' },
      text: '1 2',
    });

    assert.equal(result.text, '1\n2');
  });

  it('reports readable errors', async () => {
    await assert.rejects(
      async () =>
        patternExtractorTool.run({ fields: { custom: '', pattern: 'custom' }, text: 'x' }),
      /1 to 256/,
    );

    await assert.rejects(
      async () => patternExtractorTool.run({ fields: { pattern: 'xml' }, text: 'x' }),
      /Choose/,
    );
  });
});
