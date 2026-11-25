import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { natoPhoneticTool } from '../src/catalog/encoders';
import { contentOf } from './toolContent';

describe('NATO phonetic tool', () => {
  it('encodes, decodes and pluralizes the summary', async () => {
    const encoded = await natoPhoneticTool.run({ fields: { mode: 'encode' }, text: 'SOS 2' });
    const decoded = await natoPhoneticTool.run({ fields: { mode: 'decode' }, text: 'Alfa' });

    assert.equal(encoded.text, 'Sierra Oscar Sierra / Two');
    assert.equal(encoded.summary, 'encode \u00B7 5 characters');
    assert.equal(decoded.summary, 'decode \u00B7 1 character');
  });

  it('reports unknown words and has FAQ content', async () => {
    await assert.rejects(
      async () => natoPhoneticTool.run({ fields: { mode: 'decode' }, text: 'Sierra Foo' }),
      /word 2/,
    );

    assert.ok(contentOf(natoPhoneticTool).faq?.length);
  });
});
