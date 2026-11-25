import { ToolDefinition } from '@devtoolora/core';
import { generateTokens } from '@devtoolora/functions/crypto';
import { withToolError } from '../../../adapters/errors';
import {
  browserSafeCapabilities,
  cryptoTextResult,
  tokenOptions,
  countLabel,
  clampCount,
} from '../shared';

export const randomTokenTool: ToolDefinition = {
  id: 'random-token',
  keywords: ['api key', 'secret', 'random string', 'nonce', 'random bytes'],
  name: 'Token Generator',
  category: 'Crypto',
  description: 'Generate unbiased random characters or encoded random bytes with local export.',
  relatedToolIds: ['password-generator', 'hmac'],
  inputKind: 'none',
  outputKind: 'text',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  resultActions: ['copy', 'scratch', 'save'],
  autoRun: false,
  fields: [
    {
      id: 'mode',
      label: 'Mode',
      type: 'select',
      defaultValue: 'custom',
      options: [
        { label: 'Custom alphabet', value: 'custom' },
        { label: 'Encoded bytes', value: 'bytes' },
      ],
    },
    {
      id: 'length',
      label: 'Length',
      type: 'number',
      defaultValue: '32',
      visibleWhen: { field: 'mode', is: ['custom'] },
    },
    { id: 'count', label: 'Count', type: 'number', defaultValue: '1' },
    {
      id: 'lowercase',
      label: 'Lowercase',
      type: 'checkbox',
      defaultValue: 'true',
      visibleWhen: { field: 'mode', is: ['custom'] },
    },
    {
      id: 'uppercase',
      label: 'Uppercase',
      type: 'checkbox',
      defaultValue: 'true',
      visibleWhen: { field: 'mode', is: ['custom'] },
    },
    {
      id: 'numbers',
      label: 'Numbers',
      type: 'checkbox',
      defaultValue: 'true',
      visibleWhen: { field: 'mode', is: ['custom'] },
    },
    {
      id: 'symbols',
      label: 'Symbols',
      type: 'checkbox',
      defaultValue: 'false',
      visibleWhen: { field: 'mode', is: ['custom'] },
    },
    {
      id: 'bytes',
      label: 'Bytes',
      type: 'number',
      defaultValue: '32',
      visibleWhen: { field: 'mode', isNot: ['custom'] },
    },
    {
      id: 'encoding',
      label: 'Encoding',
      type: 'select',
      defaultValue: 'hex',
      options: [
        { label: 'Hex', value: 'hex' },
        { label: 'Base64', value: 'base64' },
        { label: 'Base64url', value: 'base64url' },
      ],
      visibleWhen: { field: 'mode', isNot: ['custom'] },
    },
  ],
  samples: [
    {
      label: '32-character alphanumeric token',
      fields: {
        mode: 'custom',
        length: '32',
        count: '1',
        lowercase: 'true',
        uppercase: 'true',
        numbers: 'true',
        symbols: 'false',
      },
    },
    {
      label: '16-byte hex secret',
      fields: { mode: 'bytes', bytes: '16', count: '1', encoding: 'hex' },
    },
    {
      label: '32-byte Base64url key',
      fields: { mode: 'bytes', bytes: '32', count: '1', encoding: 'base64url' },
    },
    {
      label: 'Digits only',
      fields: {
        mode: 'custom',
        length: '12',
        count: '3',
        lowercase: 'false',
        uppercase: 'false',
        numbers: 'true',
        symbols: 'false',
      },
    },
    {
      label: '16-byte Base64',
      fields: { mode: 'bytes', bytes: '16', count: '2', encoding: 'base64' },
    },
    {
      label: 'Symbols allowed',
      fields: {
        mode: 'custom',
        length: '24',
        count: '2',
        lowercase: 'true',
        uppercase: 'true',
        numbers: 'true',
        symbols: 'true',
      },
    },
  ],
  run: ({ fields }) =>
    withToolError(() =>
      cryptoTextResult(
        'random-token',
        generateTokens(tokenOptions(fields)).join('\n'),
        `${countLabel(clampCount(fields.count), 'fresh token')} · ${fields.mode === 'bytes' ? 'encoded random bytes' : 'unbiased allowed-character sampling; selected groups are not guaranteed in each token'}. Output and exports contain secrets.`,
      ),
    ),
};
