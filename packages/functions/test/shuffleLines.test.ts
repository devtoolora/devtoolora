import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { shuffleLines } from '@devtoolora/functions/text';

const first = () => 0;

describe('shuffleLines', () => {
  it('shuffles deterministically with an injected random', () => {
    assert.deepEqual(shuffleLines('a\nb\nc', { mode: 'shuffle', random: first }), {
      inputLines: 3,
      outputLines: 3,
      text: 'b\nc\na',
    });
  });

  it('keeps a trailing terminator and normalizes endings', () => {
    assert.equal(shuffleLines('a\nb\nc\n', { mode: 'shuffle', random: first }).text, 'b\nc\na\n');
    assert.equal(shuffleLines('a\r\nb\rc', { mode: 'shuffle', random: first }).text, 'b\nc\na');
  });

  it('picks the first count lines after shuffling', () => {
    const result = shuffleLines('a\nb\nc', { count: 2, mode: 'pick', random: first });

    assert.equal(result.text, 'b\nc');
    assert.equal(result.outputLines, 2);
  });

  it('rejects an invalid count', () => {
    assert.throws(() => shuffleLines('a\nb\nc', { count: 5, mode: 'pick' }), /1 to 3/);
    assert.throws(() => shuffleLines('a\nb\nc', { count: 1.5, mode: 'pick' }), /whole number/);
  });

  it('enforces limits', () => {
    assert.throws(() => shuffleLines('a'.repeat(100_001), { mode: 'shuffle' }), /100,000/);
    assert.throws(() => shuffleLines('\n'.repeat(10_001), { mode: 'shuffle' }), /10,000/);
  });

  it('keeps every line with the real random source', () => {
    const real = shuffleLines('1\n2\n3\n4\n5', { mode: 'shuffle' }).text.split('\n').sort();

    assert.deepEqual(real, ['1', '2', '3', '4', '5']);
  });
});
