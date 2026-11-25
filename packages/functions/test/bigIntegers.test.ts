import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync } from 'node:crypto';
import { FunctionError } from '../src/errors';
import { parseExactJson, stringifyExactJson } from '../src/format';
import { parseQueryString, stringifyQueryString } from '../src/web';
import { base64UrlText } from '../src/crypto/jwtParse';
import { decodeJwt, signJwt, verifyJwt } from '../src/crypto/jwt';

const big = '{"id":12345678901234567890}';
const secret = 'a-string-secret-at-least-256-bits-long';

const digits = '12345678901234567890';

function base64UrlJson(part: string | undefined): string {
  return Buffer.from(part ?? '', 'base64url').toString('utf8');
}

describe('JWT big integers', () => {
  it('signs the exact digits, which an independent check confirms', async () => {
    const { token } = await signJwt(big, secret, { header: `{"kid2":${digits}}` });
    const [header, payload, signature] = token.split('.');
    const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest();

    assert.equal(signature, expected.toString('base64url'));
    assert.equal(base64UrlJson(payload), big);
    assert.equal(base64UrlJson(header), `{"alg":"HS256","typ":"JWT","kid2":${digits}}`);
    assert.equal((await verifyJwt(token, secret)).signature, 'valid');
  });

  it('signs safe integers as before', async () => {
    const { token } = await signJwt('{"id":9007199254740991}', secret);

    assert.deepEqual(decodeJwt(token).payload, { id: 9007199254740991 });
  });

  it('still refuses a number out of range when signing', async () => {
    await assert.rejects(signJwt('{"a":1e400}', secret), /range of a double/);
    await assert.rejects(signJwt('{"a":1e-400}', secret), /range of a double/);
  });

  it('warns about a duplicate key in the signed JSON and in a token', async () => {
    const signed = await signJwt('{"a":1,"a":2}', secret, { header: '{"k":1,"k":2}' });

    assert.equal(base64UrlJson(signed.token.split('.')[1]), '{"a":2}');
    assert.match(signed.warnings[0] ?? '', /^Payload: Duplicate key "a" at line 1/);
    assert.match(signed.warnings[1] ?? '', /^Header: Duplicate key "k" at line 1/);

    const input = `${base64UrlText('{"alg":"HS256"}')}.${base64UrlText('{"a":1,"a":2}')}.`;

    assert.match(decodeJwt(input).warnings.join('\n'), /Payload: Duplicate key "a"/);
  });

  it('displays the exact value when decoding or verifying, without a warning', async () => {
    const input = `${base64UrlText('{"alg":"HS256"}')}.${base64UrlText(big)}`;
    const decoded = decodeJwt(`${input}.`);

    assert.equal(stringifyExactJson(decoded.payload), big);
    assert.doesNotMatch(decoded.warnings.join('\n'), /9,007,199,254,740,991|rounded/);

    const signature = (await signJwt('{}', secret)).token.split('.')[2];
    const verified = await verifyJwt(`${input}.${signature}`, secret);

    assert.equal(stringifyExactJson(verified.payload), big);
    assert.doesNotMatch(verified.warnings.join('\n'), /9,007,199,254,740,991|rounded/);
  });

  it('shows numbers out of range as written and reads a huge exp as out of range', () => {
    const payload = '{"a":1e400,"b":1e-400,"exp":99999999999999999999}';
    const decoded = decodeJwt(`${base64UrlText('{"alg":"HS256"}')}.${base64UrlText(payload)}.`);

    assert.equal(stringifyExactJson(decoded.payload), payload);
    assert.match(decoded.warnings.join('\n'), /exp is outside the representable date range/);
  });

  it('still reads a bare big number payload as not being claims', () => {
    const decoded = decodeJwt(`${base64UrlText('{"alg":"HS256"}')}.${base64UrlText(digits)}.`);

    assert.match(decoded.warnings.join('\n'), /claims should be a JSON object/);
    assert.equal(stringifyExactJson(decoded.payload), digits);
  });

  it('refuses a bare big number as a header or as claims to sign', async () => {
    assert.throws(
      () => decodeJwt(`${base64UrlText(digits)}.${base64UrlText('{}')}.`),
      /header must be a JSON object/,
    );

    await assert.rejects(signJwt(digits, secret), /claims must be a JSON object/);

    await assert.rejects(
      signJwt('{}', secret, { header: digits }),
      /Header JSON must be an object/,
    );
  });
});

describe('JWT verification strictness', () => {
  it('rejects a good signature with crit or a non-numeric exp', async () => {
    const crit = await signJwt('{"a":1}', secret, { header: '{"crit":["exp2"],"exp2":1}' });
    const verified = await verifyJwt(crit.token, secret);

    assert.equal(verified.valid, false);
    assert.equal(verified.signature, 'invalid');
    assert.match(verified.reason ?? '', /RFC 7515/);

    const exp = await verifyJwt((await signJwt('{"exp":"1000"}', secret)).token, secret);

    assert.equal(exp.signature, 'valid');
    assert.equal(exp.valid, false);
  });

  it('warns on an unsigned alg in any casing', () => {
    const decoded = decodeJwt(`${base64UrlText('{"alg":"NoNe"}')}.${base64UrlText('{"a":1}')}.`);

    assert.match(decoded.warnings.join('\n'), /unsigned/);
    assert.equal(decoded.signature, 'none (unsigned token)');
  });

  it('names the problem without engine text for a garbled header', () => {
    assert.throws(() => decodeJwt('abc.def'), /^FunctionError: Header segment is not JSON\. /);
  });
});

describe('query strings', () => {
  it('keeps the digits of an integer a double cannot hold when stringifying', () => {
    assert.equal(stringifyQueryString(parseExactJson(big).value), `id=${digits}`);

    assert.equal(
      stringifyQueryString(parseExactJson(`{"a":[${digits},1]}`).value),
      `a=${digits}&a=1`,
    );

    assert.throws(() => stringifyQueryString(parseExactJson(digits).value), /must be an object/);
  });

  it('finds the query after a relative URL or a scheme without slashes', () => {
    for (const input of [
      '/search?q=1',
      'example.com/search?q=1',
      'mailto:a@b.c?q=1',
      '?q=1',
      'q=1',
    ])
      assert.deepEqual(parseQueryString(input), { q: '1' }, input);

    assert.deepEqual(parseQueryString('q=a?b&empty='), { empty: '', q: 'a?b' });
    assert.deepEqual(parseQueryString('/p#x?y=1'), { '/p': '' });
  });

  it('reports an invalid full URL as a tool error', () => {
    assert.throws(() => parseQueryString('http://'), FunctionError);
  });
});

describe('JWT PEM keys', () => {
  it('reads a PEM whose line breaks are literal \\n', async () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

    const flat = pem.trim().replaceAll('\n', '\\n');

    assert.equal((await signJwt('{"a":1}', flat)).algorithm, 'ES256');
  });
});
