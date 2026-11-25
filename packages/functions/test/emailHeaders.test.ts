import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { parseRfc5322Date } from '../src/web/emailDate';
import { analyzeEmailHeaders } from '../src/web/emailHeaders';

const headers = [
  'Return-Path: <bounce@mail.example.net>',
  'Received: from mail.example.net (mail.example.net [203.0.113.5])',
  ' by mx.example.com with ESMTPS id abc123',
  ' for <bob@example.com>; Wed, 21 Oct 2026 07:28:10 +0000',
  'Received: from [10.0.0.2] (unknown [10.0.0.2])',
  '\tby mail.example.net with ESMTPSA id xyz; Wed, 21 Oct 2026 07:28:00 +0000',
  'Authentication-Results: mx.example.com; spf=pass smtp.mailfrom=mail.example.net; dkim=pass header.d=example.net; dmarc=pass header.from=example.net',
  'DKIM-Signature: v=1; a=rsa-sha256; d=example.net; s=sel1; h=from:to:subject; bh=abc; b=def',
  'From: Alice <alice@example.net>',
  'Reply-To: other@elsewhere.example',
  'To: Bob <bob@example.com>',
  'Subject: Hello',
  'Date: Wed, 21 Oct 2026 07:27:58 +0000',
  'Message-ID: <id1@example.net>',
  '',
  'Body text',
].join('\r\n');

