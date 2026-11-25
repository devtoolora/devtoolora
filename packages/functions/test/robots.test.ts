import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { generateRobots, parseRobots, testRobots } from '@devtoolora/functions/web';

const robots = [
  'User-agent: *',
  'Disallow: /admin/',
  'Allow: /admin/public/',
  '',
  'User-agent: Googlebot',
  'Disallow: /private$',
  'Disallow: /*.pdf$',
  'Disallow: /caf%C3%A9',
  'Sitemap: https://example.com/sitemap.xml',
].join('\n');

describe('robots', () => {
  it('picks the most specific group and the longest matching rule', () => {
    const google = testRobots(robots, {
      agent: 'googlebot',
      paths:
        '/private\n/private-page\n/admin/\n/a/b.pdf\n/a/b.pdfx\nhttps://example.com/caf%C3%A9?x=1',
    });

    assert.deepEqual(
      google.results.map((r) => [r.path, r.allowed, r.rule?.line]),
      [
        ['/private', false, 6],
        ['/private-page', true, undefined],
        ['/admin/', true, undefined],
        ['/a/b.pdf', false, 7],
        ['/a/b.pdfx', true, undefined],
        ['/caf%C3%A9?x=1', false, 8],
      ],
    );

    const other = testRobots(robots, {
      agent: 'Bingbot',
      paths: '/admin/public/x\n/admin/x\n/a%2Fb',
    });

    assert.deepEqual(
      other.results.map((r) => [r.allowed, r.rule?.line]),
      [
        [true, 3],
        [false, 2],
        [true, undefined],
      ],
    );

    assert.deepEqual(google.file.sitemaps, ['https://example.com/sitemap.xml']);

    assert.equal(
      testRobots('\uFEFFuser-agent: *\nDISALLOW: /a/', { agent: 'x', paths: '/a/b' }).results[0]
        ?.allowed,
      false,
    );

    assert.equal(
      testRobots('User-agent: *\nDisallow:', { agent: 'x', paths: '/anything' }).results[0]
        ?.allowed,
      true,
    );

    assert.equal(
      testRobots('User-agent: *\nDisallow: /a/', { agent: 'x', paths: '/a%2Fb' }).results[0]
        ?.allowed,
      true,
    );

    assert.equal(
      testRobots('User-agent: *\nDisallow: /a\nAllow: /a', { agent: 'x', paths: '/a' }).results[0]
        ?.allowed,
      true,
    );
  });

  it('warns about malformed lines', () => {
    assert.deepEqual(
      parseRobots('Disallow: /x\nUser-agent: *\nDisallow: admin\nFoo: bar\nSitemap: /relative')
        .warnings,
      [
        'Line 1: rule before any User-agent group.',
        'Line 3: path "admin" should start with "/".',
        'Line 4: unknown field "Foo".',
        'Line 5: sitemap "/relative" is not an absolute http(s) URL.',
      ],
    );
  });

  it('generates a file', () => {
    assert.equal(
      generateRobots({
        agent: '*',
        allow: '/admin/public/',
        crawlDelay: '10',
        disallow: '/admin/\n/tmp/',
        sitemaps: 'https://example.com/sitemap.xml',
      }),
      'User-agent: *\nAllow: /admin/public/\nDisallow: /admin/\nDisallow: /tmp/\nCrawl-delay: 10\n\nSitemap: https://example.com/sitemap.xml\n',
    );

    assert.equal(generateRobots({}), 'User-agent: *\nDisallow:\n');

    assert.throws(
      () => generateRobots({ disallow: 'admin' }),
      /Disallow path "admin" must start with "\/"\./,
    );

    assert.throws(
      () => generateRobots({ sitemaps: 'ftp://x' }),
      /Sitemap "ftp:\/\/x" must be an absolute http\(s\) URL\./,
    );

    assert.throws(
      () => generateRobots({ crawlDelay: 'x' }),
      /Crawl delay must be a number from 0 to 3,600\./,
    );
  });

  it('enforces its limits', () => {
    assert.throws(
      () => testRobots('', { agent: '*', paths: '/' }),
      /robots.txt input is required\./,
    );

    assert.throws(
      () => testRobots('x'.repeat(500_001), { agent: '*', paths: '/' }),
      /robots.txt input exceeds 500,000 characters\./,
    );

    assert.throws(
      () =>
        testRobots(robots, {
          agent: '*',
          paths: Array.from({ length: 1001 }, () => '/').join('\n'),
        }),
      /Paths exceed 1,000 lines\./,
    );

    assert.throws(
      () => testRobots(robots, { agent: '*', paths: '' }),
      /At least one path is required\./,
    );
  });

  it('survives hostile patterns and bad escapes', () => {
    const hostile = testRobots(`User-agent: *\nDisallow: /${'*a'.repeat(12)}b`, {
      agent: 'x',
      paths: `/${'a'.repeat(40)}`,
    });

    assert.equal(hostile.results[0]?.allowed, true);

    assert.equal(
      testRobots('User-agent: *\nDisallow: /caf%C3%A9', { agent: 'x', paths: '/caf%C3%A9/100%' })
        .results[0]?.allowed,
      false,
    );

    assert.equal(
      testRobots('User-agent: *\nDisallow: /a$', { agent: 'x', paths: '/a#frag' }).results[0]
        ?.allowed,
      false,
    );
  });

  it('warns about empty groups and caps generated rules', () => {
    assert.deepEqual(
      parseRobots('User-agent: a\nUser-agent: *\nDisallow: /x\n\nUser-agent: b').warnings,
      ['Line 5: group "b" has no rules.'],
    );

    assert.throws(
      () => generateRobots({ disallow: Array.from({ length: 1001 }, () => '/a').join('\n') }),
      /Rules exceed 1,000 lines\./,
    );
  });

  it('parses the default generated file without warnings', () => {
    assert.deepEqual(parseRobots(generateRobots({})).warnings, []);
  });
});
