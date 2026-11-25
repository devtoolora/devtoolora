import { ToolDefinition, ToolError } from '@devtoolora/core';
import { hmacText as hmacTextValue } from '@devtoolora/functions/crypto';
import { utf8Bytes } from '@devtoolora/functions/binary';
import { withToolErrorAsync } from '../../../adapters/errors';
import { browserSafeCapabilities, cryptoTextResult, algorithmName, countLabel } from '../shared';

export const hmacTool: ToolDefinition = {
  id: 'hmac',
  keywords: ['hmac-sha256', 'signature', 'keyed hash', 'message authentication', 'webhook'],
  name: 'HMAC Generator',
  category: 'Crypto',
  description: 'Generate a keyed message digest from exact UTF-8 text and a local secret.',
  relatedToolIds: ['hash', 'random-token'],
  autoRun: false,
  inputKind: 'optionalText',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  resultActions: ['copy', 'scratch', 'save'],
  fields: [
    {
      id: 'secret',
      label: 'Secret',
      required: true,
      type: 'password',
      placeholder: 'local secret',
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
      ],
    },
  ],
  samples: [
    {
      label: 'HMAC SHA-256 ("hello")',
      text: 'hello',
      fields: { secret: 'super-secret-key', algorithm: 'sha256' },
    },
    {
      label: 'HMAC SHA-512 ("payload")',
      text: 'payload',
      fields: { secret: 'my-signing-secret', algorithm: 'sha512' },
    },
    { label: 'Spaced secret', text: 'hello', fields: { secret: ' secret ', algorithm: 'sha256' } },
    { label: 'Empty message', text: '', fields: { secret: 'demo-key', algorithm: 'sha256' } },
    {
      label: 'Unicode message',
      text: 'Příliš žluťoučký kůň 🐎',
      fields: { secret: 'ukázkový-klíč', algorithm: 'sha256' },
    },
    { label: 'Legacy SHA-1', text: 'hello', fields: { secret: 'demo-key', algorithm: 'sha1' } },
  ],
  run: ({ text, fields }) =>
    withToolErrorAsync(async () => {
      const secret = fields.secret;

      if (!secret?.length) throw new ToolError('HMAC secret must contain at least one character.');

      const algorithm = fields.algorithm ?? 'sha256';

      return cryptoTextResult(
        'hmac',
        await hmacTextValue(text, secret, algorithm),
        `HMAC ${algorithmName(algorithm)} · ${countLabel(utf8Bytes(text).length, 'message byte')} · literal UTF-8 key preserved; key not exported.`,
      );
    }),
};
