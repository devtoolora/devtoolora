import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  decodeBaseN,
  decodeBaseNText,
  encodeBaseN,
  encodeBaseNText,
} from '@devtoolora/functions/encoding';

describe('Base-N encoding', () => {
  it('encodes reference vectors', () => {
    assert.equal(encodeBaseNText('foobar', 'base32'), 'MZXW6YTBOI======');
    assert.equal(encodeBaseNText('foobar', 'base32hex'), 'CPNMUOJ1E8======');
    assert.equal(encodeBaseNText('Hello World!', 'base58'), '2NEpo7TZRRrLZSi2U');
    assert.equal(encodeBaseNText('AB', 'base45'), 'BB8');
    assert.equal(encodeBaseNText('Hello!!', 'base45'), '%69 VD92EX0');
    assert.equal(encodeBaseNText('base-45', 'base45'), 'UJCLQE7W581');
    assert.equal(encodeBaseNText('Hello, World', 'ascii85'), '87cURD_*#4DfTZ)');
  });

  it('handles zero bytes and the Ascii85 z shortcut', () => {
    assert.equal(encodeBaseN(new Uint8Array([0, 0, 1]), 'base58'), '112');
    assert.deepEqual(decodeBaseN('112', 'base58'), new Uint8Array([0, 0, 1]));
    assert.equal(encodeBaseN(new Uint8Array(4), 'ascii85'), 'z');
    assert.deepEqual(decodeBaseN('z!!', 'ascii85'), new Uint8Array(5));
  });

  it('decodes lenient input', () => {
    assert.equal(decodeBaseNText('mzxw6ytboi', 'base32'), 'foobar');
    assert.equal(decodeBaseNText('MZXW 6YTB\nOI======', 'base32'), 'foobar');
    assert.equal(decodeBaseNText('<~87cURD_*#4DfTZ)~>', 'ascii85'), 'Hello, World');
    assert.equal(decodeBaseNText('87cURD_*# 4DfTZ)\n', 'ascii85'), 'Hello, World');
  });

  it('round-trips Unicode text in every alphabet', () => {
    for (const alphabet of ['ascii85', 'base32', 'base32hex', 'base45', 'base58'] as const)
      assert.equal(decodeBaseNText(encodeBaseNText('Příliš 🐎', alphabet), alphabet), 'Příliš 🐎');
  });

  it('names the 1-based position of an invalid character', () => {
    assert.throws(
      () => decodeBaseNText('MZXW6YTBO!', 'base32'),
      /Invalid Base32 character "!" at position 10\./,
    );

    assert.throws(
      () => decodeBaseN('2NEpo0', 'base58'),
      /Invalid Base58 character "0" at position 6/,
    );

    assert.throws(() => decodeBaseN('bb8', 'base45'), /Invalid Base45 character "b" at position 1/);

    assert.throws(
      () => decodeBaseN('87cU~D', 'ascii85'),
      /Invalid Ascii85 character "~" at position 5/,
    );

    assert.throws(
      () => decodeBaseN('87zcU', 'ascii85'),
      /Invalid Ascii85 character "z" at position 3/,
    );
  });

  it('accepts a trailing newline in Base45 and reports bad characters before the length', () => {
    assert.equal(decodeBaseNText('BB8\n', 'base45'), 'AB');
    assert.equal(decodeBaseNText('BB8\r\n', 'base45'), 'AB');

    assert.throws(
      () => decodeBaseN('!!!!', 'base45'),
      /Invalid Base45 character "!" at position 1/,
    );

    const started = performance.now();

    assert.throws(() => decodeBaseN(`${'\n'.repeat(500_000)}x`, 'base45'), /at position 1/);
    assert.ok(performance.now() - started < 500);
  });

  it('rejects malformed lengths and overflow', () => {
    assert.throws(() => decodeBaseN('M', 'base32'), /Base32 text has an invalid length/);
    assert.throws(() => decodeBaseN('BB8B', 'base45'), /Base45 text has an invalid length/);
    assert.throws(() => decodeBaseN('GGW', 'base45'), /Base45 group "GGW" is out of range/);
    assert.throws(() => decodeBaseN('uuuuu', 'ascii85'), /Ascii85 group is out of range/);
    assert.throws(() => decodeBaseN('!', 'ascii85'), /Ascii85 text has an invalid length/);
  });

  it('never returns mojibake for non-UTF-8 bytes', () => {
    assert.deepEqual(decodeBaseN('LUu', 'base58'), new Uint8Array([0xff, 0xfe]));

    assert.throws(
      () => decodeBaseNText('LUu', 'base58'),
      /Decoded bytes are not valid UTF-8 text\./,
    );
  });

  it('enforces limits', () => {
    assert.throws(() => encodeBaseN(new Uint8Array(10_001), 'base58'), /10,000 bytes/);
    assert.throws(() => decodeBaseN('1'.repeat(14_001), 'base58'), /Base58 input is limited/);
    assert.throws(() => encodeBaseN(new Uint8Array(1_000_001), 'base32'), /1,000,000/);
    assert.throws(() => decodeBaseN('A'.repeat(1_000_001), 'base32'), /1,000,000/);
  });
});
