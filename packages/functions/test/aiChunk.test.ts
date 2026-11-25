import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { FunctionError } from '../src/errors';
import { chunkText, estimateTokens, type ChunkOptions } from '../src/ai';

const base: ChunkOptions = { boundary: 'none', overlap: 10, size: 50, unit: 'characters' };
const spans = (text: string, options: Partial<ChunkOptions> = {}) =>
  chunkText(text, { ...base, ...options }).map(({ end, start }) => [start, end]);
const fails = (text: string, options: Partial<ChunkOptions>, message: string) =>
  assert.throws(
    () => chunkText(text, { ...base, ...options }),
    (error) => error instanceof FunctionError && error.message.includes(message),
  );

describe('text chunker', () => {
  it('matches the spec vector and reports chunk fields', () => {
    const chunks = chunkText('a'.repeat(120), base);

    assert.deepEqual(
      chunks.map(({ end, start }) => [start, end]),
      [
        [0, 50],
        [40, 90],
        [80, 120],
      ],
    );

    assert.deepEqual(chunks[2], {
      chars: 40,
      end: 120,
      estimatedTokens: estimateTokens('a'.repeat(40)),
      index: 2,
      start: 80,
      text: 'a'.repeat(40),
    });
  });

  it('returns nothing for empty text', () => {
    assert.deepEqual(chunkText('', base), []);
  });

  it('validates size and overlap', () => {
    fails('abc', { overlap: 26 }, 'Overlap must be at most 25 for size 50.');
    fails('abc', { size: 49 }, '50-100,000');
    fails('abc', { size: 100_001 }, '50-100,000');
    assert.equal(chunkText('abc', { ...base, overlap: 25 }).length, 1);
  });

  it('never splits a surrogate pair', () => {
    const chunks = chunkText('\u{1f600}'.repeat(40), { ...base, overlap: 25, size: 51 });

    assert.ok(chunks.length > 1);

    for (const { text } of chunks) assert.equal(/\p{Cs}/u.test(text), false);
  });

  it('prefers the last sentence end in the second half of the window', () => {
    const text = `${'a'.repeat(10)}. ${'b'.repeat(30)}. ${'c'.repeat(40)}.`;

    assert.deepEqual(spans(text, { boundary: 'sentence', overlap: 0 })[0], [0, 44]);
  });

  it('never emits a chunk that lies entirely inside the previous one', () => {
    const chunks = chunkText(`${'a'.repeat(51)} `.repeat(40), {
      boundary: 'word',
      overlap: 50,
      size: 100,
      unit: 'characters',
    });

    chunks.slice(1).forEach((chunk, index) => {
      assert.ok(chunk.end > (chunks[index]?.end ?? 0), `chunk ${chunk.index}`);
    });
  });

  it('falls back from paragraph to sentence to word to a hard cut', () => {
    const sentences = `${'a'.repeat(30)}. ${'b'.repeat(30)}.`;
    const words = `${'a'.repeat(30)} ${'b'.repeat(30)}`;

    assert.deepEqual(spans(sentences, { boundary: 'paragraph', overlap: 0 })[0], [0, 32]);
    assert.deepEqual(spans(words, { boundary: 'paragraph', overlap: 0 })[0], [0, 31]);
    assert.deepEqual(spans('a'.repeat(120), { boundary: 'word', overlap: 0 })[0], [0, 50]);

    assert.deepEqual(
      spans(`${'a'.repeat(40)}\n\n${'b'.repeat(40)}`, { boundary: 'paragraph', overlap: 0 })[0],
      [0, 42],
    );
  });

  it('sizes the window from the token estimate', () => {
    const text = 'Hello world. '.repeat(40);
    const window = Math.floor((50 * text.length) / estimateTokens(text));
    const [first] = chunkText(text, { ...base, overlap: 0, unit: 'tokens' });

    assert.equal(first?.chars, window);
  });

  it('always advances with large overlap', () => {
    const chunks = chunkText('a'.repeat(300), { ...base, overlap: 25 });

    assert.equal(chunks.at(-1)?.end, 300);
    chunks.forEach((chunk, i) => i > 0 && assert.ok(chunk.start > (chunks[i - 1]?.start ?? 0)));
  });

  it('enforces the chunk and output limits', () => {
    fails('a'.repeat(500_100), { overlap: 0 }, '10,000');
    fails('a'.repeat(1_000_001), { overlap: 0, size: 100_000 }, '1,000,000');

    assert.equal(
      chunkText('a'.repeat(1_000_000), { ...base, overlap: 0, size: 100_000 }).length,
      10,
    );

    assert.equal(chunkText('a'.repeat(100), { ...base, overlap: 0 }).length, 2);
  });

  it('always advances with large overlap on sentences', () => {
    const text = `${'a'.repeat(28)}. `.repeat(100);
    const chunks = chunkText(text, {
      boundary: 'sentence',
      overlap: 25,
      size: 50,
      unit: 'characters',
    });

    chunks.forEach((chunk, i) => i > 0 && assert.ok(chunk.start > (chunks[i - 1]?.start ?? 0)));
    assert.equal(chunks.at(-1)?.end, text.length);
  });

  it('handles zero-estimate text in the token unit', () => {
    const chunks = chunkText('\u200b'.repeat(300), { ...base, unit: 'tokens' });

    assert.ok(chunks.length > 0);
    assert.ok(chunks.every(({ end, start }) => Number.isFinite(start) && Number.isFinite(end)));
    assert.equal(chunks.at(-1)?.end, 300);
    assert.equal(chunkText('a'.repeat(500_000), { ...base, overlap: 0 }).length, 10_000);
  });
});
