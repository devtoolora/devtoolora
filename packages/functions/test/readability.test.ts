import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { countSyllables, readability } from '@devtoolora/functions/text';

describe('readability', () => {
  it('scores a short sentence', () => {
    assert.deepEqual(readability('The cat sat on the mat.'), {
      complexWords: 0,
      fleschKincaidGrade: -1.4,
      fleschReadingEase: 116.1,
      gunningFog: 2.4,
      sentences: 1,
      syllables: 6,
      words: 6,
    });
  });

  it('scores harder text', () => {
    assert.deepEqual(readability('Readability formulas estimate difficulty. Short words help.'), {
      complexWords: 4,
      fleschKincaidGrade: 16.1,
      fleschReadingEase: -14.3,
      gunningFog: 24.3,
      sentences: 2,
      syllables: 18,
      words: 7,
    });
  });

  it('counts syllables', () => {
    assert.equal(countSyllables('readability'), 5);
    assert.equal(countSyllables('the'), 1);
  });

  it('rejects text without words and oversized input', () => {
    assert.throws(() => readability('123 !!!'), /at least one English word/);
    assert.throws(() => readability('a'.repeat(1_000_001)), /1,000,000 characters\./);
  });
});
