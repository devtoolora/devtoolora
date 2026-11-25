import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { buildSetCookie, parseCookies, summarizeFindings } from '@devtoolora/functions/web';

const now = new Date('2026-10-26T00:00:00Z');

describe('cookies', () => {
  it('parses a Set-Cookie line with every attribute', () => {
    const { cookies, findingCount } = parseCookies(
      'Set-Cookie: sid=abc123; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=3600',
      { now },
    );

    assert.equal(cookies.length, 1);
    assert.equal(cookies[0]?.kind, 'set-cookie');
    assert.equal(cookies[0]?.name, 'sid');
    assert.equal(cookies[0]?.value, 'abc123');
    assert.equal(cookies[0]?.size, 10);

    assert.deepEqual(cookies[0]?.attributes, {
      httpOnly: true,
      maxAge: 3600,
      partitioned: false,
      path: '/',
      sameSite: 'Strict',
      secure: true,
    });

    assert.equal(findingCount, 0);
  });

  it('reads a request Cookie header as one cookie per pair', () => {
    const { cookies } = parseCookies('Cookie: theme=dark; lang=cs; sid=abc', { now });

    assert.deepEqual(
      cookies.map((cookie) => [cookie.kind, cookie.name, cookie.value]),
      [
        ['cookie', 'theme', 'dark'],
        ['cookie', 'lang', 'cs'],
        ['cookie', 'sid', 'abc'],
      ],
    );
  });

  it('classifies prefix-less lines by their attributes', () => {
    const request = parseCookies('theme=dark; lang=cs; sid=abc', { now }).cookies;
    const withMaxAge = parseCookies('a=1; Max-Age=60; Expires=Wed, 21 Oct 2015 07:28:00 GMT', {
      now,
    }).cookies[0];

    assert.deepEqual(
      request.map((cookie) => [cookie.kind, cookie.name]),
      [
        ['cookie', 'theme'],
        ['cookie', 'lang'],
        ['cookie', 'sid'],
      ],
    );

    assert.notEqual(request[0]?.attributes, request[1]?.attributes);
    assert.equal(withMaxAge?.attributes.expired, undefined);

    assert.equal(
      withMaxAge?.findings.some((f) => f.message.includes('deletes the cookie')),
      false,
    );
  });

  it('keeps quoted values and parses two-digit Expires years', () => {
    const { cookies } = parseCookies('q="a=b"; Expires=Wed, 21-Oct-26 07:28:00 GMT', { now });

    assert.equal(cookies[0]?.value, '"a=b"');
    assert.equal(cookies[0]?.attributes.expires, '2026-10-21T07:28:00.000Z');
    assert.equal(cookies[0]?.attributes.expired, true);
  });

  it('reports prefix, SameSite, size and attribute findings', () => {
    const host = parseCookies('__Host-id=1; Path=/app; Secure', { now }).cookies[0];
    const none = parseCookies('t=1; SameSite=None', { now }).cookies[0];
    const expired = parseCookies('old=1; Expires=Wed, 21 Oct 2015 07:28:00 GMT', { now })
      .cookies[0];
    const unknown = parseCookies('Set-Cookie: x=1; Foo=bar', { now }).cookies[0];
    const big = parseCookies(`big=${'a'.repeat(4100)}`, { now }).cookies[0];

    assert.equal(host?.findings[0]?.level, 'high');
    assert.match(host?.findings[0]?.message ?? '', /__Host-.*Path/);

    assert.deepEqual(none?.findings[0], {
      level: 'high',
      message: 'SameSite=None requires Secure.',
    });

    assert.equal(expired?.attributes.expired, true);

    assert.equal(
      expired?.findings.find((f) => f.level === 'info')?.message,
      'Expires is in the past, which deletes the cookie.',
    );

    assert.deepEqual(unknown?.findings[0], {
      level: 'medium',
      message: 'Unknown attribute "Foo".',
    });

    assert.equal(big?.findings[0]?.level, 'medium');
    assert.equal(summarizeFindings(host?.findings ?? []), '1 high · 1 medium · 1 low');
  });

  it('enforces its limits', () => {
    assert.throws(() => parseCookies(''), /Cookie input is required\./);

    assert.throws(
      () => parseCookies('x'.repeat(65_537)),
      /Cookie input exceeds 65,536 characters\./,
    );

    assert.throws(
      () => parseCookies(Array.from({ length: 1001 }, (_, i) => `c${i}=1`).join('\n')),
      /Cookie input exceeds 1,000 cookies\./,
    );
  });

  it('builds a Set-Cookie header in canonical attribute order', () => {
    const built = buildSetCookie(
      {
        httpOnly: true,
        maxAge: '3600',
        name: 'sid',
        path: '/',
        sameSite: 'Lax',
        secure: true,
        value: 'abc',
      },
      now,
    );

    assert.equal(
      built.header,
      'Set-Cookie: sid=abc; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Lax',
    );

    assert.deepEqual(built.findings, []);

    assert.match(
      buildSetCookie({ expires: '2026-12-31T00:00:00Z', name: 'a', value: 'b' }, now).header,
      /Expires=Thu, 31 Dec 2026 00:00:00 GMT/,
    );

    assert.throws(
      () => buildSetCookie({ name: 'bad name', value: 'x' }, now),
      /Cookie name must be an RFC 6265 token\./,
    );

    assert.throws(
      () => buildSetCookie({ name: 'a', value: 'x;y' }, now),
      /Cookie value must not contain/,
    );

    assert.throws(
      () => buildSetCookie({ maxAge: '1.5', name: 'a', value: 'x' }, now),
      /Max-Age must be a whole number\./,
    );
  });
});
