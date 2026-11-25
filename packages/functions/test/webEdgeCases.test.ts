import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  analyzeEmailHeaders,
  generateRedirects,
  generateSitemap,
  inspectUrl,
  lookupHttpStatus,
  lookupMimeType,
  parseHttpHeaders,
  parseUserAgent,
  renderCurlAsCode,
  testRobots,
  validateSitemap,
} from '../src/web';

describe('reference lookups', () => {
  it('does not read the last path segment of a type as an extension', () => {
    const none = ['No MIME mapping found in the bundled reference.'];

    assert.deepEqual(lookupMimeType('foo/png'), none);
    assert.deepEqual(lookupMimeType('text/xml'), none);
    assert.deepEqual(lookupMimeType('https://x.test/png'), none);
    assert.deepEqual(lookupMimeType('png'), ['png: image/png']);
    assert.deepEqual(lookupMimeType('assets/a.png'), ['png: image/png']);
  });

  it('knows common MIME types and HTTP statuses', () => {
    for (const [query, type] of [
      ['zip', 'application/zip'],
      ['mp4', 'video/mp4'],
      ['mp3', 'audio/mpeg'],
      ['wasm', 'application/wasm'],
      ['ico', 'image/x-icon'],
      ['woff2', 'font/woff2'],
      ['htm', 'text/html'],
    ])
      assert.deepEqual(lookupMimeType(`a.${query}`), [`${query}: ${type}`]);

    assert.deepEqual(lookupHttpStatus('406'), ['406 Not Acceptable']);
    assert.deepEqual(lookupHttpStatus('416'), ['416 Range Not Satisfiable']);
    assert.deepEqual(lookupHttpStatus('300'), ['300 Multiple Choices']);
  });

  it('names old Windows versions and keeps bot versions', () => {
    const windows = (nt: string) =>
      parseUserAgent(`Mozilla/5.0 (Windows NT ${nt}) Chrome/1.0`).osVersion;

    assert.equal(windows('6.0'), 'Vista');
    assert.equal(windows('5.1'), 'XP');
    assert.deepEqual(parseUserAgent('curl/8.7.1').browser, { name: 'curl', version: '8.7.1' });
    assert.deepEqual(parseUserAgent('Slackbot 1.0').browser, { name: 'Slackbot', version: '' });
  });

  it('explains an invalid URL that does have a scheme', () => {
    assert.throws(() => inspectUrl('http://256.256.256.256/'), /host or port/);
    assert.throws(() => inspectUrl('/relative'), /absolute URL/);
  });

  it('accepts HTTP/2 pseudo-headers', () => {
    assert.deepEqual(parseHttpHeaders(':status: 200\n:authority: x.test\nA: b').rawHeaders, [
      { name: ':status', value: '200' },
      { name: ':authority', value: 'x.test' },
      { name: 'A', value: 'b' },
    ]);

    assert.throws(() => parseHttpHeaders(': v'), /Invalid header/);
  });
});

describe('robots.txt', () => {
  it('always allows /robots.txt', () => {
    const { results } = testRobots('User-agent: *\nDisallow: /', {
      agent: '*',
      paths: '/robots.txt\n/other',
    });

    assert.deepEqual(
      results.map((result) => result.allowed),
      [true, false],
    );
  });

  it('does not end a group of agents at Sitemap or unknown lines', () => {
    const text =
      'User-agent: a\nSitemap: https://x.test/s.xml\nFoo: bar\nUser-agent: b\nDisallow: /x';

    assert.equal(testRobots(text, { agent: 'a', paths: '/x' }).results[0]?.allowed, false);

    assert.equal(
      testRobots('User-agent: a\nDisallow: /y\nUser-agent: b\nDisallow: /x', {
        agent: 'a',
        paths: '/x',
      }).results[0]?.allowed,
      true,
    );
  });
});

