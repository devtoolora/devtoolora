import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { analyzeCsp, renderCspReport } from '@devtoolora/functions/web';

const strict =
  "default-src 'self'; script-src 'self' 'nonce-abc' 'strict-dynamic'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";

describe('csp', () => {
  it('accepts a strict policy without findings', () => {
    const report = analyzeCsp(strict);

    assert.equal(report.directives.length, 6);
    assert.deepEqual(report.findings, []);
    assert.equal(report.header, `Content-Security-Policy: ${strict}`);
    assert.equal(report.reportOnly, false);
  });

  it('reads header lines, meta tags and one directive per line', () => {
    assert.equal(
      analyzeCsp("Content-Security-Policy-Report-Only: default-src 'self'").reportOnly,
      true,
    );

    assert.deepEqual(
      analyzeCsp('<meta http-equiv="Content-Security-Policy" content="default-src \'self\'">')
        .directives,
      [{ name: 'default-src', sources: ["'self'"] }],
    );

    assert.equal(
      analyzeCsp("script-src 'self' https://cdn.example.com\nobject-src 'none'\nbase-uri 'self'")
        .header,
      "Content-Security-Policy: script-src 'self' https://cdn.example.com; object-src 'none'; base-uri 'self'",
    );

    assert.equal(analyzeCsp("DEFAULT-SRC 'SELF'").policy, "default-src 'self'");

    assert.equal(
      analyzeCsp('default-src "x"').meta,
      '<meta http-equiv="Content-Security-Policy" content="default-src &quot;x&quot;">',
    );
  });

  it('reports unsafe sources, missing directives and duplicates', () => {
    const legacy = analyzeCsp("default-src 'self' 'unsafe-inline' 'unsafe-eval'");
    const high = legacy.findings.filter((f) => f.level === 'high').map((f) => f.message);

    assert.equal(high.length, 2);
    assert.match(high[0] ?? '', /'unsafe-inline'/);
    assert.match(high[1] ?? '', /'unsafe-eval'/);
    assert.ok(legacy.findings.some((f) => f.level === 'medium' && /base-uri/.test(f.message)));
    assert.ok(legacy.findings.some((f) => f.level === 'low' && /frame-ancestors/.test(f.message)));

    assert.equal(
      analyzeCsp(
        "script-src 'nonce-a' 'unsafe-inline'; object-src 'none'; base-uri 'none'",
      ).findings.find((f) => /'unsafe-inline'/.test(f.message))?.level,
      'info',
    );

    assert.equal(
      analyzeCsp("script-src 'strict-dynamic'; object-src 'none'; base-uri 'none'").findings[0]
        ?.level,
      'high',
    );

    assert.ok(
      analyzeCsp("script-src 'self'; base-uri 'none'").findings.some(
        (f) => f.level === 'high' && /object-src/.test(f.message),
      ),
    );

    const dup = analyzeCsp("default-src 'self'; default-src 'none'");

    assert.deepEqual(dup.directives, [{ name: 'default-src', sources: ["'self'"] }]);

    assert.deepEqual(dup.findings.filter((f) => f.level === 'medium')[0], {
      level: 'medium',
      message: 'Duplicate directive "default-src"; browsers keep the first.',
    });

    assert.deepEqual(
      analyzeCsp(
        "foo-src 'self'; default-src 'self'; object-src 'none'; base-uri 'none'",
      ).findings.filter((f) => f.level === 'medium'),
      [{ level: 'medium', message: 'Unknown directive "foo-src".' }],
    );

    assert.ok(
      analyzeCsp(
        "default-src 'self'; report-uri /csp; object-src 'none'; base-uri 'none'",
      ).findings.some((f) => f.level === 'low' && /report-uri/.test(f.message)),
    );
  });

  it('skips presence checks for report-only and flags malformed sources', () => {
    const report = analyzeCsp("Content-Security-Policy-Report-Only: default-src 'self'");

    assert.deepEqual(
      report.findings.map((f) => f.level),
      ['info'],
    );

    assert.ok(
      analyzeCsp("default-src 'self' 'oops").findings.some(
        (f) => f.level === 'medium' && /Malformed source/.test(f.message),
      ),
    );

    assert.match(renderCspReport(report), /# Policy[\s\S]*# Directives[\s\S]*# Findings/);
  });

  it('flags meta-ignored directives, style fallback and scheme case', () => {
    const meta = analyzeCsp(
      `<meta http-equiv="X-Other" content="a"><META HTTP-EQUIV="content-security-policy" content="default-src 'self'; frame-ancestors 'none'; sandbox; report-uri /r">`,
    );

    assert.ok(
      meta.findings.some(
        (f) => f.level === 'medium' && /"frame-ancestors" is ignored/.test(f.message),
      ),
    );

    assert.equal(meta.findings.filter((f) => /ignored in a <meta>/.test(f.message)).length, 3);

    assert.ok(
      analyzeCsp("default-src 'self' 'unsafe-inline'; script-src 'self'").findings.some(
        (f) => f.level === 'medium' && /default-src allows 'unsafe-inline'/.test(f.message),
      ),
    );

    assert.ok(
      analyzeCsp("script-src HTTPS: https://*.example.com; object-src 'none'").findings.some(
        (f) => f.level === 'high',
      ),
    );

    assert.ok(
      analyzeCsp("script-src https://*.example.com; object-src 'none'").findings.some(
        (f) => f.level === 'low' && /wildcard/.test(f.message),
      ),
    );

    assert.equal(analyzeCsp("img-src 'self' data:").header.endsWith("img-src 'self' data:"), true);
  });

  it('enforces its limits', () => {
    assert.throws(() => analyzeCsp(' '), /CSP input is required\./);
    assert.throws(() => analyzeCsp('x'.repeat(65_537)), /CSP input exceeds 65,536 characters\./);

    assert.throws(
      () => analyzeCsp(Array.from({ length: 101 }, (_, i) => `d${i}-src 'self'`).join('; ')),
      /CSP input exceeds 100 directives\./,
    );

    assert.throws(
      () => analyzeCsp(`img-src ${Array.from({ length: 501 }, (_, i) => `a${i}.com`).join(' ')}`),
      /exceeds 500 sources/,
    );
  });
});
