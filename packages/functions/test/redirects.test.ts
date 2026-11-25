import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { generateRedirects } from '@devtoolora/functions/web';

const rules = '/old /new\n/blog/* /articles/:splat 302\n/gone -> https://other.example/x 308';

describe('redirects', () => {
  it('renders every target', () => {
    assert.equal(
      generateRedirects(rules, { status: '301', target: 'netlify' }).text,
      '/old /new 301\n/blog/* /articles/:splat 302\n/gone https://other.example/x 308\n',
    );

    assert.equal(
      generateRedirects(rules, { status: '301', target: 'nginx' }).text,
      'location = /old {\n  return 301 /new;\n}\nlocation ~ ^/blog/(.*)$ {\n  return 302 /articles/$1;\n}\nlocation = /gone {\n  return 308 https://other.example/x;\n}\n',
    );

    assert.equal(
      generateRedirects(rules, { status: '301', target: 'apache' }).text,
      'RedirectMatch 301 ^/old$ /new\nRedirectMatch 302 ^/blog/(.*)$ /articles/$1\nRedirectMatch 308 ^/gone$ https://other.example/x\n',
    );

    assert.deepEqual(
      JSON.parse(generateRedirects(rules, { status: '301', target: 'vercel' }).text),
      {
        redirects: [
          { destination: '/new', source: '/old', statusCode: 301 },
          { destination: '/articles/:path*', source: '/blog/:path*', statusCode: 302 },
          { destination: 'https://other.example/x', permanent: true, source: '/gone' },
        ],
      },
    );

    assert.deepEqual(
      JSON.parse(generateRedirects('/a /b 307', { status: '301', target: 'vercel' }).text)
        .redirects[0],
      { destination: '/b', permanent: false, source: '/a' },
    );

    assert.equal(
      generateRedirects('/a\t/b\n/c,/d\n/e → /f', { status: '302', target: 'netlify' }).text,
      '/a /b 302\n/c /d 302\n/e /f 302\n',
    );

    assert.equal(
      generateRedirects('/docs/* /help/$1', { status: '301', target: 'netlify' }).text,
      '/docs/* /help/:splat 301\n',
    );
  });

  it('reports loops, duplicates and chains', () => {
    assert.equal(
      generateRedirects('/a /a', { status: '301', target: 'netlify' }).findings[0]?.level,
      'high',
    );

    const dup = generateRedirects('/a /b\n/a /c', { status: '301', target: 'netlify' });

    assert.equal(dup.count, 1);

    assert.deepEqual(dup.findings[0], {
      level: 'medium',
      message: 'Line 2: duplicate from "/a"; the first rule wins.',
    });

    assert.deepEqual(
      generateRedirects('/a /b\n/b /c', { status: '301', target: 'netlify' }).findings[0],
      { level: 'low', message: 'Chain /a → /b → /c; point /a at /c directly.' },
    );

    const loop = generateRedirects('/a /b\n/b /a', { status: '301', target: 'netlify' });

    assert.deepEqual(loop.findings, [{ level: 'high', message: 'Loop /a → /b → /a.' }]);

    assert.equal(
      generateRedirects('/a /b 302', { status: '301', target: 'netlify' }).findings[0]?.level,
      'info',
    );
  });

  it('rejects malformed lines and enforces limits', () => {
    const run = (value: string) => generateRedirects(value, { status: '301', target: 'netlify' });

    assert.throws(() => run('old /new'), /Line 1: from "old" must start with "\/"\./);
    assert.throws(() => run('/a?x=1 /b'), /Line 1: query strings in from are unsupported\./);

    assert.throws(
      () => run('/a(b) /c'),
      /Line 1: from "\/a\(b\)" may only end in "\/\*"; other patterns are unsupported\./,
    );

    assert.throws(() => run('/a /b 303'), /Line 1: status must be 301, 302, 307 or 308\./);
    assert.throws(() => run('/a'), /Line 1: expected "from to \[status\]"\./);
    assert.throws(() => run('/a /b;x'), /Line 1: to contains a character/);
    assert.throws(() => run('/a /b\\c'), /Line 1: to contains a character/);
    assert.throws(() => run('/a|b /c'), /Line 1: from "\/a\|b" may only end/);
    assert.throws(() => run('/a /b/:splat'), /Line 1: to uses a wildcard/);
    assert.throws(() => run(''), /Redirect rules input is required\./);

    assert.throws(
      () => generateRedirects(rules, { status: '301', target: 'iis' }),
      /Target must be nginx, apache, netlify or vercel\./,
    );

    assert.throws(
      () => run(Array.from({ length: 10_001 }, (_, i) => `/a${i} /b`).join('\n')),
      /Redirect rules exceed 10,000 lines\./,
    );

    assert.throws(() => run(`/${'a'.repeat(2048)} /b`), /Line 1 exceeds 2,048 characters\./);
  });
});
