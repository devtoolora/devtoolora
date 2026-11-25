import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { unicodeInspectorTool } from '../src/catalog/encoders';
import { contentOf } from './toolContent';

describe('Unicode inspector tool', () => {
  it('renders a table by default', async () => {
    const result = await unicodeInspectorTool.run({ fields: {}, text: 'Hi' });

    assert.equal(result.summary, '2 code points · 2 graphemes · 2 UTF-8 bytes');
    assert.equal(result.jsonTable?.columns.length, 7);
    assert.ok(contentOf(unicodeInspectorTool).faq?.length);
  });

  it('returns only JSON text and singular summary', async () => {
    const result = await unicodeInspectorTool.run({ fields: { output: 'json' }, text: 'a' });

    assert.equal(result.jsonTable, undefined);
    assert.equal(result.summary, '1 code point · 1 grapheme · 1 UTF-8 byte');
  });
});
