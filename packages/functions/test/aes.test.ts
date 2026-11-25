import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { decryptAesGcm, encryptAesGcm } from '../src/crypto';

const bytes = (text: string) => new TextEncoder().encode(text);
const text = (value: Uint8Array) => new TextDecoder().decode(value);

describe('AES-GCM envelope', () => {
  it('round-trips text and bytes with the iterations stored in the envelope', async () => {
    const envelope = await encryptAesGcm(bytes('hello, world'), 'correct horse', {
      iterations: 1000,
    });
    const raw = Buffer.from(envelope, 'base64');

    assert.equal(raw[0], 1);
    assert.equal(raw.readUInt32BE(1), 1000);
    assert.equal(raw.length, 1 + 4 + 16 + 12 + 12 + 16);

    assert.deepEqual(await decryptAesGcm(envelope, 'correct horse'), {
      bytes: bytes('hello, world'),
      iterations: 1000,
    });

    assert.notEqual(
      await encryptAesGcm(bytes('hello, world'), 'correct horse', { iterations: 1000 }),
      envelope,
    );

    assert.equal(
      text(
        (await decryptAesGcm(await encryptAesGcm(bytes(''), 'p', { iterations: 1000 }), 'p')).bytes,
      ),
      '',
    );
  });

  it('accepts URL-safe Base64 and whitespace in the envelope', async () => {
    const envelope = await encryptAesGcm(bytes('x'.repeat(100)), 'pw', { iterations: 1000 });
    const loose = `${envelope.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 20)}\n ${envelope.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(20)}`;

    assert.equal(text((await decryptAesGcm(loose, 'pw')).bytes), 'x'.repeat(100));
  });

  it('rejects wrong passphrases and tampered envelopes with one message', async () => {
    const envelope = await encryptAesGcm(bytes('secret'), 'right', { iterations: 1000 });
    const flipped = `${envelope.slice(0, -5)}${envelope[envelope.length - 5] === 'A' ? 'B' : 'A'}${envelope.slice(-4)}`;

    await assert.rejects(
      decryptAesGcm(envelope, 'wrong'),
      /: Decryption failed: wrong passphrase or corrupted data\.$/,
    );

    await assert.rejects(
      decryptAesGcm(flipped, 'right'),
      /Decryption failed: wrong passphrase or corrupted data\./,
    );

    await assert.rejects(
      decryptAesGcm(envelope.slice(0, 20), 'right'),
      /Envelope is too short to hold a version, salt, IV and ciphertext\./,
    );

    await assert.rejects(
      decryptAesGcm(`Ag${envelope.slice(2)}`, 'right'),
      /Unsupported envelope version; this tool reads version 1\./,
    );

    await assert.rejects(decryptAesGcm('not base64!', 'right'), /Envelope is not valid Base64\./);
  });

  it('enforces its limits', async () => {
    await assert.rejects(
      encryptAesGcm(bytes('x'), '', { iterations: 1000 }),
      /Passphrase is required\./,
    );

    await assert.rejects(
      encryptAesGcm(bytes('x'), 'p'.repeat(1025), { iterations: 1000 }),
      /Passphrase exceeds 1,024 characters\./,
    );

    await assert.rejects(
      encryptAesGcm(bytes('x'), 'p', { iterations: 999 }),
      /Iterations must be an integer between 1,000 and 10,000,000\./,
    );

    await assert.rejects(
      decryptAesGcm('A'.repeat(16_777_217), 'p'),
      /Envelope exceeds 16,777,216 characters\./,
    );

    await assert.rejects(decryptAesGcm('', 'p'), /Envelope is required\./);
  });
});
