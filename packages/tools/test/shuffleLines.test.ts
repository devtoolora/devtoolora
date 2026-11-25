import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { shuffleLinesTool } from '../src/catalog/textLists';

describe('shuffle lines tool', () => {
  it('is a fresh-result tool', () => {
    assert.equal(shuffleLinesTool.freshResults, true);
  });

  it('picks one of the lines', async () => {
    const result = await shuffleLinesTool.run({
      fields: { count: '1', mode: 'pick' },
      text: 'a\nb',
    });

    assert.ok(result.text === 'a' || result.text === 'b');
    assert.equal(result.artifact?.fileName, 'picked.txt');
    assert.match(result.summary ?? '', /1 of 2 lines · cryptographic randomness/);
  });

  it('shuffles into shuffled.txt and ignores count', async () => {
    const result = await shuffleLinesTool.run({
      fields: { count: 'nope', mode: 'shuffle' },
      text: 'a\nb',
    });

    assert.equal(result.artifact?.fileName, 'shuffled.txt');
    assert.equal(result.text.split('\n').sort().join(), 'a,b');
  });

  it('rejects a fractional count', async () => {
    await assert.rejects(
      async () => shuffleLinesTool.run({ fields: { count: '1.5', mode: 'pick' }, text: 'a' }),
      /whole number/,
    );
  });
});
