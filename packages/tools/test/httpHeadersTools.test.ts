import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { parseHttpHeaders } from '../../functions/src/web';
import { httpHeadersParserTool } from '../src/catalog/webApi';
import { contentOf } from './toolContent';

describe('HTTP header tools', () => {
  it('preserves duplicate values/order, safe names and absolute request start lines', () => {
    const report = parseHttpHeaders(
      'GET http://example.com/path HTTP/1.1\r\nSet-Cookie: a=1\r\nset-cookie: b=2\r\n__proto__: demo\r\nconstructor: sample\r\nX-Empty:\r\n\r\n',
    );

    assert.equal(report.startLine, 'GET http://example.com/path HTTP/1.1');
    assert.deepEqual(report.headers['set-cookie'], ['a=1', 'b=2']);
    assert.equal(report.headers.__proto__, 'demo');
    assert.equal(Object.getPrototypeOf(report.headers), Object.prototype);
    assert.equal(report.headers['x-empty'], '');
    assert.equal(report.rawHeaders[1]?.name, 'set-cookie');
    for (const input of [
      'Host : example.com',
      ' X: folded',
      'X: one\n continued',
      'X: demo\n\nprivate body',
      ': example.com',
      'HTTP/1.1 999 Wrong',
      'X: demo\u000B',
      'X: bad\u0000',
      'x'.repeat(1048577),
    ])
      assert.throws(() => parseHttpHeaders(input));
  });

  it('provides complete guide, six sample trees and exact saved reports', async () => {
    assert.equal(contentOf(httpHeadersParserTool).documentation?.length, 2);
    assert.equal(httpHeadersParserTool.samples?.length, 6);

    for (const sample of httpHeadersParserTool.samples ?? []) {
      const result = await httpHeadersParserTool.run({ fields: {}, text: sample.text ?? '' });

      assert.ok(result.jsonTree?.nodes.length);
      assert.equal(result.artifact?.fileName, 'http-headers.json');

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );
    }
  });
});
