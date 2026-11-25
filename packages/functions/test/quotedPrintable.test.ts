import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  decodeMimeHeader,
  decodeQuotedPrintable,
  encodeQuotedPrintable,
} from '@devtoolora/functions/encoding';

describe('quoted-printable', () => {
  it('encodes non-ASCII, equals signs and trailing spaces', () => {
    assert.equal(encodeQuotedPrintable('Café = 5€'), 'Caf=C3=A9 =3D 5=E2=82=AC');
    assert.equal(encodeQuotedPrintable('a \nb'), 'a=20\nb');
    assert.equal(encodeQuotedPrintable('a\r\nb\rc '), 'a\nb\nc=20');
  });

  it('wraps long lines with soft breaks and round trips', () => {
    const input = 'x'.repeat(200);
    const encoded = encodeQuotedPrintable(input);
    const lines = encoded.split('\n');

    assert.ok(lines.length > 1);
    assert.ok(lines.every((line) => line.length <= 76));
    assert.ok(lines.slice(0, -1).every((line) => line.endsWith('=')));
    assert.equal(decodeQuotedPrintable(encoded, 'utf-8'), input);
  });

  it('round trips Unicode, tabs and equals signs', () => {
    const s = 'Příliš žluťoučký kůň\n=🐎\t';

    assert.equal(decodeQuotedPrintable(encodeQuotedPrintable(s), 'utf-8'), s);
  });

  it('decodes per charset', () => {
    assert.equal(decodeQuotedPrintable('Caf=C3=A9=\r\n au lait', 'utf-8'), 'Café au lait');
    assert.equal(decodeQuotedPrintable('Andr=E9', 'iso-8859-1'), 'André');
    assert.equal(decodeQuotedPrintable('a  \r\nb', 'utf-8'), 'a\nb');
  });

  it('reports bad input with a position', () => {
    assert.throws(() => decodeQuotedPrintable('Andr=E9', 'utf-8'), /not valid utf-8 text/);

    assert.throws(
      () => decodeQuotedPrintable('bad=ZZ', 'utf-8'),
      /Invalid quoted-printable sequence at position 4\./,
    );

    assert.throws(() => decodeQuotedPrintable('ok\n=', 'utf-8'), /position 4\./);
  });

  it('encodes a long blank run in linear time', () => {
    const input = `${' '.repeat(200_000)}x`;
    const start = Date.now();
    const encoded = encodeQuotedPrintable(input);

    assert.equal(decodeQuotedPrintable(encoded, 'utf-8'), input);
    assert.ok(Date.now() - start < 2000);
  });

  it('names the full label when the charset part is empty', () => {
    assert.throws(() => decodeMimeHeader('=?*en?Q?a?='), /Unknown charset \*en\./);
  });

  it('enforces the size limit', () => {
    const big = 'x'.repeat(1_000_001);

    assert.throws(() => encodeQuotedPrintable(big), /limited to 1,000,000/);
    assert.throws(() => decodeQuotedPrintable(big, 'utf-8'), /limited to 1,000,000/);
    assert.throws(() => decodeMimeHeader(big), /limited to 1,000,000/);
  });
});

describe('MIME header decoding', () => {
  it('decodes Q and B words and drops whitespace between them', () => {
    assert.equal(decodeMimeHeader('Subject: =?UTF-8?Q?Caf=C3=A9?= menu'), 'Subject: Café menu');

    assert.equal(
      decodeMimeHeader('=?UTF-8?B?w4lsw6h2ZQ==?= =?ISO-8859-1?Q?Andr=E9_Martin?='),
      'ÉlèveAndré Martin',
    );
  });

  it('joins a multibyte character split across words', () => {
    assert.equal(decodeMimeHeader('=?UTF-8?Q?=C3?= =?UTF-8?Q?=A9?='), 'é');
  });

  it('rejects unknown charsets and bad payloads', () => {
    assert.throws(() => decodeMimeHeader('=?KOI8-X?Q?a?='), /Unknown charset KOI8-X/);
    assert.throws(() => decodeMimeHeader('=?UTF-8?Q?=ZZ?='), /position 11\./);
    assert.throws(() => decodeMimeHeader('ok =?UTF-8?B?***?='), /position 4\./);
  });
});
