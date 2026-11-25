import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { analyzeCsp, analyzeSecurityHeaders, buildCorsHeaders } from '../src/web';

const messages = (policy: string, level?: string) =>
  analyzeCsp(policy)
    .findings.filter((finding) => level === undefined || finding.level === level)
    .map((finding) => finding.message);
const base = "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";

describe('CSP script directives', () => {
  it('analyzes script-src-elem and script-src-attr, which override script-src', () => {
    const high = messages(
      `default-src 'self'; script-src 'self'; script-src-elem 'unsafe-inline' https:; script-src-attr 'unsafe-inline'; ${base}`,
      'high',
    );

    assert.deepEqual([...high].sort(), [
      "script-src-attr allows 'unsafe-inline', so injected scripts run.",
      "script-src-elem allows 'unsafe-inline', so injected scripts run.",
      'script-src-elem allows https:, which lets any matching script load.',
    ]);
  });

  it("does not raise host or scheme sources that 'strict-dynamic' ignores", () => {
    const policy = `script-src 'nonce-abc' 'strict-dynamic' https: http: *.example.com 'unsafe-inline'; ${base}`;

    assert.deepEqual(messages(policy, 'high'), []);
    assert.deepEqual(messages(policy, 'low'), []);

    assert.ok(
      messages(policy, 'info').some((message) =>
        /ignored because of 'strict-dynamic'/.test(message),
      ),
    );

    assert.equal(
      analyzeSecurityHeaders(`content-security-policy: ${policy}`).checks[1]?.status,
      'pass',
    );
  });

  it('treats a scheme wildcard like the scheme', () => {
    assert.match(messages(`script-src https://*; ${base}`, 'high')[0] ?? '', /allows https:\/\/\*/);
  });

  it('flags unquoted keywords, which browsers read as hosts', () => {
    assert.deepEqual(messages(`script-src self unsafe-inline; ${base}`, 'medium'), [
      `Source "self" in "script-src" is read as a host; write 'self'.`,
      `Source "unsafe-inline" in "script-src" is read as a host; write 'unsafe-inline'.`,
    ]);
  });
});

describe('CSP parsing', () => {
  it('knows the webrtc directive', () => {
    assert.deepEqual(
      messages(`default-src 'self'; webrtc 'block'; ${base}`).filter((message) =>
        message.includes('webrtc'),
      ),
      [],
    );
  });

  it('warns that a comma separates policies', () => {
    assert.ok(
      messages("default-src 'self', script-src 'none'", 'medium').some((message) =>
        /comma separates/i.test(message),
      ),
    );
  });

  it('decodes the entities of a meta content attribute before splitting', () => {
    const report = analyzeCsp(
      `<meta http-equiv="Content-Security-Policy" content="default-src &#39;self&#39;; img-src &apos;none&apos; https://a.test/?x&amp;y">`,
    );

    assert.equal(report.directives[0]?.sources[0], "'self'");
    assert.deepEqual(report.directives[1]?.sources, ["'none'", 'https://a.test/?x&y']);
    assert.equal(report.directives.length, 2);
  });
});

describe('security header checks', () => {
  const full = [
    'strict-transport-security: max-age=31536000; includeSubDomains',
    'x-content-type-options: nosniff',
    'referrer-policy: no-referrer',
    'permissions-policy: camera=()',
  ].join('\n');

  it('does not let a wide-open frame-ancestors pass', () => {
    for (const sources of ['*', 'https:', 'http: https:', 'https://*']) {
      const report = analyzeSecurityHeaders(
        `${full}\ncontent-security-policy: default-src 'self'; ${base.replace("frame-ancestors 'none'", `frame-ancestors ${sources}`)}`,
      );
      const framing = report.checks.find((check) => check.header === 'Framing');

      assert.equal(framing?.status, 'fail', sources);
      assert.notEqual(report.grade, 'A+', sources);
    }
  });

  it('accepts a named frame-ancestors host', () => {
    const report = analyzeSecurityHeaders(
      `content-security-policy: default-src 'self'; frame-ancestors https://a.test https://*.a.test`,
    );

    assert.equal(report.checks.find((check) => check.header === 'Framing')?.status, 'pass');
  });

  it('reads max-age as a whole directive and nosniff from the first value', () => {
    const hsts = analyzeSecurityHeaders('strict-transport-security: foo-max-age=99999999');
    const sniff = analyzeSecurityHeaders('x-content-type-options: nosniff, nosniff');

    assert.equal(hsts.checks[0]?.status, 'fail');

    assert.equal(
      sniff.checks.find((check) => check.header === 'X-Content-Type-Options')?.status,
      'pass',
    );
  });
});

describe('CORS origins and header lists', () => {
  it('refuses a wildcard inside an origin, which browsers never match', () => {
    assert.throws(() => buildCorsHeaders({ origins: 'https://*.example.com' }), /wildcard/);
    assert.equal(buildCorsHeaders({ origins: '*' }).origins[0], '*');
  });

  it('notes that * never covers Authorization, with or without credentials', () => {
    const open = buildCorsHeaders({ allowHeaders: '*', origins: '*' });

    assert.ok(open.findings.some((finding) => /Authorization/.test(finding.message)));
  });

  it('refuses a header name that is not an HTTP token', () => {
    assert.throws(
      () => buildCorsHeaders({ allowHeaders: 'Bad Header, X: y', origins: '*' }),
      /HTTP token/,
    );

    assert.throws(() => buildCorsHeaders({ exposeHeaders: 'a b', origins: '*' }), /HTTP token/);
  });
});
