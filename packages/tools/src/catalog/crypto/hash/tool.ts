import { ToolDefinition, ToolError } from '@devtoolora/core';
import { hashBytes } from '@devtoolora/functions/crypto';
import { parseDataUri, utf8Bytes } from '@devtoolora/functions/binary';
import { withToolErrorAsync } from '../../../adapters/errors';
import { browserSafeCapabilities, cryptoTextResult, algorithmName, countLabel } from '../shared';

export const hashTool: ToolDefinition = {
  id: 'hash',
  keywords: ['sha256', 'sha512', 'sha1', 'md5', 'checksum', 'digest', 'file hash'],
  name: 'Hash Generator',
  category: 'Crypto',
  description: 'Hash exact UTF-8 text or local file bytes with SHA-256, SHA-512, SHA-1 or MD5.',
  relatedToolIds: ['hmac', 'base64-encode', 'bcrypt-hash'],
  autoRun: false,
  inputKind: 'optionalText',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  resultActions: ['copy', 'scratch', 'save'],
  fields: [
    {
      id: 'file',
      label: 'Local file (takes precedence over text)',
      maxBytes: 5 * 1024 * 1024,
      type: 'file',
    },
    {
      id: 'algorithm',
      label: 'Algorithm',
      type: 'select',
      defaultValue: 'sha256',
      options: [
        { label: 'SHA-256', value: 'sha256' },
        { label: 'SHA-512', value: 'sha512' },
        { label: 'SHA-1', value: 'sha1' },
        { label: 'MD5', value: 'md5' },
      ],
    },
  ],
  samples: [
    { label: 'SHA-256 ("hello world")', text: 'hello world', fields: { algorithm: 'sha256' } },
    { label: 'MD5 ("admin")', text: 'admin', fields: { algorithm: 'md5' } },
    { label: 'SHA-512 ("secret")', text: 'secret', fields: { algorithm: 'sha512' } },
    { label: 'Empty text', text: '', fields: { algorithm: 'sha256', file: '' } },
    { label: 'Trailing newline', text: 'hello\n', fields: { algorithm: 'sha256', file: '' } },
    {
      label: 'Unicode text',
      text: 'Příliš žluťoučký kůň 🐎',
      fields: { algorithm: 'sha256', file: '' },
    },
  ],
  run: ({ text, fields }) =>
    withToolErrorAsync(async () => {
      const bytes = fields.file ? parseDataUri(fields.file).bytes : utf8Bytes(text);

      if (bytes.length > 5 * 1024 * 1024)
        throw new ToolError('Hash input must be no larger than 5 MiB.');

      const algorithm = fields.algorithm ?? 'sha256';

      return cryptoTextResult(
        'hash',
        await hashBytes(bytes, algorithm),
        `${algorithmName(algorithm)} · ${countLabel(bytes.length, 'input byte')} · hexadecimal digest.${algorithm === 'md5' || algorithm === 'sha1' ? ' Legacy algorithm: not for new security-sensitive integrity checks.' : ''}`,
      );
    }),
};
