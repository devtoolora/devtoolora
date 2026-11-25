import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { emailNormalizerTool, queryStringParserTool, urlParseTool } from '../src/catalog/webApi';
import {
  inspectUrl,
  normalizeEmail,
  parseQueryString,
  stringifyQueryString,
} from '../../functions/src/web';
import { contentOf } from './toolContent';

describe('web identity tools', () => {
  it('preserves duplicate/special query names, literal question marks and safe scalar serialization', () => {
    assert.deepEqual(inspectUrl('https://example.com/?x=1&x=2').params, { x: ['1', '2'] });
    const query = parseQueryString('__proto__=one&__proto__=two&constructor=demo');

    assert.equal(Object.getPrototypeOf(query), Object.prototype);
    assert.deepEqual(query.__proto__, ['one', 'two']);
    assert.equal(query.constructor, 'demo');
    assert.deepEqual(parseQueryString('q=a?b#fragment'), { q: 'a?b' });
    assert.deepEqual(parseQueryString('https://example.com/path#fragment'), {});

    assert.equal(
      stringifyQueryString({ active: true, skip: null, tags: ['a', null, 'b'] }),
      'active=true&tags=a&tags=b',
    );

    assert.throws(() => stringifyQueryString({ nested: { value: 'demo' } }), /nested/);
    assert.throws(() => inspectUrl('/relative'), /absolute URL/);
  });

  it('preserves generic local case and refuses unsupported mailbox syntax', () => {
    assert.equal(
      normalizeEmail('Ada.Lovelace+demo@Example.com').normalized,
      'Ada.Lovelace+demo@example.com',
    );

    assert.equal(normalizeEmail('Ada.Lovelace+demo@gmail.com').normalized, 'adalovelace@gmail.com');
    for (const email of [
      'a..b@example.com',
      '.a@example.com',
      'a@example-.com',
      'a@-example.com',
      '+tag@gmail.com',
      'a'.repeat(65) + '@example.com',
      'Name <a@example.com>',
    ])
      assert.throws(() => normalizeEmail(email));
  });

  it('provides complete guides, runnable samples, report trees and exact exports', async () => {
    for (const tool of [urlParseTool, queryStringParserTool, emailNormalizerTool]) {
      assert.equal(contentOf(tool).documentation?.length, 2);
      assert.ok((tool.samples?.length ?? 0) >= 6);

      for (const sample of tool.samples ?? []) {
        const result = await tool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

        assert.equal(
          Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
          result.text,
        );

        if (result.language === 'json') assert.ok(result.jsonTree?.nodes.length);
      }
    }

    await assert.rejects(async () =>
      queryStringParserTool.run({ fields: { mode: 'unknown' }, text: 'x=1' }),
    );
  });
});
