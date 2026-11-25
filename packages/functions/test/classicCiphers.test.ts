import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { applyClassicCipher, type ClassicCipher } from '@devtoolora/functions/encoding';

const vigenere = { cipher: 'vigenere', key: 'LEMON' } as const;

describe('applyClassicCipher', () => {
  it('applies Vigenere and keeps case and punctuation', () => {
    assert.equal(
      applyClassicCipher('ATTACKATDAWN', { ...vigenere, decode: false }),
      'LXFOPVEFRNHR',
    );

    assert.equal(
      applyClassicCipher('Attack at dawn!', { ...vigenere, decode: false }),
      'Lxfopv ef rnhr!',
    );

    assert.equal(
      applyClassicCipher('Lxfopv ef rnhr!', { ...vigenere, decode: true }),
      'Attack at dawn!',
    );
  });

  it('applies Atbash, Affine, rail fence and ROT47', () => {
    assert.equal(applyClassicCipher('Hello', { cipher: 'atbash', decode: false }), 'Svool');

    const affine = { a: 5, b: 8, cipher: 'affine' } as const;

    assert.equal(
      applyClassicCipher('AFFINE CIPHER', { ...affine, decode: false }),
      'IHHWVC SWFRCP',
    );

    assert.equal(applyClassicCipher('IHHWVC SWFRCP', { ...affine, decode: true }), 'AFFINE CIPHER');

    const rails = { cipher: 'rail-fence', rails: 3 } as const;

    assert.equal(
      applyClassicCipher('WEAREDISCOVEREDFLEEATONCE', { ...rails, decode: false }),
      'WECRLTEERDSOEEFEAOCAIVDEN',
    );

    assert.equal(
      applyClassicCipher('WECRLTEERDSOEEFEAOCAIVDEN', { ...rails, decode: true }),
      'WEAREDISCOVEREDFLEEATONCE',
    );

    assert.equal(
      applyClassicCipher('Hello, World!', { cipher: 'rot47', decode: false }),
      'w6==@[ (@C=5P',
    );
  });

  it('rejects invalid options with a position', () => {
    assert.throws(
      () => applyClassicCipher('x', { a: 13, b: 0, cipher: 'affine', decode: false }),
      /must be coprime with 26/,
    );

    assert.throws(
      () => applyClassicCipher('x', { cipher: 'vigenere', decode: false, key: 'L3M' }),
      /Key must contain only letters A-Z.*position 2/,
    );

    assert.throws(
      () => applyClassicCipher('x', { cipher: 'vigenere', decode: false, key: '' }),
      /1 to 256/,
    );

    assert.throws(
      () => applyClassicCipher('x', { cipher: 'rail-fence', decode: false, rails: 1 }),
      /2 to 100/,
    );

    assert.throws(
      () => applyClassicCipher('x'.repeat(1_000_001), { cipher: 'atbash', decode: false }),
      /1,000,000/,
    );
  });

  it('round-trips Unicode text for every cipher', () => {
    const text = 'P\u0159\u00EDli\u0161 \u017Elu\u0165ou\u010Dk\u00FD k\u016F\u0148 \u{1F40E}';
    const ciphers: ClassicCipher[] = ['affine', 'atbash', 'rail-fence', 'rot47', 'vigenere'];

    for (const cipher of ciphers) {
      const options = { a: 7, b: 3, cipher, key: 'Key', rails: 4 };
      const encoded = applyClassicCipher(text, { ...options, decode: false });

      assert.equal(applyClassicCipher(encoded, { ...options, decode: true }), text, cipher);
    }

    assert.ok(applyClassicCipher(text, { cipher: 'atbash', decode: false }).includes('\u00ED'));
  });

  it('reduces large affine values instead of hanging or losing precision', () => {
    const affine = (a: number, b: number, decode: boolean, text: string) =>
      applyClassicCipher(text, { a, b, cipher: 'affine', decode });

    assert.equal(affine(9007199254740991, 3, true, 'abc'), 'pkf');
    assert.equal(affine(9007199254740989, 3, false, 'abcxyz'), 'dgjuxa');
    assert.equal(affine(5, 1e20, false, 'abc'), 'wbg');
    assert.equal(affine(5, 1e20, true, 'wbg'), 'abc');
    assert.throws(() => affine(26, 1, false, 'abc'), /a=26 must be coprime/);
  });
});
