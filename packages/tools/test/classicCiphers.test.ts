import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { classicCiphersTool, vigenereCipherTool } from '../src/catalog/encoders';
import { contentOf } from './toolContent';

describe('Classic ciphers tool', () => {
  it('presets Vigenere on the alias', async () => {
    const result = await vigenereCipherTool.run({
      fields: { key: 'LEMON' },
      text: 'ATTACKATDAWN',
    });

    assert.equal(vigenereCipherTool.aliasOf, 'classic-ciphers');
    assert.equal(result.text, 'LXFOPVEFRNHR');
    assert.equal(result.summary, 'encode \u00B7 Vigen\u00E8re');
  });

  it('decodes, rejects bad numbers and has FAQ content', async () => {
    const decoded = await classicCiphersTool.run({
      fields: { cipher: 'rail-fence', mode: 'decode', rails: '3' },
      text: 'WECRLTEERDSOEEFEAOCAIVDEN',
    });

    assert.equal(decoded.text, 'WEAREDISCOVEREDFLEEATONCE');

    await assert.rejects(
      async () =>
        classicCiphersTool.run({ fields: { cipher: 'rail-fence', rails: '2.5' }, text: 'x' }),
      /whole number/,
    );

    assert.ok(contentOf(classicCiphersTool).faq?.length);
  });

  it('ignores unrelated numeric fields', async () => {
    const result = await classicCiphersTool.run({
      fields: { cipher: 'vigenere', rails: '2.5' },
      text: 'ATTACKATDAWN',
    });

    assert.equal(result.text, 'LXFOPVEFRNHR');
  });

  it('keeps a digit string above 2^53 exact for the affine values', async () => {
    const run = (a: string, b: string, mode: string, text: string) =>
      classicCiphersTool.run({ fields: { a, b, cipher: 'affine', mode }, text });
    // 9007199254740993 is 2^53 + 1, which Number() would round to 2^53.
    const encoded = await run('9007199254740993', '3', 'encode', 'abcxyz');
    const reduced = await run(String(9007199254740993n % 26n), '3', 'encode', 'abcxyz');

    assert.equal(encoded.text, reduced.text);
    assert.equal((await run('9007199254740993', '3', 'decode', encoded.text ?? '')).text, 'abcxyz');
  });
});
