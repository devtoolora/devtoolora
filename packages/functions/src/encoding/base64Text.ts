import { base64Decode, base64Encode, utf8Bytes } from '../binary';
import { FunctionError } from '../errors';

export type Base64Alphabet = 'standard' | 'url-safe';

export function encodeBase64Text(text: string, alphabet: Base64Alphabet = 'standard'): string {
  return encodeBase64Bytes(utf8Bytes(text), alphabet);
}

export function encodeBase64Bytes(
  bytes: Uint8Array,
  alphabet: Base64Alphabet = 'standard',
): string {
  const encoded = base64Encode(bytes);

  return alphabet === 'url-safe'
    ? encoded
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/(?<!=)=+$/, '')
    : encoded;
}

export function decodeBase64Text(text: string, alphabet: Base64Alphabet = 'standard'): string {
  const bytes = decodeBase64Bytes(text, alphabet);

  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new FunctionError(
      'INVALID_UTF8',
      'Decoded bytes are not valid UTF-8 text. Choose File to decode binary data.',
    );
  }
}

export function decodeBase64Bytes(text: string, alphabet: Base64Alphabet = 'standard'): Uint8Array {
  const compact = text.replace(/\s/g, '');
  const characters = alphabet === 'url-safe' ? /^[A-Za-z0-9_-]*={0,2}$/ : /^[A-Za-z0-9+/]*={0,2}$/;

  if (!characters.test(compact)) {
    throw invalidBase64();
  }

  const normalized = compact.replace(/-/g, '+').replace(/_/g, '/');
  const paddingStart = normalized.indexOf('=');
  const characterCount = paddingStart === -1 ? normalized.length : paddingStart;
  const paddingCount = normalized.length - characterCount;
  const remainder = characterCount % 4;

  if (
    remainder === 1 ||
    (paddingCount > 0 && (normalized.length % 4 !== 0 || paddingCount !== 4 - remainder))
  ) {
    throw invalidBase64();
  }

  let bytes: Uint8Array;

  try {
    bytes = base64Decode(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));

    if (base64Encode(bytes).replace(/(?<!=)=+$/, '') !== normalized.replace(/(?<!=)=+$/, '')) {
      throw invalidBase64();
    }
  } catch {
    throw invalidBase64();
  }

  return bytes;
}

function invalidBase64(): FunctionError {
  return new FunctionError('INVALID_BASE64', 'Base64 input is invalid.');
}
