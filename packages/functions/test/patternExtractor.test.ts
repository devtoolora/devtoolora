import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { extractPatterns } from '@devtoolora/functions/text';

const base = { dedupe: true, ignoreCase: false, sort: false } as const;

describe('pattern extractor', () => {
  it('extracts and deduplicates emails', () => {
    assert.deepEqual(extractPatterns('a@x.io, b@y.org a@x.io', { ...base, pattern: 'email' }), {
      matches: ['a@x.io', 'b@y.org'],
      total: 3,
      unique: 2,
    });
  });

  it('uses capture group 1 of a custom pattern', () => {
    assert.deepEqual(
      extractPatterns('w 12px h 7px', { ...base, pattern: 'custom', custom: '(\\d+)px' }).matches,
      ['12', '7'],
    );
  });

  it('honours ignoreCase for custom patterns', () => {
    const options = { ...base, pattern: 'custom', custom: 'ab' } as const;

    assert.deepEqual(extractPatterns('AB ab', options).matches, ['ab']);

    assert.deepEqual(extractPatterns('AB ab', { ...options, ignoreCase: true }).matches, [
      'AB',
      'ab',
    ]);
  });

  it('extracts only valid ipv4 addresses', () => {
    assert.deepEqual(
      extractPatterns('10.0.0.1 999.1.1.1 192.168.1.10', { ...base, pattern: 'ipv4' }).matches,
      ['10.0.0.1', '192.168.1.10'],
    );
  });

  it('extracts ipv6, urls and numbers', () => {
    assert.deepEqual(
      extractPatterns('at 2001:db8:0:0:0:0:0:1 and fe80:0:0:0:1:2:3:4.', {
        ...base,
        pattern: 'ipv6',
      }).matches,
      ['2001:db8:0:0:0:0:0:1', 'fe80:0:0:0:1:2:3:4'],
    );

    assert.deepEqual(
      extractPatterns('see https://a.io/x) and http://b.io', { ...base, pattern: 'url' }).matches,
      ['https://a.io/x', 'http://b.io'],
    );

    assert.deepEqual(
      extractPatterns('-3 and 4,5 and 6.7', { ...base, pattern: 'number' }).matches,
      ['-3', '4,5', '6.7'],
    );
  });

  it('leaves sentence punctuation out of URLs and keeps balanced brackets', () => {
    const text =
      'See https://example.com. Also https://a.io/x, and https://d.io/p?q=1&r=2#f! https://e.io/a_(b) https://[::1]:8080/x https://f.io/a: HTTP://UP.COM [a](https://g.io/y)[b](https://h.io/z)';

    assert.deepEqual(extractPatterns(text, { ...base, pattern: 'url' }).matches, [
      'https://example.com',
      'https://a.io/x',
      'https://d.io/p?q=1&r=2#f',
      'https://e.io/a_(b)',
      'https://[::1]:8080/x',
      'https://f.io/a',
      'HTTP://UP.COM',
      'https://g.io/y',
      'https://h.io/z',
    ]);
  });

  it('reads hyphens, thousands separators and leading dots as part of ordinary numbers', () => {
    const numbers = (text: string): string[] =>
      extractPatterns(text, { ...base, dedupe: false, pattern: 'number' }).matches;

    assert.deepEqual(numbers('2024-01-15'), ['2024', '01', '15']);
    assert.deepEqual(numbers('a-3 10-20 -7'), ['3', '10', '20', '-7']);

    assert.deepEqual(numbers('1,234,567 $1,000.50 1.000,50'), [
      '1,234,567',
      '1,000.50',
      '1.000,50',
    ]);

    assert.deepEqual(numbers('.5 -.25 1.2.3 1,2345'), ['.5', '-.25', '1.2', '3', '1,2345']);
  });

  it('keeps combining marks in hashtags', () => {
    const hindi = '#\u0928\u092e\u0938\u094d\u0924\u0947';
    const accented = '#cafe\u0301';

    assert.deepEqual(
      extractPatterns(`${hindi} ${accented}`, { ...base, pattern: 'hashtag' }).matches,
      [hindi, accented],
    );
  });

  it('extracts compressed ipv6 and rejects time-like strings', () => {
    const options = { ...base, pattern: 'ipv6' } as const;

    assert.deepEqual(
      extractPatterns('a ::1 b 2001:db8::1 fe80::1 2001:db8:0:0:0:0:0:1', options).matches,
      ['::1', '2001:db8::1', 'fe80::1', '2001:db8:0:0:0:0:0:1'],
    );

    assert.deepEqual(extractPatterns('at 12:30:45 and 10:30: and 1::2::3', options).matches, []);
  });

  it('sorts by code point', () => {
    assert.deepEqual(
      extractPatterns('#Dev #dev', { ...base, pattern: 'hashtag', sort: true }).matches,
      ['#Dev', '#dev'],
    );
  });

  it('keeps duplicates when dedupe is off', () => {
    const result = extractPatterns('1 1', { ...base, dedupe: false, pattern: 'number' });

    assert.deepEqual(result, { matches: ['1', '1'], total: 2, unique: 1 });
  });

  it('rejects invalid custom patterns and limits', () => {
    assert.throws(
      () => extractPatterns('x', { ...base, pattern: 'custom', custom: 'a'.repeat(257) }),
      /1 to 256/,
    );

    assert.throws(
      () => extractPatterns('x', { ...base, pattern: 'custom', custom: '' }),
      /1 to 256/,
    );

    assert.throws(
      () => extractPatterns('x', { ...base, pattern: 'custom', custom: '(' }),
      /Invalid pattern/,
    );

    assert.throws(
      () => extractPatterns('x'.repeat(200_001), { ...base, pattern: 'number' }),
      /200,000/,
    );

    assert.throws(
      () => extractPatterns('1 '.repeat(50_001), { ...base, pattern: 'number' }),
      /50,000 matches/,
    );
  });

  it('keeps every built-in pattern linear on adversarial input', () => {
    const adversarial = {
      email: ['a'.repeat(200_000), 'a@'.repeat(100_000), `a@${'b.'.repeat(99_999)}`],
      hashtag: ['#'.repeat(200_000)],
      ipv4: ['1.'.repeat(100_000), '1'.repeat(200_000)],
      ipv6: [`${':'.repeat(199_999)}x`, `${'f:'.repeat(99_999)}fg`],
      number: ['-'.repeat(200_000), '-.'.repeat(100_000)],
      url: ['http:/'.repeat(33_333), `https://${'a'.repeat(199_992)}`],
    } as const;

    for (const [pattern, inputs] of Object.entries(adversarial)) {
      for (const input of inputs) {
        const started = performance.now();

        extractPatterns(input, { ...base, pattern: pattern as keyof typeof adversarial });

        assert.ok(performance.now() - started < 500, `${pattern} took too long`);
      }
    }
  });
});
