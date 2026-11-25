import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { convertLineEndings } from '@devtoolora/functions/text';

describe('line ending conversion', () => {
  it('normalizes mixed endings and counts each kind', () => {
    assert.deepEqual(convertLineEndings('a\r\nb\rc\n', { bom: 'keep', ending: 'lf' }), {
      counts: { cr: 1, crlf: 1, lf: 1 },
      hadBom: false,
      mixed: true,
      text: 'a\nb\nc\n',
    });
  });

  it('adds, keeps and removes the BOM', () => {
    assert.equal(convertLineEndings('a\nb', { bom: 'add', ending: 'crlf' }).text, '\uFEFFa\r\nb');

    assert.equal(
      convertLineEndings('\uFEFFa\nb', { bom: 'add', ending: 'keep' }).text,
      '\uFEFFa\nb',
    );

    assert.deepEqual(convertLineEndings('\uFEFFx', { bom: 'remove', ending: 'keep' }), {
      counts: { cr: 0, crlf: 0, lf: 0 },
      hadBom: true,
      mixed: false,
      text: 'x',
    });
  });

  it('keeps text identical when nothing is requested', () => {
    const text = '\uFEFFa\r\nb\rc\n';

    assert.equal(convertLineEndings(text, { bom: 'keep', ending: 'keep' }).text, text);
  });

  it('converts to CR and accepts empty input', () => {
    assert.equal(convertLineEndings('a\r\nb\n', { bom: 'keep', ending: 'cr' }).text, 'a\rb\r');
    assert.equal(convertLineEndings('', { bom: 'keep', ending: 'lf' }).mixed, false);
  });

  it('rejects oversized input', () => {
    assert.throws(
      () => convertLineEndings('a'.repeat(1_000_001), { bom: 'keep', ending: 'lf' }),
      /1,000,000/,
    );
  });
});
