import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { punycodeConverterTool } from '../src/catalog/encoders';
import { contentOf } from './toolContent';

describe('Punycode converter tool', () => {
  it('converts to Unicode with a table', async () => {
    const result = await punycodeConverterTool.run({
      fields: { mode: 'toUnicode' },
      text: 'xn--bcher-kva.example',
    });

    assert.equal(result.text, 'b\u00FCcher.example');
    assert.equal(result.summary, '1 domain');

    assert.deepEqual(result.jsonTable?.rows[0], [
      'xn--bcher-kva.example',
      'b\u00FCcher.example',
      null,
    ]);

    assert.ok(contentOf(punycodeConverterTool).faq?.length);
  });

  it('pluralizes domains and warnings', async () => {
    const result = await punycodeConverterTool.run({
      fields: {},
      text: 'p\u0430ypal.com\nb\u00FCcher.de',
    });

    assert.equal(result.summary, '2 domains \u00B7 1 warning');
  });

  it('rejects an unknown mode', async () => {
    await assert.rejects(
      async () => punycodeConverterTool.run({ fields: { mode: 'x' }, text: 'a' }),
      /Choose/,
    );
  });
});
