import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  buildOtpauthUri,
  generateTotp,
  parseTotpInput,
  parseTotpTime,
  validateTotp,
} from '../src/crypto';

const defaults = { algorithm: 'SHA-1' as const, digits: 6 as const, period: 30 };
const secret = (text: string) => new TextEncoder().encode(text);
const sha1 = { ...defaults, digits: 8 as const, secret: secret('12345678901234567890') };
const sha256 = {
  ...defaults,
  algorithm: 'SHA-256' as const,
  digits: 8 as const,
  secret: secret('12345678901234567890123456789012'),
};
const sha512 = {
  ...defaults,
  algorithm: 'SHA-512' as const,
  digits: 8 as const,
  secret: secret('1234567890123456789012345678901234567890123456789012345678901234'),
};

describe('TOTP', () => {
  it('matches the RFC 6238 vectors', async () => {
    for (const [time, codes] of [
      [59, ['94287082', '46119246', '90693936']],
      [1111111109, ['07081804', '68084774', '25091201']],
      [1234567890, ['89005924', '91819424', '93441116']],
    ] as const) {
      assert.deepEqual(
        [
          (await generateTotp(sha1, time)).code,
          (await generateTotp(sha256, time)).code,
          (await generateTotp(sha512, time)).code,
        ],
        codes,
      );
    }

    const at59 = await generateTotp({ ...sha1, digits: 6 }, 59);

    assert.deepEqual([at59.code, at59.step, at59.secondsRemaining], ['287082', 1, 1]);
    assert.equal(at59.next, (await generateTotp({ ...sha1, digits: 6 }, 60)).code);
  });

  it('accepts an upper-case otpauth scheme and type', () => {
    assert.equal(parseTotpInput('OTPAUTH://TOTP/x?secret=JBSWY3DPEHPK3PXP', defaults).account, 'x');

    assert.throws(
      () => parseTotpInput('OTPAUTH://HOTP/x?secret=JBSWY3DPEHPK3PXP', defaults),
      /Only otpauth:\/\/totp\/ URIs are supported\./,
    );
  });

  it('normalizes Base32 secrets and parses otpauth URIs', () => {
    const clean = parseTotpInput('JBSWY3DPEHPK3PXP', defaults);

    assert.deepEqual(parseTotpInput('jbsw y3dp ehpk 3pxp', defaults).secret, clean.secret);
    assert.deepEqual(parseTotpInput('JBSWY3DPEHPK3PXP======', defaults).secret, clean.secret);
    const uri = parseTotpInput(
      'otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example&digits=8&period=60&algorithm=SHA256',
      defaults,
    );

    assert.deepEqual(
      [uri.issuer, uri.account, uri.digits, uri.period, uri.algorithm],
      ['Example', 'alice@example.com', 8, 60, 'SHA-256'],
    );

    assert.equal(
      buildOtpauthUri({ ...clean, account: 'alice@example.com', issuer: 'Example' }),
      'otpauth://totp/Example:alice%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example&algorithm=SHA1&digits=6&period=30',
    );

    assert.throws(
      () => parseTotpInput('otpauth://hotp/x?secret=JBSWY3DPEHPK3PXP', defaults),
      /Only otpauth:\/\/totp\/ URIs are supported\./,
    );

    assert.throws(
      () => parseTotpInput('otpauth://totp/x?secret=JBSWY3DPEHPK3PXP&algorithm=MD5', defaults),
      /Algorithm must be SHA1, SHA256 or SHA512\./,
    );

    assert.throws(
      () => parseTotpInput('otpauth://totp/x?secret=JBSWY3DPEHPK3PXP&digits=7', defaults),
      /Digits must be 6 or 8\./,
    );

    assert.throws(
      () => parseTotpInput('!!!', defaults),
      /Secret must be Base32 \(letters A-Z and digits 2-7\)\./,
    );

    assert.throws(() => parseTotpInput('', defaults), /Secret or otpauth URI is required\./);
  });

  it('validates within a window and parses times', async () => {
    assert.deepEqual(await validateTotp(sha1, '94287082', 59, 1), { offset: 0, valid: true });
    assert.deepEqual(await validateTotp(sha1, '94287082', 89, 1), { offset: -1, valid: true });
    assert.deepEqual(await validateTotp(sha1, '94287082', 89, 0), { valid: false });
    assert.deepEqual(await validateTotp(sha1, '9428708', 59, 1), { valid: false });
    assert.equal(parseTotpTime('', 1000), 1000);
    assert.equal(parseTotpTime('59', 1000), 59);
    assert.equal(parseTotpTime('2026-10-26T00:00:00Z', 1000), 1_792_972_800);

    assert.throws(
      () => parseTotpTime('yesterday', 1000),
      /Time must be Unix seconds or an ISO 8601 date-time\./,
    );
  });

  it('enforces its limits', () => {
    assert.throws(
      () => parseTotpInput('A'.repeat(1025), defaults),
      /Secret exceeds 1,024 characters\./,
    );

    assert.throws(
      () => parseTotpInput(`otpauth://totp/x?secret=${'A'.repeat(4100)}`, defaults),
      /Input exceeds 4,096 characters\./,
    );

    assert.throws(
      () => parseTotpInput('JBSWY3DPEHPK3PXP', { ...defaults, period: 14 }),
      /Period must be an integer between 15 and 120 seconds\./,
    );
  });

  it('handles step 0 and rejects unusable times', async () => {
    const code = (await generateTotp(sha1, 10)).code;

    assert.equal((await generateTotp(sha1, 10)).previous, undefined);
    assert.deepEqual(await validateTotp(sha1, code, 10, 1), { offset: 0, valid: true });
    for (const bad of ['-5', '59.5', '12 03', '9'.repeat(400)])
      assert.throws(() => parseTotpTime(bad, 1000), /Time must be Unix seconds or an ISO 8601/);
  });
});
