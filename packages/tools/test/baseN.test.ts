import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  ascii85EncodeTool,
  base32EncodeTool,
  base45EncodeTool,
  base58EncodeTool,
  baseNEncoderTool,
} from '../src/catalog/encoders';
import { contentOf } from './toolContent';

describe('Base-N encoder tool', () => {
  it('declares aliases that default to their own base', () => {
    const aliases = [
      [base32EncodeTool, 'base32'],
      [base58EncodeTool, 'base58'],
      [base45EncodeTool, 'base45'],
      [ascii85EncodeTool, 'ascii85'],
    ] as const;

    for (const [alias, base] of aliases) {
      assert.equal(alias.aliasOf, 'base-n-encoder');
      assert.equal(alias.fields?.find((field) => field.id === 'base')?.defaultValue, base);
    }

    assert.equal(
      baseNEncoderTool.fields?.find((field) => field.id === 'base')?.defaultValue,
      'base32',
    );

    assert.ok(contentOf(base58EncodeTool).faq?.length);
  });

  it('encodes and decodes through the selected base', async () => {
    assert.equal(
      (await base58EncodeTool.run({ fields: {}, text: 'Hello World!' })).text,
      '2NEpo7TZRRrLZSi2U',
    );

    const decoded = await baseNEncoderTool.run({
      fields: { base: 'base32', mode: 'decode' },
      text: 'MZXW6YTBOI======',
    });

    assert.equal(decoded.text, 'foobar');
    assert.equal(decoded.summary, 'decode · base32 · 6 bytes');

    assert.equal(
      (await base45EncodeTool.run({ fields: { mode: 'encode' }, text: 'Hello!!' })).summary,
      'encode · base45 · 7 bytes',
    );
  });

  it('reports readable errors', async () => {
    await assert.rejects(
      async () => baseNEncoderTool.run({ fields: { base: 'base64' }, text: 'x' }),
      /Choose/,
    );

    await assert.rejects(
      async () => baseNEncoderTool.run({ fields: { mode: 'decode' }, text: 'MZXW6YTBO!' }),
      /Invalid Base32 character "!" at position 10/,
    );

    await assert.rejects(
      async () => base58EncodeTool.run({ fields: { mode: 'decode' }, text: 'LUu' }),
      /not valid UTF-8/,
    );
  });
});
