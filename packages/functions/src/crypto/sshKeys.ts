import { base64Encode, utf8Bytes } from '../binary';
import { FunctionError } from '../errors';
import { subtle } from './jwtKeyEncoding';
import { pemEncode } from './pemWrite';
import { randomBytes } from './primitives';

const KEY_TYPE = 'ssh-ed25519';
const MAX_COMMENT_LENGTH = 256;
const MAGIC = utf8Bytes('openssh-key-v1\0');

type SshKeyPair = { fingerprint: string; privateKey: string; publicKey: string };

export async function generateSshEd25519(comment: string): Promise<SshKeyPair> {
  if (comment.length > MAX_COMMENT_LENGTH)
    throw new FunctionError('INVALID_INPUT', `Comment exceeds ${MAX_COMMENT_LENGTH} characters.`);
  if (/[\r\n]/.test(comment))
    throw new FunctionError('INVALID_INPUT', 'Comment must be a single line.');

  let pair: CryptoKeyPair;

  try {
    pair = (await subtle().generateKey('Ed25519', true, ['sign', 'verify'])) as CryptoKeyPair;
  } catch (error) {
    if (error instanceof FunctionError) throw error;

    throw new FunctionError('KEY_GENERATION_ERROR', 'This browser cannot generate Ed25519 keys.');
  }

  const [pkcs8, raw] = await Promise.all([
    subtle().exportKey('pkcs8', pair.privateKey),
    subtle().exportKey('raw', pair.publicKey),
  ]);
  const publicBytes = new Uint8Array(raw);
  const seed = new Uint8Array(pkcs8).slice(-32);
  const blob = concat(sshString(utf8Bytes(KEY_TYPE)), sshString(publicBytes));
  const check = randomBytes(4);
  const section = concat(
    check,
    check,
    sshString(utf8Bytes(KEY_TYPE)),
    sshString(publicBytes),
    sshString(concat(seed, publicBytes)),
    sshString(utf8Bytes(comment)),
  );
  const padding = Array.from({ length: (8 - (section.length % 8)) % 8 }, (_, index) => index + 1);
  const body = concat(
    MAGIC,
    sshString(utf8Bytes('none')),
    sshString(utf8Bytes('none')),
    sshString(new Uint8Array()),
    new Uint8Array([0, 0, 0, 1]),
    sshString(blob),
    sshString(concat(section, new Uint8Array(padding))),
  );
  const digest = new Uint8Array(await subtle().digest('SHA-256', blob));

  return {
    fingerprint: `SHA256:${base64Encode(digest).replace(/=+$/, '')}`,
    privateKey: pemEncode('OPENSSH PRIVATE KEY', body, 70),
    publicKey: [KEY_TYPE, base64Encode(blob), comment].filter(Boolean).join(' '),
  };
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function sshString(bytes: Uint8Array): Uint8Array {
  const length = new Uint8Array(4);

  new DataView(length.buffer).setUint32(0, bytes.length);

  return concat(length, bytes);
}
