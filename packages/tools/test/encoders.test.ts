import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { caesarCipherTool } from '../src/catalog/encoders';

describe('Caesar/ROT13 Cipher tool', () => {
  it('rejects an empty, whitespace-only or non-integer Shift instead of treating it as 0', async () => {
    for (const shift of ['', '   ', '\t']) {
      await assert.rejects(
        async () => caesarCipherTool.run({ fields: { shift }, text: 'Abc' }),
        /Enter a whole-number Shift/,
      );
    }

    for (const shift of ['2.5', '1e1', '0x10', 'abc', '9007199254740992']) {
      await assert.rejects(
        async () => caesarCipherTool.run({ fields: { shift }, text: 'Abc' }),
        /Shift must be a whole number/,
      );
    }
  });

  it('accepts trimmed whole numbers and defaults to ROT13 only when the field is absent', async () => {
    assert.equal((await caesarCipherTool.run({ fields: {}, text: 'Hello' })).text, 'Uryyb');
    const result = await caesarCipherTool.run({ fields: { shift: ' -3 ' }, text: 'Def' });

    assert.equal(result.text, 'Abc');
    assert.equal(result.summary, 'ASCII letter rotation complete · shift -3.');

    assert.equal(
      (await caesarCipherTool.run({ fields: { shift: '+29' }, text: 'Abc' })).text,
      'Def',
    );

    assert.equal((await caesarCipherTool.run({ fields: { shift: '0' }, text: 'Abc' })).text, 'Abc');
  });
});
