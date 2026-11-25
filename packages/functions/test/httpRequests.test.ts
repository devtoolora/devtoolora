import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { FunctionError } from '../src/errors';
import { fetchToCurl } from '../src/web';
import {
  buildHttpRequest,
  inspectRawHttpRequest,
  renderCurl,
  renderRawHttp,
} from '../src/web/requests';

const multipart = '--b\r\nContent-Disposition: form-data; name="f"\r\n\r\nv\r\n--b--\r\n';

describe('raw HTTP request bodies', () => {
  it('keeps CRLF and the trailing newline of the body', () => {
    const request = inspectRawHttpRequest(
      `POST /x HTTP/1.1\r\nHost: a.test\r\nContent-Type: multipart/form-data; boundary=b\r\n\r\n${multipart}`,
    );

    assert.equal(request.body, multipart);

    assert.ok(
      renderRawHttp(request).endsWith(`Content-Length: ${multipart.length}\r\n\r\n${multipart}`),
    );

    assert.equal(inspectRawHttpRequest('POST /x HTTP/1.1\nHost: a.test\n\nbody\n').body, 'body\n');
  });

  it('treats surrounding blank lines of a bodyless request as no body', () => {
    const request = inspectRawHttpRequest('\n\nGET /x HTTP/1.1\r\nHost: a.test\r\n\r\n\r\n');

    assert.equal(request.url, 'https://a.test/x');
    assert.equal(request.body, undefined);
    assert.equal(inspectRawHttpRequest('GET /x HTTP/1.1\nHost: a.test\n').body, undefined);
  });

  it('refuses targets it cannot place, with a clear error', () => {
    for (const request of [
      'CONNECT example.com:443 HTTP/1.1\nHost: example.com',
      'GET localhost:8080/x HTTP/1.1\nHost: a.test',
      'GET /x HTTP/1.1\nHost: exa mple.com',
      'GET http:// HTTP/1.1\nHost: a.test',
    ])
      assert.throws(() => inspectRawHttpRequest(request), FunctionError, request);
  });
});

describe('generated cURL', () => {
  it('turns URL globbing off so brackets and braces stay literal', () => {
    const url = 'https://api.example.com/items?filter[a]=1&x={y}';

    assert.equal(
      renderCurl({ headers: [], method: 'GET', url }),
      `curl --globoff -X 'GET' '${url}'`,
    );
  });

  it('uses --head, because -X HEAD waits for a body that never comes', () => {
    assert.equal(
      renderCurl({ headers: [], method: 'HEAD', url: 'https://a.test/' }),
      "curl --globoff --head 'https://a.test/'",
    );

    assert.match(fetchToCurl('fetch("https://a.test/", { method: "HEAD" })'), / --globoff --head /);
  });

  it('sends an empty header with the semicolon form', () => {
    assert.equal(
      renderCurl({
        headers: [{ name: 'X-Empty', value: '' }],
        method: 'GET',
        url: 'https://a.test/',
      }),
      "curl --globoff -X 'GET' 'https://a.test/' -H 'X-Empty;'",
    );
  });
});

describe('HTTP request builder', () => {
  it('keeps the digits of a JSON integer a double cannot hold', () => {
    assert.equal(
      buildHttpRequest({
        body: '{ "id": 12345678901234567890, "n": [1.5] }',
        bodyMode: 'json',
        url: 'https://a.test/',
      }).body,
      '{"id":12345678901234567890,"n":[1.5]}',
    );

    for (const body of ['[1e400]', '[1e-400]'])
      assert.throws(
        () => buildHttpRequest({ body, bodyMode: 'json', url: 'https://a.test/' }),
        /range of a double/,
      );

    assert.equal(
      buildHttpRequest({
        body: '{"id":9007199254740991}',
        bodyMode: 'json',
        url: 'https://a.test/',
      }).body,
      '{"id":9007199254740991}',
    );
  });

  it('adds query fields without rewriting the query already in the URL', () => {
    const url = 'https://a.test/?a%20b&flag&p=/x/y&s=a;b';

    assert.equal(
      buildHttpRequest({ query: 'q=a b', url }).url,
      'https://a.test/?a%20b&flag&p=/x/y&s=a;b&q=a+b',
    );

    assert.equal(
      buildHttpRequest({
        apiKeyLocation: 'query',
        apiKeyName: 'k',
        apiKeyValue: 'v',
        authMode: 'api-key',
        url,
      }).url,
      'https://a.test/?a%20b&flag&p=/x/y&s=a;b&k=v',
    );

    assert.equal(
      buildHttpRequest({ query: 'q=1', url: 'https://a.test/' }).url,
      'https://a.test/?q=1',
    );
  });

  it('refuses header names and line breaks that would inject a header', () => {
    const apiKey = { apiKeyValue: 'v', authMode: 'api-key', url: 'https://a.test/' };

    assert.throws(() => buildHttpRequest({ ...apiKey, apiKeyName: 'Bad Name' }), /HTTP token/);

    assert.throws(
      () => buildHttpRequest({ ...apiKey, apiKeyName: 'X-K', apiKeyValue: 'v\nX-Evil: 1' }),
      /line breaks/,
    );

    assert.throws(
      () => buildHttpRequest({ authMode: 'bearer', bearerToken: 'a\nb', url: 'https://a.test/' }),
      /line breaks/,
    );
  });

  it('allows an empty Basic password, as RFC 7617 does', () => {
    const { headers } = buildHttpRequest({
      authMode: 'basic',
      basicUsername: 'ada',
      url: 'https://a.test/',
    });

    assert.deepEqual(headers, [{ name: 'Authorization', value: 'Basic YWRhOg==' }]);
  });
});
