import { FunctionError } from '../errors';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64Encode(bytes: Uint8Array): string {
  let output = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!;
    const second = bytes[index + 1];
    const third = bytes[index + 2];

    output += BASE64_ALPHABET[first >> 2];
    output += BASE64_ALPHABET[((first & 3) << 4) | ((second ?? 0) >> 4)];

    output +=
      index + 1 < bytes.length
        ? BASE64_ALPHABET[(((second ?? 0) & 15) << 2) | ((third ?? 0) >> 6)]
        : '=';

    output += index + 2 < bytes.length ? BASE64_ALPHABET[(third ?? 0) & 63] : '=';
  }

  return output;
}

export function base64Decode(value: string): Uint8Array {
  let binary: string;

  try {
    binary = globalThis.atob(value.replace(/\s+/g, ''));
  } catch {
    throw new FunctionError('INVALID_BASE64', 'Value must be valid Base64.');
  }

  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
