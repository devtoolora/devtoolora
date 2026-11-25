import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { decodeNato, spellNato } from '@devtoolora/functions/encoding';

describe('NATO phonetic alphabet', () => {
  it('spells letters, digits and passes other characters through', () => {
    assert.equal(spellNato('SOS 2'), 'Sierra Oscar Sierra / Two');
    assert.equal(spellNato('Jx-\u00E9'), 'Juliett X-ray - Echo');
    assert.equal(spellNato('a\r\nb'), 'Alfa\nBravo');
    assert.equal(spellNato('a\rb'), 'Alfa\nBravo');
  });

  it('decodes code words, aliases and CRLF', () => {
    assert.equal(decodeNato('alpha JULIET xray niner / two'), 'AJX9 2');
    assert.equal(decodeNato('Alfa\r\nBravo'), 'A\nB');
    assert.equal(decodeNato(spellNato('Hello 42!')), 'HELLO 42!');
  });

  it('reports the position of an unknown word', async () => {
    await assert.rejects(
      async () => decodeNato('Sierra Foo'),
      /Unknown code word "Foo" at word 2\./,
    );

    await assert.rejects(async () => decodeNato('Alfa\nBravo Foo'), /"Foo" at word 2 on line 2\./);
  });

  it('enforces the input limit', async () => {
    await assert.rejects(async () => spellNato('a'.repeat(100_001)), /100,000/);
    await assert.rejects(async () => decodeNato('a'.repeat(100_001)), /100,000/);
    assert.equal(spellNato('a'.repeat(100_000)).length, 100_000 * 5 - 1);
  });
});
