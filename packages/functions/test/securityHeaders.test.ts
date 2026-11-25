import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { analyzeSecurityHeaders, renderSecurityHeadersReport } from '../src/web/securityHeaders';

const hardened = [
  'HTTP/2 200',
  'strict-transport-security: max-age=63072000; includeSubDomains; preload',
  "content-security-policy: default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'x-content-type-options: nosniff',
  'referrer-policy: strict-origin-when-cross-origin',
  'permissions-policy: camera=(), microphone=()',
  'cross-origin-opener-policy: same-origin',
  'cross-origin-resource-policy: same-origin',
].join('\r\n');

const messages = (block: string) =>
  analyzeSecurityHeaders(block)
    .checks.filter((c) => c.status === 'warn')
    .map((c) => `${c.header}: ${c.message}`);

describe('security headers analyzer', () => {
  it('grades a hardened response A+', () => {
    const report = analyzeSecurityHeaders(`${hardened}\r\n\r\n`);

    assert.equal(report.grade, 'A+');
    assert.equal(report.gradedPresent, 6);
    assert.equal(report.warnings, 0);
    assert.equal(report.checks.filter((c) => c.graded).length, 6);
  });

  it('parses a BOM and plain newlines like clean text', () => {
    assert.equal(analyzeSecurityHeaders(`﻿${hardened}`).grade, 'A+');
    assert.equal(analyzeSecurityHeaders(hardened.replaceAll('\r\n', '\n')).grade, 'A+');
  });

  it('grades by the number of graded headers present', () => {
    const grade = (block: string) => analyzeSecurityHeaders(block).grade;

    assert.equal(grade('HTTP/1.1 200 OK\ncontent-type: text/html\nserver: Apache/2.4.57'), 'F');
    assert.equal(grade('x-frame-options: SAMEORIGIN\nx-content-type-options: nosniff'), 'E');

    assert.equal(
      grade(
        'x-frame-options: SAMEORIGIN\nx-content-type-options: nosniff\nreferrer-policy: no-referrer',
      ),
      'D',
    );

    assert.equal(grade(hardened.replace(/permissions-policy:[^\r]*\r\n/, '')), 'B');
    assert.equal(grade(hardened.replace('max-age=63072000', 'max-age=300')), 'A');
  });

  it('warns on weak values and disclosures', () => {
    assert.match(messages('strict-transport-security: max-age=300')[0] ?? '', /31,536,000/);
    assert.match(messages('x-frame-options: ALLOW-FROM https://a.example')[0] ?? '', /ALLOW-FROM/);
    assert.match(messages('x-xss-protection: 1; mode=block')[0] ?? '', /deprecated/);
    assert.equal(messages('x-xss-protection: 0').length, 0);
    assert.match(messages('server: nginx/1.25.3')[0] ?? '', /version/);
    assert.equal(messages('server: nginx').length, 0);

    assert.match(
      messages("content-security-policy: default-src 'self' 'unsafe-inline'")[0] ?? '',
      /'unsafe-inline'/,
    );

    assert.equal(
      analyzeSecurityHeaders("content-security-policy-report-only: default-src 'self'").checks.find(
        (c) => c.header === 'Content-Security-Policy',
      )?.status,
      'fail',
    );

    assert.equal(
      analyzeSecurityHeaders('set-cookie: a=1; SameSite=None').cookieFindings[0]?.level,
      'high',
    );

    assert.equal(
      analyzeSecurityHeaders('x-content-type-options: NOSNIFF').checks.find(
        (c) => c.header === 'X-Content-Type-Options',
      )?.status,
      'pass',
    );
  });

  it('counts cookie warnings and renders the report', () => {
    const report = analyzeSecurityHeaders('set-cookie: a=1; SameSite=None');

    assert.equal(report.warnings, 2);

    const text = renderSecurityHeadersReport(report);

    assert.match(text, /^Grade: F/);
    assert.match(text, /# Graded headers/);
    assert.match(text, /# Other checks/);
    assert.match(text, /# Cookies/);
    assert.match(renderSecurityHeadersReport(analyzeSecurityHeaders('server: x')), /No Set-Cookie/);
  });

  it('survives bad CSP and malformed cookies', () => {
    const csp = (block: string) =>
      analyzeSecurityHeaders(block).checks.find((c) => c.header === 'Content-Security-Policy');

    assert.equal(csp('content-security-policy:')?.status, 'fail');
    assert.equal(csp(`content-security-policy: ${'a '.repeat(40_000)}`)?.status, 'warn');

    const report = analyzeSecurityHeaders('set-cookie: a=1; SameSite=None\nset-cookie: foo');

    assert.equal(report.cookieFindings[0]?.level, 'high');
    assert.equal(report.warnings, 3);
    assert.match(renderSecurityHeadersReport(report), /3 warnings/);

    assert.match(
      renderSecurityHeadersReport(
        analyzeSecurityHeaders('set-cookie: a=1; Secure; HttpOnly; SameSite=Lax'),
      ),
      /No cookie findings\./,
    );
  });

  it('uses the last referrer-policy token and rejects lowercase requests', () => {
    assert.equal(messages('referrer-policy: unsafe-url, no-referrer').length, 0);
    assert.match(messages('referrer-policy: no-referrer, unsafe-url')[0] ?? '', /unsafe-url/);
    assert.throws(() => analyzeSecurityHeaders('get / HTTP/1.1\nhost: x'), /not a request/);
  });

  it('rejects request blocks and bad input', () => {
    assert.throws(
      () => analyzeSecurityHeaders('GET / HTTP/1.1\nHost: x'),
      /Paste response headers, not a request\./,
    );

    assert.throws(() => analyzeSecurityHeaders(''), /HTTP headers input is required\./);

    assert.throws(
      () => analyzeSecurityHeaders('x'.repeat(1_048_577)),
      /exceeds 1,048,576 characters\./,
    );
  });
});
