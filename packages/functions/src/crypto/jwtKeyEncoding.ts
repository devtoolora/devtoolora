import { base64Decode } from '../binary';
import { FunctionError } from '../errors';
import type { Asn1Node } from './pem';

export function decodeBase64Url(value: string, label: string): Uint8Array {
  if (!/^[A-Za-z0-9_+/-]*$/.test(value))
    throw new FunctionError('INVALID_JWT', `${label} is not valid Base64URL.`);
  if (value.length % 4 === 1)
    throw new FunctionError('INVALID_JWT', `${label} has an impossible Base64URL length.`);

  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');

  return base64Decode(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
}

export function der(tag: number, ...contents: Uint8Array[]): Uint8Array {
  const length = contents.reduce((total, content) => total + content.length, 0);
  const lengthBytes: number[] = [];

  for (let remaining = length; remaining > 0; remaining = Math.floor(remaining / 256))
    lengthBytes.unshift(remaining % 256);
  const header = length < 0x80 ? [tag, length] : [tag, 0x80 | lengthBytes.length, ...lengthBytes];
  const output = new Uint8Array(header.length + length);

  output.set(header);
  let offset = header.length;

  for (const content of contents) {
    output.set(content, offset);
    offset += content.length;
  }

  return output;
}

export function tlv(node: Asn1Node): Uint8Array {
  return node.bytes.slice(node.start, node.end);
}

export function hexBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/../g)?.map((pair) => Number.parseInt(pair, 16)) ?? []);
}

export function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function subtle(): SubtleCrypto {
  const value = globalThis.crypto?.subtle;

  if (!value) throw keyError('Web Crypto is unavailable in this runtime.');

  return value;
}

export function keyError(message: string): FunctionError {
  return new FunctionError('INVALID_JWT_KEY', message);
}