describe('email header analyzer', () => {
  it('parses RFC 5322 dates', () => {
    assert.equal(
      parseRfc5322Date('Wed, 21 Oct 2026 07:28:00 +0200'),
      Date.UTC(2026, 9, 21, 5, 28, 0),
    );

    assert.equal(parseRfc5322Date('21 Oct 26 07:28 GMT'), Date.UTC(2026, 9, 21, 7, 28, 0));

    assert.equal(
      parseRfc5322Date('Wed, 21 Oct 2026 07:28:00 -0000 (UTC)'),
      Date.UTC(2026, 9, 21, 7, 28, 0),
    );

    assert.equal(
      parseRfc5322Date('Wed, 21 Oct 2026 07:28:00 EST'),
      Date.UTC(2026, 9, 21, 12, 28, 0),
    );

    assert.equal(parseRfc5322Date('next week'), undefined);
  });

  it('reads the hop chain, authentication and findings', () => {
    const report = analyzeEmailHeaders(String.fromCharCode(0xfeff) + headers);

    assert.equal(report.headerCount, 11);

    assert.deepEqual(
      report.received.map((h) => [h.from, h.by, h.with, h.id, h.delaySeconds]),
      [
        ['[10.0.0.2] (unknown [10.0.0.2])', 'mail.example.net', 'ESMTPSA', 'xyz', undefined],
        [
          'mail.example.net (mail.example.net [203.0.113.5])',
          'mx.example.com',
          'ESMTPS',
          'abc123',
          10,
        ],
      ],
    );

    assert.equal(report.received[1]?.for, '<bob@example.com>');
    assert.equal(report.received[1]?.timestamp, '2026-10-21T07:28:10.000Z');
    assert.equal(report.totalTransitSeconds, 10);

    assert.deepEqual(
      [report.authentication.spf, report.authentication.dkim, report.authentication.dmarc],
      ['pass', 'pass', 'pass'],
    );

    assert.deepEqual(report.dkimSignatures, [
      { algorithm: 'rsa-sha256', domain: 'example.net', selector: 'sel1' },
    ]);

    assert.equal(report.from, 'Alice <alice@example.net>');
    assert.equal(report.date, '2026-10-21T07:27:58.000Z');

    assert.deepEqual(report.findings, [
      {
        level: 'medium',
        message: 'Reply-To domain "elsewhere.example" differs from the From domain "example.net".',
      },
      {
        level: 'info',
        message:
          'Return-Path domain "mail.example.net" differs from the From domain "example.net".',
      },
    ]);
  });

  it('flags suspicious and incomplete headers', () => {
    const levels = (block: string) =>
      analyzeEmailHeaders(block).findings.map((f) => `${f.level}:${f.message}`);

    assert.ok(
      levels(
        'From: a@x.example\nFrom: b@y.example\nDate: Wed, 21 Oct 2026 07:28:00 +0000\nMessage-ID: <1@x>',
      ).some((f) => f.startsWith('high:Two From headers')),
    );

    assert.ok(
      levels('From: a@x.example\nDate: Wed, 21 Oct 2026 07:28:00 +0000\nMessage-ID: <1@x>').some(
        (f) =>
          f === 'medium:No Authentication-Results header; SPF, DKIM and DMARC results are unknown.',
      ),
    );

    assert.ok(
      levels(
        'From: a@x.example\nMessage-ID: <1@x>\nAuthentication-Results: m; dmarc=fail header.from=x.example',
      ).some((f) => f === 'high:DMARC result is fail.'),
    );

    assert.ok(
      levels('From: a@x.example\nMessage-ID: <1@x>\nAuthentication-Results: m; spf=pass').some(
        (f) => f === 'medium:No Date header.',
      ),
    );

    const slow = analyzeEmailHeaders(
      'Received: from a by b; Wed, 21 Oct 2026 09:28:00 +0000\nReceived: from c by a; Wed, 21 Oct 2026 07:28:00 +0000\nFrom: a@x.example\nDate: Wed, 21 Oct 2026 07:28:00 +0000\nMessage-ID: <1@x>\nAuthentication-Results: m; spf=pass',
    );

    assert.equal(slow.received[1]?.delaySeconds, 7200);
    assert.ok(slow.findings.some((f) => f.level === 'medium' && /7,200 s/.test(f.message)));

    assert.equal(
      analyzeEmailHeaders('Received: from a by b; whenever\nFrom: a@x.example').received[0]
        ?.timestamp,
      undefined,
    );

    assert.equal(
      analyzeEmailHeaders('From alice@example.net Wed Oct 21 07:28:00 2026\nFrom: a@x.example')
        .headerCount,
      1,
    );
  });

  it('enforces its limits', () => {
    assert.throws(() => analyzeEmailHeaders(''), /Email headers input is required\./);

    assert.throws(
      () => analyzeEmailHeaders('no colon here\nFrom: a@x'),
      /Line 1 is not a "Name: value" header\./,
    );

    assert.throws(
      () => analyzeEmailHeaders('x'.repeat(1_048_577)),
      /Email headers input exceeds 1,048,576 characters\./,
    );

    assert.throws(
      () =>
        analyzeEmailHeaders(
          Array.from(
            { length: 501 },
            () => 'Received: from a by b; Wed, 21 Oct 2026 07:28:00 +0000',
          ).join('\n'),
        ),
      /Email headers input exceeds 500 Received hops\./,
    );
  });

  it('handles long folds, comments, addresses and repeated results', () => {
    const long = analyzeEmailHeaders(`X: a\n${' b\n'.repeat(340_000)}`);

    assert.equal(long.headerCount, 1);

    const skew = analyzeEmailHeaders(
      'Received: from a by b; Wed, 21 Oct 2026 07:00:00 +0000\nReceived: from c by a; Wed, 21 Oct 2026 07:28:00 +0000\nFrom: a@x.example',
    );

    assert.ok(
      skew.findings.some(
        (f) =>
          f.level === 'info' &&
          f.message === 'Hop 2 has a timestamp earlier than the previous hop.',
      ),
    );

    assert.equal(
      analyzeEmailHeaders(
        'Received: from a by b; Wed, 21 Oct 2026 07:00:00 +0000 (PST; z)\nFrom: a@x',
      ).received[0]?.timestamp,
      '2026-10-21T07:00:00.000Z',
    );

    assert.ok(
      analyzeEmailHeaders(
        'From: alice@example.net (Alice)\nReply-To: bob@other.example',
      ).findings.some((f) =>
        f.message.includes('"other.example" differs from the From domain "example.net"'),
      ),
    );

    assert.equal(
      analyzeEmailHeaders('From: a@x\nAuthentication-Results: m; dkim=fail; dkim=pass')
        .authentication.dkim,
      'pass',
    );
  });
});
