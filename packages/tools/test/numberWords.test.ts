import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { numberToWordsTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('number to words tool', () => {
  it('spells ordinals and reports the count', async () => {
    const result = await numberToWordsTool.run({ fields: { style: 'ordinal' }, text: '3' });

    assert.equal(result.text, 'third');
    assert.equal(result.summary, '1 number');

    assert.equal((await numberToWordsTool.run({ fields: {}, text: '1\n2' })).summary, '2 numbers');
    assert.ok(contentOf(numberToWordsTool).faq?.length);
  });
});
