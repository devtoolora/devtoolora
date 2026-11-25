import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { FunctionError } from '@devtoolora/functions/errors';
import {
  buildHttpRequest,
  buildMetaTags,
  convertTimestamp,
  curlToFetch,
  inspectRawHttpRequest,
  inspectUrl,
  lookupMimeType,
  normalizeEmail,
  parseHttpHeaders,
  parseQueryString,
  parseUserAgent,
  renderCurl,
  renderPythonRequests,
  resolveTimeZone,
  stringifyQueryString,
} from '@devtoolora/functions/web';

describe('web functions', () => {
  it('inspects URLs, timestamps, email aliases, queries, and headers', () => {
    assert.deepEqual(inspectUrl('https://user:secret@example.com:8443/a?q=1#top'), {
      protocol: 'https:',
      username: 'user',
      password: '<redacted>',
      host: 'example.com:8443',
      hostname: 'example.com',
      port: '8443',
      pathname: '/a',
      search: '?q=1',
      params: { q: '1' },
      hash: '#top',
    });

    assert.equal(convertTimestamp('0').iso, '1970-01-01T00:00:00.000Z');
    assert.deepEqual(lookupMimeType('photo.PNG'), ['png: image/png']);

    assert.deepEqual(lookupMimeType('https://example.com/'), [
      'No MIME mapping found in the bundled reference.',
    ]);

    assert.equal(normalizeEmail('Ada.Lovelace+demo@gmail.com').normalized, 'adalovelace@gmail.com');
    assert.deepEqual(parseQueryString('?q=one&q=two'), { q: ['one', 'two'] });
    assert.equal(stringifyQueryString({ q: 'dev tools', page: 2 }), 'q=dev+tools&page=2');

    assert.deepEqual(
      parseHttpHeaders('HTTP/2 200 OK\nset-cookie: a=1\nset-cookie: b=2').headers['set-cookie'],
      ['a=1', 'b=2'],
    );
  });

  it('chooses the timestamp unit from integer digits, not string length', () => {
    assert.equal(convertTimestamp('1700000000.5').unixMilliseconds, 1700000000500);
    assert.equal(convertTimestamp('-1000000000').iso, '1938-04-24T22:13:20.000Z');
    assert.equal(convertTimestamp('1700000000000').unixSeconds, 1700000000);
    assert.equal(convertTimestamp('1700000000000000').unixSeconds, 1700000000);
    assert.equal(convertTimestamp('1700000000000000000').unixSeconds, 1700000000);
    assert.equal(convertTimestamp('1700000000', { unit: 'ms' }).unixMilliseconds, 1700000000);
    assert.equal(convertTimestamp('1700000000', { unit: 'us' }).unixMilliseconds, 1700000);
    assert.equal(convertTimestamp('1700000000000', { unit: 's' }).unixSeconds, 1700000000000);
    assert.throws(() => convertTimestamp('x'.repeat(257)), FunctionError);
  });

  it('detects mobile platforms before desktop hints in user agents', () => {
    const iphone = parseUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
    );

    assert.deepEqual(
      {
        browser: iphone.browser,
        engine: iphone.engine,
        os: iphone.os,
        osVersion: iphone.osVersion,
        device: iphone.device,
      },
      {
        browser: { name: 'Safari', version: '17.4.1' },
        engine: 'WebKit',
        os: 'iOS',
        osVersion: '17.4.1',
        device: 'mobile',
      },
    );

    const ipad = parseUserAgent(
      'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
    );

    assert.deepEqual(
      [ipad.browser, ipad.os, ipad.device, ipad.engine],
      [{ name: 'Chrome', version: '120.0.6099.119' }, 'iPadOS', 'tablet', 'WebKit'],
    );

    const opera = parseUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0',
    );

    assert.deepEqual(
      [opera.browser, opera.os, opera.osVersion, opera.engine],
      [{ name: 'Opera', version: '110.0.0.0' }, 'Windows', '10 or 11', 'Blink'],
    );

    const samsung = parseUserAgent(
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36',
    );

    assert.deepEqual(
      [samsung.browser, samsung.os, samsung.osVersion, samsung.device],
      [{ name: 'Samsung Internet', version: '24.0' }, 'Android', '14', 'mobile'],
    );

    const firefox = parseUserAgent(
      'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
    );

    assert.deepEqual(
      [firefox.browser, firefox.os, firefox.engine, firefox.device],
      [{ name: 'Firefox', version: '125.0' }, 'Linux', 'Gecko', 'desktop'],
    );

    const bot = parseUserAgent(
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    );

    assert.deepEqual([bot.browser, bot.device], [{ name: 'Googlebot', version: '2.1' }, 'bot']);
    assert.equal(parseUserAgent('curl/8.7.1').device, 'bot');
  });

  it('converts common cURL and builds typed HTTP requests', () => {
    assert.match(
      curlToFetch("curl -X POST https://example.com -H 'Accept: application/json' -d '{}'"),
      /fetch\("https:\/\/example.com"/,
    );

    const request = buildHttpRequest({
      url: 'https://example.com/items',
      method: 'POST',
      query: 'dryRun=true',
      bodyMode: 'json',
      body: '{"name":"Ada"}',
      authMode: 'basic',
      basicUsername: 'ada',
      basicPassword: 'secret',
    });

    assert.equal(request.url, 'https://example.com/items?dryRun=true');

    assert.ok(
      request.headers.some(
        (header) => header.name === 'Authorization' && header.value.startsWith('Basic '),
      ),
    );

    assert.match(renderCurl(request), /--data-raw/);
  });

  it('combines repeated headers in Python requests code instead of keeping only the last', () => {
    const request = inspectRawHttpRequest(
      'GET /trace HTTP/1.1\nHost: api.example.com\nX-Trace: first\nAccept: application/json\nx-trace: second\nCookie: theme=dark\nCookie: lang=en',
    );
    const python = renderPythonRequests(request);

    assert.match(python, /^ {8}"X-Trace": "first, second",$/m);
    assert.match(python, /^ {8}"Cookie": "theme=dark; lang=en",$/m);
    assert.equal(python.match(/"x-trace"|"X-Trace"/gi)?.length, 1);

    assert.match(
      python,
      /^# requests sends one value per header name, so repeated X-Trace and Cookie headers are combined\.$/m,
    );

    assert.doesNotMatch(
      renderPythonRequests(inspectRawHttpRequest('GET / HTTP/1.1\nHost: example.com\nAccept: */*')),
      /^#/m,
    );

    const setCookie = renderPythonRequests(
      inspectRawHttpRequest(
        'GET / HTTP/1.1\nHost: example.com\nSet-Cookie: a=1; Expires=Wed, 21 Oct 2026 07:28:00 GMT\nSet-Cookie: b=2',
      ),
    );

    assert.match(setCookie, /^ {8}"Set-Cookie": "b=2",$/m);

    assert.match(
      setCookie,
      /^# requests sends one value per header name, and Set-Cookie values cannot be combined, so only the last of 2 Set-Cookie headers is sent\.$/m,
    );
  });

  it('uses singular and plural character counts in meta tag suggestions', () => {
    const one = buildMetaTags({ description: 'D', title: 'T' }).suggestions;

    assert.ok(
      one.some((suggestion) => suggestion.startsWith('The title is only 1 character;')),
      one.join('\n'),
    );

    assert.ok(
      one.some((suggestion) => suggestion.startsWith('The description is only 1 character;')),
      one.join('\n'),
    );

    assert.ok(
      buildMetaTags({ description: 'Do', title: 'To' }).suggestions.some((suggestion) =>
        suggestion.startsWith('The title is only 2 characters;'),
      ),
    );
  });

  it('inspects raw requests and rejects invalid request input with typed errors', () => {
    const request = inspectRawHttpRequest('GET /items HTTP/1.1\nHost: api.example.com');

    assert.equal(request.url, 'https://api.example.com/items');

    assert.throws(
      () => buildHttpRequest({ url: 'https://example.com', method: 'GET 1' }),
      (error: unknown) => error instanceof FunctionError && error.code === 'INVALID_HTTP_REQUEST',
    );
  });

  it('reads fractional Unix seconds exactly and notes only digits that are really dropped', () => {
    for (const [input, iso] of [
      ['1700000000.1', '2023-11-14T22:13:20.100Z'],
      ['1700000000.123', '2023-11-14T22:13:20.123Z'],
      ['1.001', '1970-01-01T00:00:01.001Z'],
      ['1.003', '1970-01-01T00:00:01.003Z'],
      ['1.005', '1970-01-01T00:00:01.005Z'],
    ] as const) {
      const report = convertTimestamp(input, { timeZone: 'UTC' });

      assert.equal(report.iso, iso, input);

      assert.equal(
        report.notes?.some((note) => note.includes('below one millisecond')) ?? false,
        false,
        input,
      );
    }

    const truncated = convertTimestamp('1700000000.1234', { timeZone: 'UTC' });

    assert.equal(truncated.iso, '2023-11-14T22:13:20.123Z');
    assert.ok(truncated.notes?.includes('Digits below one millisecond are dropped.'));
    assert.equal(convertTimestamp('-1.0015', { unit: 's' }).unixMilliseconds, -1002);
    assert.equal(convertTimestamp('1500', { unit: 'us' }).unixMilliseconds, 1);
    assert.equal(convertTimestamp('-1500', { unit: 'us' }).unixMilliseconds, -2);
    assert.throws(() => convertTimestamp('9'.repeat(200)), /outside the range/);
  });

  it('rejects the short zone ids ICU accepts but the IANA database does not have', () => {
    for (const zone of ['BST', 'CST', 'IST', 'PST', 'JST', 'pst', ' Ist '])
      assert.throws(() => resolveTimeZone(zone), /Unknown time zone/, zone);

    for (const zone of ['EST', 'MST', 'HST', 'CET', 'UTC', 'GMT', 'Europe/Prague'])
      assert.equal(resolveTimeZone(zone), zone);

    assert.throws(() => convertTimestamp('0', { timeZone: 'PST' }), /Unknown time zone "PST"/);
  });
});
