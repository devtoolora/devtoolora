import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { buildCorsHeaders } from '@devtoolora/functions/web';

describe('cors', () => {
  it('builds preflight and actual response headers', () => {
    const report = buildCorsHeaders({
      allowHeaders: 'Content-Type, Authorization',
      maxAge: '600',
      methods: 'GET,POST',
      origins: 'https://app.example.com',
    });

    assert.deepEqual(report.preflight, [
      { name: 'Access-Control-Allow-Origin', value: 'https://app.example.com' },
      { name: 'Access-Control-Allow-Methods', value: 'GET, POST' },
      { name: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
      { name: 'Access-Control-Max-Age', value: '600' },
      { name: 'Vary', value: 'Origin' },
    ]);

    assert.deepEqual(report.actual, [
      { name: 'Access-Control-Allow-Origin', value: 'https://app.example.com' },
      { name: 'Vary', value: 'Origin' },
    ]);

    assert.equal(report.preflightRequired, true);

    assert.match(
      report.text,
      /## Preflight response \(OPTIONS\)[\s\S]*## Actual response[\s\S]*## How the browser decides/,
    );
  });

  it('handles wildcard, credentials, null and private network', () => {
    const open = buildCorsHeaders({ methods: 'GET', origins: '*' });

    assert.deepEqual(open.preflight, [
      { name: 'Access-Control-Allow-Origin', value: '*' },
      { name: 'Access-Control-Allow-Methods', value: 'GET' },
    ]);

    assert.equal(open.preflightRequired, false);

    assert.throws(
      () => buildCorsHeaders({ credentials: true, origins: '*' }),
      /\* cannot be combined with credentials\./,
    );

    const mixed = buildCorsHeaders({ credentials: true, origins: '*\nhttps://a.example' });

    assert.equal(mixed.preflight[0]?.value, 'https://a.example');
    assert.equal(mixed.findings[0]?.level, 'high');

    assert.ok(
      mixed.preflight.some(
        (h) => h.name === 'Access-Control-Allow-Credentials' && h.value === 'true',
      ),
    );

    assert.equal(buildCorsHeaders({ origins: 'null' }).findings[0]?.level, 'high');

    assert.ok(
      buildCorsHeaders({ origins: 'https://a.example', privateNetwork: true }).preflight.some(
        (h) => h.name === 'Access-Control-Allow-Private-Network',
      ),
    );

    assert.ok(
      buildCorsHeaders({ maxAge: '90000', origins: 'https://a.example' }).findings.some(
        (f) => f.level === 'info' && /7,200/.test(f.message),
      ),
    );

    assert.ok(
      buildCorsHeaders({
        allowHeaders: '*',
        credentials: true,
        origins: 'https://a.example',
      }).findings.some((f) => f.level === 'medium' && /Authorization/.test(f.message)),
    );
  });

  it('rejects malformed input', () => {
    assert.throws(
      () => buildCorsHeaders({ origins: 'example.com' }),
      /Origin "example.com" must be scheme:\/\/host\[:port\]\./,
    );

    assert.throws(
      () => buildCorsHeaders({ origins: 'https://a.example/path' }),
      /Origin "https:\/\/a.example\/path" must be/,
    );

    assert.throws(() => buildCorsHeaders({ origins: '' }), /At least one origin is required\./);

    assert.throws(
      () => buildCorsHeaders({ maxAge: '-1', origins: '*' }),
      /Max age must be a whole number from 0 to 31,536,000\./,
    );

    assert.throws(
      () => buildCorsHeaders({ methods: 'FOO', origins: '*' }),
      /Method "FOO" is not one of GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS\./,
    );

    assert.throws(
      () =>
        buildCorsHeaders({
          origins: Array.from({ length: 101 }, (_, i) => `https://o${i}.example`).join('\n'),
        }),
      /Origins exceed 100 entries\./,
    );
  });

  it('enforces field limits and tidies lists', () => {
    assert.throws(
      () => buildCorsHeaders({ origins: 'https://a.example', allowHeaders: 'x'.repeat(2049) }),
      /Allowed request headers exceed 2,048 characters\./,
    );

    const report = buildCorsHeaders({
      allowHeaders: 'X-A, x-a',
      origins: '*\n*',
    });

    assert.equal(report.preflight[2]?.value, 'X-A');
    assert.deepEqual(report.origins, ['*']);
    assert.doesNotMatch(report.text, /must echo/);
  });
});
