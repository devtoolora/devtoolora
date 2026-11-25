import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';
import {
  convertDomains,
  punycodeDecodeLabel,
  punycodeEncodeLabel,
} from '@devtoolora/functions/encoding';

const outputs = (text: string, direction: 'toAscii' | 'toUnicode') =>
  convertDomains(text, direction).map((row) => row.output);

describe('punycode', () => {
  it('encodes and decodes labels', () => {
    assert.equal(punycodeEncodeLabel('b\u00FCcher'), 'bcher-kva');
    assert.equal(punycodeDecodeLabel('bcher-kva'), 'b\u00FCcher');
  });

  it('converts domains to ASCII', () => {
    assert.deepEqual(outputs('m\u00FCnchen.de\nB\u00FCcher.DE', 'toAscii'), [
      'xn--mnchen-3ya.de',
      'xn--bcher-kva.de',
    ]);

    assert.equal(
      convertDomains('\u4F8B\u3048\u3002\u30C6\u30B9\u30C8', 'toAscii')[0]?.output,
      'xn--r8jz45g.xn--zckzah',
    );

    assert.equal(
      convertDomains('user@m\u00FCnchen.de', 'toAscii')[0]?.output,
      'user@xn--mnchen-3ya.de',
    );

    assert.deepEqual(outputs('A.Com\n\n', 'toAscii'), ['a.com']);
  });

  it('converts domains to Unicode', () => {
    assert.deepEqual(outputs('xn--mnchen-3ya.de\r\nexample.com', 'toUnicode'), [
      'm\u00FCnchen.de',
      'example.com',
    ]);
  });

  it('warns about mixed scripts', () => {
    const row = convertDomains('p\u0430ypal.com', 'toAscii')[0];

    assert.equal(row?.output, 'xn--pypal-4ve.com');
    assert.match(row?.warning ?? '', /mixes Latin and Cyrillic/);
  });

  it('rejects invalid input with a position', () => {
    assert.throws(
      () => convertDomains('xn--zz', 'toUnicode'),
      /Line 1: invalid Punycode label "xn--zz"\./,
    );

    assert.throws(() => convertDomains('xn--a-', 'toUnicode'), /invalid Punycode label/);

    assert.throws(
      () => convertDomains('a'.repeat(64) + '.com', 'toAscii'),
      /Line 1: label exceeds 63 characters\./,
    );

    assert.throws(() => convertDomains('a\n'.repeat(1001), 'toAscii'), /1,000 lines/);
  });

  it('enforces domain and label limits quickly', () => {
    const domain = Array.from({ length: 5 }, () => 'a'.repeat(60)).join('.');

    assert.throws(
      () => convertDomains(domain, 'toAscii'),
      /Line 1: domain exceeds 253 characters\./,
    );

    assert.throws(() => convertDomains('a'.repeat(100_000), 'toAscii'), /label exceeds 63/);

    assert.throws(
      () => convertDomains('xn--' + 'a'.repeat(100_000), 'toUnicode'),
      /label exceeds 63/,
    );

    assert.equal(convertDomains('  user@a.com ', 'toAscii')[0]?.output, 'user@a.com');
  });

  it('rejects a URL or other text that is not a domain name', () => {
    for (const direction of ['toAscii', 'toUnicode'] as const) {
      for (const input of [
        'https://m\u00FCnchen.de/path?q=1',
        'https://xn--mnchen-3ya.de/x',
        'foo bar.com',
        'example.com:8080',
        'https://user@example.com/',
        'example.com\uFF0Fpath',
      ])
        assert.throws(() => convertDomains(input, direction), /Line 1: .* is not a domain name/);
    }
  });

  it('maps labels the way URL parsers do', () => {
    assert.deepEqual(
      outputs('m\u00FCn\u00ADchen.de\n\u0392\u038C\u039B\u039F\u03A3.gr\nfa\u00DF.de', 'toAscii'),
      ['xn--mnchen-3ya.de', 'xn--nxasmq6b.gr', 'xn--fa-hia.de'],
    );

    assert.deepEqual(outputs('_dmarc.example.com\n*.example.com\n1.2.3.4', 'toAscii'), [
      '_dmarc.example.com',
      '*.example.com',
      '1.2.3.4',
    ]);

    assert.throws(() => convertDomains('m\u00FC\u200Dnchen.de', 'toAscii'), /not a valid domain/);
    assert.throws(() => convertDomains('xn--a.de', 'toUnicode'), /invalid Punycode label/);
  });

  it('rejects a label decoding to a control character even if the URL parser accepts it', () => {
    vi.stubGlobal(
      'URL',
      class {
        hostname = 'xn--a.invalid';
      },
    );

    try {
      assert.throws(() => convertDomains('xn--a.de', 'toUnicode'), /invalid Punycode label/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
