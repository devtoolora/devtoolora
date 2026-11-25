import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import { parseDataUri, utf8Bytes } from '@devtoolora/functions/binary';
import {
  checksumAlgorithms,
  checksumLabel,
  computeChecksum,
  type ChecksumAlgorithm,
} from '@devtoolora/functions/crypto';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, countLabel, cryptoTextResult } from '../shared';

const MAX_TEXT = 1_048_576;
const LABEL_WIDTH = 20;

export const checksumTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Crypto',
  description:
    'Compute CRC-32, CRC-32C, CRC-16, CRC-8, Adler-32 and Fletcher checksums of text or a local file, as hex and decimal.',
  fields: [
    {
      defaultValue: '',
      id: 'file',
      label: 'Local file (takes precedence over text)',
      maxBytes: 5 * 1024 * 1024,
      type: 'file',
    },
    {
      defaultValue: 'all',
      id: 'algorithm',
      label: 'Algorithm',
      options: [
        { label: 'All', value: 'all' },
        ...checksumAlgorithms.map((value) => ({ label: checksumLabel(value), value })),
      ],
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'checksum',
  inputKind: 'optionalText',
  keywords: ['checksum', 'crc', 'crc32', 'crc16', 'adler32', 'fletcher', 'integrity'],
  name: 'Checksum Calculator',
  outputKind: 'text',
  relatedToolIds: ['hash', 'hmac', 'base64-encode'],
  resultActions: ['copy', 'scratch', 'save'],
  run: async ({ fields, text }) => withToolError(() => runChecksum(text, fields)),
  samples: [
    { fields: { algorithm: 'all' }, label: 'All checksums of 123456789', text: '123456789' },
    { fields: { algorithm: 'crc32' }, label: 'CRC-32 of hello', text: 'hello' },
    {
      fields: { algorithm: 'crc16-modbus' },
      label: 'CRC-16/MODBUS of 123456789',
      text: '123456789',
    },
    { fields: { algorithm: 'adler32' }, label: 'Adler-32 of Wikipedia', text: 'Wikipedia' },
    { fields: { algorithm: 'fletcher32' }, label: 'Fletcher-32 of abcde', text: 'abcde' },
    { fields: { algorithm: 'crc32' }, label: 'CRC-32 of empty text', text: '' },
  ],
  supportsSelection: true,
};

export const crc32Tool: ToolDefinition = {
  ...checksumTool,
  aliasOf: 'checksum',
  description: 'Compute the CRC-32 checksum of text or a local file as hex and decimal.',
  fields: checksumTool.fields?.map((field) =>
    field.id === 'algorithm' ? { ...field, defaultValue: 'crc32' } : field,
  ),
  id: 'crc32',
  name: 'CRC32 Calculator',
};

function runChecksum(text: string, fields: Record<string, string>): ToolResult {
  const choice = fields.algorithm || 'all';
  const algorithm = checksumAlgorithms.find((value) => value === choice);

  if (choice !== 'all' && !algorithm) throw new ToolError('Choose an algorithm from the list.');

  if (!fields.file && text.length > MAX_TEXT)
    throw new ToolError('Text exceeds 1,048,576 characters.');

  const bytes = fields.file ? parseDataUri(fields.file).bytes : utf8Bytes(text);
  const size = countLabel(bytes.length, 'byte');

  if (algorithm) return singleResult(bytes, algorithm, size);

  const lines = checksumAlgorithms.map((value) => {
    const { decimal, hex } = computeChecksum(bytes, value);

    return `${checksumLabel(value).padEnd(LABEL_WIDTH)}${hex.padEnd(8)}  ${decimal}`;
  });

  return cryptoTextResult(
    'checksum',
    lines.join('\n'),
    `${countLabel(checksumAlgorithms.length, 'checksum')} · ${size}`,
  );
}

function singleResult(bytes: Uint8Array, algorithm: ChecksumAlgorithm, size: string): ToolResult {
  const { decimal, hex } = computeChecksum(bytes, algorithm);

  return cryptoTextResult(
    'checksum',
    `${hex}\n${decimal}`,
    `${checksumLabel(algorithm)} · ${size} · ${hex}`,
  );
}