describe('redirect rules', () => {
  const findings = (rules: string) =>
    generateRedirects(rules, { status: '301', target: 'nginx' }).findings;

  it('finds a loop of any length', () => {
    const found = findings('/a /b\n/b /c\n/c /a');

    assert.deepEqual(found, [{ level: 'high', message: 'Loop /a → /b → /c → /a.' }]);
    assert.deepEqual(findings('/a /b\n/b /a'), [{ level: 'high', message: 'Loop /a → /b → /a.' }]);
    assert.match(findings('/a /b\n/b /c')[0]?.message ?? '', /^Chain /);
  });

  it('finds a wildcard rule that matches its own target', () => {
    for (const rules of ['/blog/* /blog/:splat', '/* /new/:splat'])
      assert.match(findings(rules)[0]?.message ?? '', /matches its own target/, rules);

    assert.deepEqual(findings('/blog/* /news/:splat'), []);
    assert.deepEqual(findings('/blog/* https://x.test/blog/:splat'), []);
  });

  it('warns about a $ that servers would read as a variable', () => {
    assert.match(findings('/a /b$c')[0]?.message ?? '', /\$/);
    assert.deepEqual(findings('/a/* /b/$1'), []);
  });
});

describe('sitemaps', () => {
  it('accepts every W3C date precision', () => {
    for (const lastmod of ['2026', '2026-10', '2026-10-21', '2026-10-21T10:00+01:00'])
      assert.equal(generateSitemap(`https://x.test/ ${lastmod}`).count, 1, lastmod);

    assert.throws(() => generateSitemap('https://x.test/ 2026-13'), /W3C datetime/);
  });

  it('escapes a non-ASCII absolute URL as it does a relative one', () => {
    assert.match(
      generateSitemap('https://x.test/žluť').xml,
      /<loc>https:\/\/x\.test\/%C5%BElu%C5%A5<\/loc>/,
    );

    assert.match(generateSitemap('HTTPS://x.test/a').xml, /<loc>HTTPS:\/\/x\.test\/a<\/loc>/);
  });

  it('reports children that do not belong to the root', () => {
    const report = validateSitemap(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://x.test/</loc></sitemap></urlset>',
    );

    assert.deepEqual(report.errors, ['urlset holds a <sitemap> element; it takes only <url>.']);
  });
});

describe('email headers', () => {
  it('decodes RFC 2047 words for display', () => {
    const report = analyzeEmailHeaders('From: a@x.test\nSubject: =?UTF-8?B?xb5sdcWl?=');

    assert.equal(report.subject, 'žluť');
  });

  it('flags a weekday that does not match the date', () => {
    const message = (date: string) =>
      analyzeEmailHeaders(`From: a@x.test\nDate: ${date}`).findings.filter((finding) =>
        /weekday/i.test(finding.message),
      );

    assert.equal(message('Tue, 21 Oct 2026 07:28:00 +0000').length, 1);
    assert.equal(message('Wed, 21 Oct 2026 07:28:00 +0000').length, 0);
    assert.equal(message('Thu, 22 Oct 2026 00:30:00 +0200').length, 0);
    assert.equal(message('21 Oct 2026 07:28:00 +0000').length, 0);
  });
});

describe('curl to code details', () => {
  it('uses the POST option in PHP only when there is a body', () => {
    const empty = renderCurlAsCode("curl -X POST 'https://x.test/'", 'php').code;
    const body = renderCurlAsCode("curl 'https://x.test/' -d a=1", 'php').code;

    assert.doesNotMatch(empty, /CURLOPT_POST,/);
    assert.match(empty, /CURLOPT_CUSTOMREQUEST, "POST"/);
    assert.match(body, /CURLOPT_POST, true/);
  });

  it('percent-encodes characters java.net.URI refuses, outside an IPv6 host', () => {
    assert.match(
      renderCurlAsCode("curl -g 'https://x.test/glob[1]?f={a}'", 'java').code,
      /URI\.create\("https:\/\/x\.test\/glob%5B1%5D\?f=%7Ba%7D"\)/,
    );

    assert.match(
      renderCurlAsCode("curl 'http://[::1]:8080/a'", 'java').code,
      /URI\.create\("http:\/\/\[::1\]:8080\/a"\)/,
    );
  });
});
