import { utf8Bytes } from '../binary';
import { FunctionError } from '../errors';

export function textToBinary(text: string): string {
  return [...utf8Bytes(text)].map((byte) => byte.toString(2).padStart(8, '0')).join(' ');
}

export function binaryToText(text: string): string {
  const input = required(text, 'Binary');
  const bytes = input.split(/\s+/).map((part) => {
    if (!/^[01]{8}$/.test(part)) {
      throw new FunctionError('INVALID_BINARY', 'Binary input must be 8-bit groups.');
    }

    return Number.parseInt(part, 2);
  });

  return decodeTextBytes(new Uint8Array(bytes));
}

export function textToHex(text: string): string {
  return [...utf8Bytes(text)].map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

export function hexToText(text: string): string {
  const normalized = required(text, 'Hex').replace(/\s+/g, '');

  if (!/^(?:[0-9a-f]{2})*$/i.test(normalized)) {
    throw new FunctionError('INVALID_HEX_BYTES', 'Hex input must contain complete byte pairs.');
  }

  const bytes = normalized.match(/../g)?.map((part) => Number.parseInt(part, 16)) ?? [];

  return decodeTextBytes(new Uint8Array(bytes));
}

function decodeTextBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new FunctionError(
      'INVALID_UTF8',
      'Decoded bytes are not valid UTF-8 text. This tool decodes text, not binary files.',
    );
  }
}

function required(value: string, label: string): string {
  const input = value.trim();

  if (!input) throw new FunctionError('REQUIRED_INPUT', `${label} input is required.`);

  return input;
}
