import { ToolError, type ToolResult } from '@devtoolora/core';
import { base64Encode, dataUriFromBytes } from '@devtoolora/functions/binary';
import {
  decodeBase64Bytes,
  encodeBase64Bytes,
  type Base64Alphabet,
} from '@devtoolora/functions/encoding';

export const base64FileMaxBytes: number = 10 * 1024 * 1024;

function parseFileValue(
  value: string,
  alphabet: Base64Alphabet,
): { bytes: Uint8Array; mimeType?: string } {
  const input = value.trim();
  const dataUri = /^data:([^,]*);base64,([\s\S]*)$/i.exec(input);

  if (!input || (input.startsWith('data:') && !dataUri))
    throw new ToolError('Enter Base64 or a Base64 data URI.');

  const mimeType = dataUri ? dataUri[1]!.split(';')[0] || 'application/octet-stream' : undefined;

  if (mimeType && !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(mimeType))
    throw new ToolError('Data URI media type is invalid.');

  const encoded = (dataUri ? dataUri[2]! : input).replace(/\s/g, '');

  if (encoded.length > Math.ceil(base64FileMaxBytes / 3) * 4)
    throw new ToolError('File mode supports up to 10 MiB of decoded data.');

  const bytes = decodeBase64Bytes(encoded, dataUri ? 'standard' : alphabet);

  if (bytes.length > base64FileMaxBytes)
    throw new ToolError('File mode supports up to 10 MiB of decoded data.');

  return { bytes, mimeType };
}

function detectedFileType(bytes: Uint8Array): { extension: string; mimeType: string } | undefined {
  const header = String.fromCharCode(...bytes.subarray(0, 12));

  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte))
    return { extension: 'png', mimeType: 'image/png' };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return { extension: 'jpg', mimeType: 'image/jpeg' };
  if (header.startsWith('GIF87a') || header.startsWith('GIF89a'))
    return { extension: 'gif', mimeType: 'image/gif' };
  if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP')
    return { extension: 'webp', mimeType: 'image/webp' };
  if (header.startsWith('%PDF-')) return { extension: 'pdf', mimeType: 'application/pdf' };

  return undefined;
}

export function runBase64File(
  text: string,
  fields: Record<string, string>,
  mode: 'encode' | 'decode',
  alphabet: Base64Alphabet,
): ToolResult {
  if (mode === 'encode' && !fields.file?.startsWith('data:'))
    throw new ToolError('Choose a local file to encode.');

  const { bytes, mimeType: declaredType } = parseFileValue(
    mode === 'encode' ? (fields.file ?? '') : text,
    alphabet,
  );
  const detected = detectedFileType(bytes);
  const mimeType = declaredType ?? detected?.mimeType ?? 'application/octet-stream';
  const fileName =
    fields.fileName
      ?.trim()
      .replace(/[\u0000-\u001f\u007f/\\]/g, '_')
      .slice(0, 160) || (mode === 'decode' ? `decoded.${detected?.extension ?? 'bin'}` : 'file');
  const previewDataUri = detected?.mimeType.startsWith('image/')
    ? dataUriFromBytes(bytes, detected.mimeType)
    : undefined;
  const summary = `${fileName} · ${bytes.length} bytes · ${mimeType}`;

  if (mode === 'decode') {
    return {
      artifact: { base64: base64Encode(bytes), fileName, mimeType },
      language: 'plaintext',
      previewDataUri,
      resultActions: ['save'],
      summary: `Decoded ${summary}`,
      text: `File ready to save: ${fileName}\n${bytes.length} bytes · ${mimeType}`,
    };
  }

  const fileOutput = fields.fileOutput || 'base64';

  if (fileOutput !== 'base64' && fileOutput !== 'data-uri')
    throw new ToolError('Choose Base64 or Data URI output.');

  return {
    language: 'plaintext',
    previewDataUri,
    resultActions: ['copy', 'save'],
    summary: `Encoded ${summary}`,
    text:
      fileOutput === 'data-uri'
        ? dataUriFromBytes(bytes, mimeType)
        : encodeBase64Bytes(bytes, alphabet),
  };
}
