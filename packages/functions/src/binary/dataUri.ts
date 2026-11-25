import { FunctionError } from '../errors';
import { base64Decode, base64Encode } from './base64';

export interface ParsedDataUri {
  bytes: Uint8Array;
  mimeType: string;
}

export function dataUriFromBytes(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${base64Encode(bytes)}`;
}

export function parseDataUri(value: string): ParsedDataUri {
  const match = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.*)$/s.exec(value);

  if (!match) {
    throw new FunctionError('INVALID_DATA_URI', 'Value must be a Base64 data URI.');
  }

  return {
    bytes: base64Decode(match[2]!),
    mimeType: match[1] || 'application/octet-stream',
  };
}
