import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { analyzeSecurityHeaders, buildSetCookie, parseCookies } from '../src/web';

const now = new Date('2026-10-26T00:00:00Z');
const cookie = (line: string) => parseCookies(`Set-Cookie: ${line}`, { now }).cookies[0]!;
const messages = (line: string) => cookie(line).findings.map((finding) => finding.message);

describe('Expires per RFC 6265 §5.1.1', () => {
  it('ignores values without a time token instead of treating them as past dates', () => {
    for (const text of ['0', '-1', '2026-01-01T00:00:00Z', 'tomorrow']) {
      const { attributes } = cookie(`a=1; Expires=${text}`);

      assert.equal(attributes.expires, undefined, text);
      assert.equal(attributes.expired, undefined, text);

      assert.ok(
        messages(`a=1; Expires=${text}`).some((m) => /not a date/.test(m)),
        text,
      );

      assert.ok(!messages(`a=1; Expires=${text}`).some((m) => /deletes/.test(m)), text);
    }
  });

  it('reads every token order in UTC', () => {
    for (const [text, expected] of [
      ['Sun, 06 Nov 2099 08:49:37 GMT', '2099-11-06T08:49:37.000Z'],
      ['Sunday, 06-Nov-99 08:49:37 GMT', '1999-11-06T08:49:37.000Z'],
      ['Sun Nov  6 08:49:37 2099', '2099-11-06T08:49:37.000Z'],
      ['6 November 2069 8:9:7', '2069-11-06T08:09:07.000Z'],
    ] as const)
      assert.equal(cookie(`a=1; Expires=${text}`).attributes.expires, expected, text);
  });

  it('fails on dates and times that do not exist', () => {
    for (const text of [
      '32 Jan 2099 00:00:00',
      '31 Feb 2099 10:00:00',
      '01 Jan 2099 24:00:00',
      '01 Jan 2099 00:60:00',
      '01 Jan 2099 00:00:60',
      '01 Jan 1600 00:00:00',
    ])
      assert.equal(cookie(`a=1; Expires=${text}`).attributes.expires, undefined, text);
  });

  it('builds from a real date only', () => {
    assert.throws(() => buildSetCookie({ expires: '0', name: 'a', value: 'b' }, now), /be a date/);

    assert.match(
      buildSetCookie({ expires: '2026-12-31', name: 'a', value: 'b' }, now).header,
      /Expires=Thu, 31 Dec 2026 00:00:00 GMT/,
    );
  });
});

describe('cookie flags', () => {
  it('flags missing Secure and HttpOnly', () => {
    assert.deepEqual(messages('session=abc; Path=/; SameSite=Lax'), [
      'No Secure attribute; the cookie is also sent over plain HTTP.',
      'No HttpOnly attribute; scripts can read the cookie. Add it unless they must.',
    ]);

    assert.deepEqual(messages('session=abc; Path=/; Secure; HttpOnly; SameSite=Lax'), []);
  });

  it('does not repeat Secure when a stricter finding names it, or nag a deletion', () => {
    assert.ok(!messages('a=1; SameSite=None').some((m) => /No Secure/.test(m)));
    assert.ok(!messages('__Secure-a=1; SameSite=Lax').some((m) => /No Secure/.test(m)));
    assert.deepEqual(messages('a=; Max-Age=0; SameSite=Lax'), []);
  });

  it('costs the headers report its pass row', () => {
    const report = analyzeSecurityHeaders('set-cookie: session=abc; Path=/; SameSite=Lax');

    assert.deepEqual(
      report.checks.filter((check) => check.header === 'Set-Cookie').map((check) => check.status),
      ['warn', 'warn'],
    );
  });

  it('flags an unknown SameSite and values outside cookie-octet', () => {
    assert.ok(
      messages('a=1; SameSite=Foo; Secure; HttpOnly').some((m) => /SameSite "Foo"/.test(m)),
    );

    assert.throws(() => buildSetCookie({ name: 'a', value: 'café' }, now), /must not contain/);
    assert.throws(() => buildSetCookie({ name: 'a', value: 'x\u0001' }, now), /must not contain/);
    assert.ok(messages('a=café; Secure; HttpOnly; SameSite=Lax').some((m) => /non-ASCII/.test(m)));
  });
});
