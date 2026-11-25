import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { quotedPrintableTool } from '../src/catalog/encoders';
import { contentOf } from './toolContent';

describe('Quoted-printable tool', () => {
  it('encodes and decodes', async () => {
    const encoded = await quotedPrintableTool.run({ fields: {}, text: 'Café' });

    assert.equal(encoded.text, 'Caf=C3=A9');
    assert.equal(encoded.summary, 'encode · 1 line');

    const decoded = await quotedPrintableTool.run({
      fields: { mode: 'decode' },
      text: 'a=\nb\nc',
    });

    assert.equal(decoded.text, 'ab\nc');
    assert.equal(decoded.summary, 'decode · 2 lines');
    assert.ok(contentOf(quotedPrintableTool).faq?.length);
  });

  it('decodes MIME headers', async () => {
    const result = await quotedPrintableTool.run({
      fields: { mode: 'header' },
      text: 'Subject: =?UTF-8?Q?Caf=C3=A9?= menu',
    });

    assert.equal(result.text, 'Subject: Café menu');
  });

  it('rejects an unknown charset', async () => {
    await assert.rejects(
      async () =>
        quotedPrintableTool.run({ fields: { charset: 'ebcdic', mode: 'decode' }, text: 'a' }),
      /Choose/,
    );
  });
});
