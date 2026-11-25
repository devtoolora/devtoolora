import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { describe, it } from 'vitest';
import { buildDkim, parseDkim } from '../src/web/dkim';
import { buildDmarc, parseDmarc } from '../src/web/dmarc';
import { detectEmailAuthKind, parseEmailAuthRecord, unquoteTxtRecord } from '../src/web/emailAuth';
import { buildSpf, parseSpf } from '../src/web/spf';

const spkiBase64 = (bits: number) =>
  generateKeyPairSync('rsa', { modulusLength: bits })
    .publicKey.export({ format: 'der', type: 'spki' })
    .toString('base64');

describe('email auth records', () => {
  it('parses and builds SPF', () => {
    const spf = parseSpf('v=spf1 include:_spf.google.com ip4:203.0.113.0/24 mx -all');

    assert.deepEqual(
      spf.terms.map((t) => [t.qualifier, t.name, t.value, t.lookup]),
      [
        ['+', 'include', '_spf.google.com', true],
        ['+', 'ip4', '203.0.113.0/24', false],
        ['+', 'mx', undefined, true],
        ['-', 'all', undefined, false],
      ],
    );

    assert.equal(spf.lookups, 2);
    assert.deepEqual(spf.findings, []);
    assert.equal(parseSpf('v=spf1 +all').findings[0]?.level, 'high');
    assert.equal(parseSpf('v=spf1 mx ?all').findings[0]?.level, 'medium');

    assert.deepEqual(parseSpf('v=spf1 ip4:203.0.113.1').findings, [
      {
        level: 'medium',
        message: 'No "all" mechanism and no redirect; the record never ends with a decision.',
      },
    ]);

    assert.ok(
      parseSpf('v=spf1 ptr -all').findings.some(
        (f) => f.level === 'medium' && /ptr/.test(f.message),
      ),
    );

    assert.ok(
      parseSpf('v=spf1 -all mx').findings.some(
        (f) => f.level === 'medium' && /after "all"/.test(f.message),
      ),
    );

    assert.equal(
      parseSpf(
        `v=spf1 ${Array.from({ length: 11 }, (_, i) => `include:s${i}.example`).join(' ')} -all`,
      ).findings[0]?.level,
      'high',
    );

    assert.ok(
      parseSpf('v=spf1 ip4:300.1.1.1 -all').findings.some(
        (f) => f.level === 'medium' && /300.1.1.1/.test(f.message),
      ),
    );

    assert.ok(
      parseSpf('v=spf1 redirect=_spf.example.com -all').findings.some((f) => f.level === 'info'),
    );

    assert.deepEqual(
      buildSpf({
        all: '-all',
        includes: '_spf.google.com\nspf.protection.outlook.com',
        ip4: '203.0.113.0/24',
        mx: true,
      }),
      {
        findings: [],
        lookups: 3,
        record:
          'v=spf1 include:_spf.google.com include:spf.protection.outlook.com ip4:203.0.113.0/24 mx -all',
      },
    );

    assert.throws(() => buildSpf({ all: 'all' }), /All qualifier must be -all, ~all or \?all\./);

    assert.throws(
      () => buildSpf({ all: '-all', ip6: 'nope' }),
      /ip6 "nope" is not an IPv6 address or CIDR\./,
    );
  });

  it('parses and builds DMARC', () => {
    const ok = parseDmarc('v=DMARC1; p=reject; rua=mailto:dmarc@example.com; pct=100; adkim=s');

    assert.equal(ok.tags.length, 5);

    assert.deepEqual(ok.findings, [
      { level: 'info', message: 'No sp tag; subdomains inherit p=reject.' },
    ]);

    assert.deepEqual(
      parseDmarc('v=DMARC1; p=none').findings.map((f) => f.level),
      ['medium', 'medium', 'info'],
    );

    assert.equal(parseDmarc('p=reject; v=DMARC1').findings[0]?.level, 'high');
    assert.equal(parseDmarc('v=DMARC1; p=maybe').findings[0]?.level, 'high');

    assert.ok(
      parseDmarc('v=DMARC1; p=reject; rua=dmarc@example.com').findings.some(
        (f) => f.level === 'medium' && /mailto:/.test(f.message),
      ),
    );

    assert.ok(
      parseDmarc('v=DMARC1; p=reject; rua=mailto:a@x; foo=1').findings.some(
        (f) => f.level === 'low' && /"foo"/.test(f.message),
      ),
    );

    assert.equal(
      buildDmarc({
        adkim: 's',
        aspf: 'r',
        pct: '50',
        policy: 'quarantine',
        rua: 'a@example.com\nb@example.com',
      }).record,
      'v=DMARC1; p=quarantine; rua=mailto:a@example.com,mailto:b@example.com; pct=50; adkim=s; aspf=r',
    );

    assert.throws(
      () => buildDmarc({ policy: 'block' }),
      /Policy must be none, quarantine or reject\./,
    );

    assert.throws(
      () => buildDmarc({ pct: '101', policy: 'reject' }),
      /Percentage must be a whole number from 0 to 100\./,
    );
  });

  it('parses and builds DKIM', () => {
    const key2048 = spkiBase64(2048);

    assert.equal(parseDkim(`v=DKIM1; k=rsa; p=${key2048}`).keyBits, 2048);
    assert.deepEqual(parseDkim(`v=DKIM1; k=rsa; p=${key2048}`).findings, []);

    assert.equal(
      parseDkim(`v=DKIM1; k=rsa; t=y; p=${spkiBase64(1024)}`)
        .findings.map((f) => f.level)
        .join(','),
      'medium,info',
    );

    assert.deepEqual(parseDkim('v=DKIM1; k=rsa; p=').findings, [
      { level: 'high', message: 'Empty p tag; the key is revoked.' },
    ]);

    assert.equal(parseDkim('v=DKIM1; k=rsa; p=notbase64!').findings[0]?.level, 'high');
    assert.ok(parseDkim(`v=DKIM1; g=*; p=${key2048}`).findings.some((f) => f.level === 'low'));

    const pem = `-----BEGIN PUBLIC KEY-----\n${key2048.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
    const built = buildDkim({ domain: 'example.com', publicKey: pem, selector: 'sel1' });

    assert.equal(built.host, 'sel1._domainkey.example.com');
    assert.equal(built.record, `v=DKIM1; k=rsa; p=${key2048}`);
    assert.equal(built.keyBits, 2048);

    assert.match(
      built.zone,
      /^sel1\._domainkey\.example\.com\. IN TXT \( "v=DKIM1; k=rsa; p=[A-Za-z0-9+/]{1,243}" "[A-Za-z0-9+/=]{1,255}"/,
    );

    assert.equal(
      buildDkim({ domain: 'example.com', publicKey: key2048, selector: 's', testing: true }).record,
      `v=DKIM1; k=rsa; t=y; p=${key2048}`,
    );

    assert.throws(
      () => buildDkim({ domain: 'example.com', publicKey: 'nope', selector: 's' }),
      /Public key must be an SPKI PEM block or its base64 body\./,
    );

    assert.throws(
      () => buildDkim({ domain: 'example.com', publicKey: key2048, selector: 'bad selector' }),
      /Selector must be a DNS label\./,
    );
  });

  it('detects and unquotes records', () => {
    assert.equal(
      unquoteTxtRecord('_dmarc.example.com. 3600 IN TXT "v=DMARC1; " "p=reject"'),
      'v=DMARC1; p=reject',
    );

    assert.equal(unquoteTxtRecord('"v=spf1 -al" "l"'), 'v=spf1 -all');
    assert.equal(detectEmailAuthKind('V=SPF1 -all'), 'spf');
    assert.equal(detectEmailAuthKind('v=DKIM1; p=abc'), 'dkim');

    assert.throws(
      () => detectEmailAuthKind('hello'),
      /Record must start with v=spf1, v=DMARC1 or v=DKIM1\./,
    );

    assert.throws(
      () => parseEmailAuthRecord('x'.repeat(4_097)),
      /Record exceeds 4,096 characters\./,
    );

    assert.throws(() => parseEmailAuthRecord(''), /Record input is required\./);

    assert.equal(
      parseEmailAuthRecord('v=spf1 mx -all').summary,
      'SPF · 2 terms · 1 of 10 lookups · no findings',
    );
  });

  it('handles truncated keys, redirects, v-less DKIM and dotted selectors', () => {
    const key = spkiBase64(2048);
    const cut = parseDkim(`v=DKIM1; k=rsa; p=${key.slice(0, 252)}`);

    assert.equal(cut.keyBits, undefined);

    assert.deepEqual(cut.findings, [
      { level: 'high', message: 'Key is truncated or not valid DER.' },
    ]);

    assert.equal(
      buildSpf({ all: '-all', redirect: '_spf.example.com' }).record,
      'v=spf1 redirect=_spf.example.com',
    );

    assert.equal(detectEmailAuthKind(`k=rsa; p=${key}`), 'dkim');
    assert.throws(() => detectEmailAuthKind('k=rsa'), /Record must start with/);

    assert.ok(
      !parseSpf('v=spf1 -all exp=x.example.com').findings.some((f) =>
        /after "all"/.test(f.message),
      ),
    );

    assert.equal(
      buildDkim({ domain: 'example.com', publicKey: key, selector: 's1.s2' }).host,
      's1.s2._domainkey.example.com',
    );

    assert.equal(
      parseDkim(`v=DKIM1; n=a b; p=${key}`).tags.find((t) => t.name === 'n')?.value,
      'a b',
    );
  });

  it('rejects report addresses that smuggle extra tags', () => {
    assert.throws(
      () => buildDmarc({ policy: 'none', rua: 'a@b.example;p=none' }),
      /Report address "p=none" must be an email address\./,
    );

    assert.equal(
      buildDmarc({ policy: 'none', rua: 'a@b.example, c@d.example' }).record,
      'v=DMARC1; p=none; rua=mailto:a@b.example,mailto:c@d.example',
    );
  });
});

describe('SPF and DMARC syntax findings', () => {
  it('calls an unknown mechanism a permerror and an unknown modifier ignored', () => {
    const mechanism = parseSpf('v=spf1 foo:bar -all');
    const modifier = parseSpf('v=spf1 unknown=x -all');

    assert.equal(mechanism.findings[0]?.level, 'high');
    assert.match(mechanism.findings[0]?.message ?? '', /permerror/);
    assert.match(mechanism.terms[0]?.explanation ?? '', /permerror/);
    assert.match(modifier.findings[0]?.message ?? '', /ignore/);
    assert.match(modifier.terms[0]?.explanation ?? '', /ignore/);
  });

  it('flags a repeated redirect or exp', () => {
    assert.ok(
      parseSpf('v=spf1 redirect=a.test redirect=b.test').findings.some((finding) =>
        /more than once/.test(finding.message),
      ),
    );
  });

  it('flags DMARC tag values outside their grammar', () => {
    const record = (tags: string) =>
      parseDmarc(`v=DMARC1; p=reject; sp=reject; rua=mailto:a@b.test; ${tags}`).findings.map(
        (finding) => finding.message,
      );

    assert.match(record('aspf=x')[0] ?? '', /aspf "x"/);
    assert.match(record('adkim=x')[0] ?? '', /adkim "x"/);
    assert.match(record('fo=x')[0] ?? '', /fo "x"/);
    assert.match(record('ri=abc')[0] ?? '', /ri "abc"/);
    assert.deepEqual(record('aspf=s; adkim=r; fo=0:d; ri=3600'), []);
  });
});
