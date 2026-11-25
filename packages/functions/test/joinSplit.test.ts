import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { joinLines, splitText } from '@devtoolora/functions/text';

describe('join and split lines', () => {
  it('joins lines, trimming and dropping empty ones', () => {
    assert.deepEqual(joinLines('a\nb\n\nc', { dropEmpty: true, separator: ', ', trim: true }), {
      count: 3,
      text: 'a, b, c',
    });

    assert.deepEqual(joinLines(' a \r\n\r\nb', { dropEmpty: false, separator: '', trim: false }), {
      count: 3,
      text: ' a b',
    });
  });

  it('splits on a separator', () => {
    assert.deepEqual(
      splitText('a,b,,c', { by: 'separator', dropEmpty: false, separator: ',', trim: false }),
      { count: 4, text: 'a\nb\n\nc' },
    );

    assert.deepEqual(
      splitText('a; b;;c', { by: 'separator', dropEmpty: true, separator: ';', trim: true }),
      { count: 3, text: 'a\nb\nc' },
    );
  });

  it('splits by length without breaking surrogate pairs', () => {
    assert.deepEqual(
      splitText('abcdefg', { by: 'length', dropEmpty: true, length: 3, trim: false }),
      { count: 3, text: 'abc\ndef\ng' },
    );

    assert.equal(
      splitText('a😀b', { by: 'length', dropEmpty: true, length: 2, trim: false }).text,
      'a😀\nb',
    );
  });

  it('rejects invalid options and oversized input', () => {
    assert.throws(
      () => splitText('x', { by: 'separator', dropEmpty: true, separator: '', trim: false }),
      /1 to 32/,
    );

    assert.throws(
      () => splitText('x', { by: 'length', dropEmpty: true, length: 0, trim: false }),
      /1 to 10,000/,
    );

    assert.throws(
      () => joinLines('x', { dropEmpty: true, separator: 'x'.repeat(33), trim: true }),
      /0 to 32/,
    );

    assert.throws(
      () => joinLines('x'.repeat(100_001), { dropEmpty: true, separator: '', trim: true }),
      /100,000 UTF-16 units/,
    );

    assert.throws(
      () =>
        splitText('\n'.repeat(100_000), {
          by: 'separator',
          dropEmpty: false,
          separator: '\n',
          trim: false,
        }),
      /100,000 items/,
    );
  });
});
