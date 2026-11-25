import { FunctionError } from '../errors';

const pkcs8Prefix = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20,
]);
const basePoint = Uint8Array.from({ length: 32 }, (_, index) => (index === 0 ? 9 : 0));
const unsupportedMessage =
  'This runtime does not support X25519 in Web Crypto. Use a current browser or update VS Code.';

function clamp(key: Uint8Array): Uint8Array {
  const copy = Uint8Array.from(key);

  copy[0] = (copy[0] ?? 0) & 248;
  copy[31] = ((copy[31] ?? 0) & 127) | 64;

  return copy;
}

export function newPrivateKey(random: (length: number) => Uint8Array): Uint8Array {
  return clamp(random(32));
}

function keyFailure(error: unknown): FunctionError {
  const unsupported =
    error instanceof TypeError || (error instanceof Error && error.name === 'NotSupportedError');

  return unsupported
    ? new FunctionError('X25519_UNSUPPORTED', unsupportedMessage)
    : new FunctionError('X25519_FAILED', 'The X25519 key could not be derived.');
}

export async function x25519PublicKey(privateKey: Uint8Array): Promise<Uint8Array> {
  try {
    const pkcs8 = new Uint8Array(pkcs8Prefix.length + 32);

    pkcs8.set(pkcs8Prefix);
    pkcs8.set(clamp(privateKey), pkcs8Prefix.length);

    const algorithm = { name: 'X25519' };
    const secret = await crypto.subtle.importKey('pkcs8', pkcs8, algorithm, false, ['deriveBits']);
    const base = await crypto.subtle.importKey('raw', basePoint, algorithm, false, []);
    const bits = await crypto.subtle.deriveBits({ name: 'X25519', public: base }, secret, 256);

    return new Uint8Array(bits);
  } catch (error) {
    throw keyFailure(error);
  }
}
