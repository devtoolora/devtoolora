import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'vitest';
import { generateSshEd25519 } from '../src/crypto';

const readString = (buffer: Buffer, offset: number): [Buffer, number] => {
  const length = buffer.readUInt32BE(offset);

  return [buffer.subarray(offset + 4, offset + 4 + length), offset + 4 + length];
};

describe('SSH Ed25519 keys', () => {
  it('writes an authorized_keys line, an openssh-key-v1 private key and a SHA256 fingerprint', async () => {
    const { fingerprint, privateKey, publicKey } = await generateSshEd25519('alice@laptop');
    const [type, blob64, comment] = publicKey.split(' ');
    const blob = Buffer.from(blob64!, 'base64');
    const [blobType, afterType] = readString(blob, 0);
    const [publicBytes] = readString(blob, afterType);

    assert.equal(type, 'ssh-ed25519');
    assert.equal(comment, 'alice@laptop');
    assert.equal(blobType.toString(), 'ssh-ed25519');
    assert.equal(publicBytes.length, 32);

    assert.equal(
      fingerprint,
      `SHA256:${createHash('sha256').update(blob).digest('base64').replace(/=+$/, '')}`,
    );

    const lines = privateKey.split('\n');

    assert.equal(lines[0], '-----BEGIN OPENSSH PRIVATE KEY-----');
    assert.ok(lines.slice(1, -2).every((line) => line.length <= 70));
    assert.equal(lines.at(-2), '-----END OPENSSH PRIVATE KEY-----');
    const body = Buffer.from(lines.slice(1, -2).join(''), 'base64');

    assert.equal(body.subarray(0, 15).toString(), 'openssh-key-v1\0');
    const offset = 15;
    const [cipher, o1] = readString(body, offset);
    const [kdf, o2] = readString(body, o1);
    const [kdfOptions, o3] = readString(body, o2);

    assert.deepEqual(
      [cipher.toString(), kdf.toString(), kdfOptions.length, body.readUInt32BE(o3)],
      ['none', 'none', 0, 1],
    );

    const [embeddedPublic, o4] = readString(body, o3 + 4);

    assert.deepEqual(embeddedPublic, blob);
    const [privateSection] = readString(body, o4);

    assert.equal(privateSection.readUInt32BE(0), privateSection.readUInt32BE(4));
    const [privType, p1] = readString(privateSection, 8);
    const [privPublic, p2] = readString(privateSection, p1);
    const [privSecret, p3] = readString(privateSection, p2);
    const [privComment, p4] = readString(privateSection, p3);

    assert.equal(privType.toString(), 'ssh-ed25519');
    assert.deepEqual(privPublic, publicBytes);
    assert.equal(privSecret.length, 64);
    assert.deepEqual(privSecret.subarray(32), publicBytes);
    assert.equal(privComment.toString(), 'alice@laptop');
    assert.equal(privateSection.length % 8, 0);

    assert.deepEqual(
      [...privateSection.subarray(p4)],
      Array.from({ length: privateSection.length - p4 }, (_, i) => i + 1),
    );
  });

  it('pairs the seed with the public key', async () => {
    const { privateKey, publicKey } = await generateSshEd25519('');
    const body = Buffer.from(privateKey.split('\n').slice(1, -2).join(''), 'base64');
    const seed = body.subarray(
      body.indexOf(Buffer.from([0, 0, 0, 64])) + 4,
      body.indexOf(Buffer.from([0, 0, 0, 64])) + 36,
    );
    const pkcs8 = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]);
    const key = await crypto.subtle.importKey('pkcs8', pkcs8, 'Ed25519', false, ['sign']);
    const raw = Buffer.from(publicKey.split(' ')[1]!, 'base64').subarray(-32);
    const pub = await crypto.subtle.importKey('raw', raw, 'Ed25519', false, ['verify']);
    const signature = await crypto.subtle.sign('Ed25519', key, new Uint8Array([1, 2, 3]));

    assert.equal(
      await crypto.subtle.verify('Ed25519', pub, signature, new Uint8Array([1, 2, 3])),
      true,
    );

    assert.equal(publicKey.split(' ').length, 2);
  });

  it('enforces its limits', async () => {
    await assert.rejects(generateSshEd25519('c'.repeat(257)), /Comment exceeds 256 characters\./);
    await assert.rejects(generateSshEd25519('line\nbreak'), /Comment must be a single line\./);
  });
});
