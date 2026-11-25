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

export const passwordGeneratorTool: ToolDefinition = {
  id: 'password-generator',
  keywords: ['random password', 'secure password', 'passphrase', 'credentials'],
  name: 'Password Generator',
  category: 'Crypto',
  description: 'Generate unbiased random passwords from enabled character groups.',
  relatedToolIds: ['random-token', 'password-strength'],
  inputKind: 'none',
  outputKind: 'text',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  resultActions: ['copy', 'scratch', 'save'],
  autoRun: false,
  fields: [
    { id: 'length', label: 'Length', type: 'number', defaultValue: '20' },
    { id: 'count', label: 'Count', type: 'number', defaultValue: '1' },
    { id: 'lowercase', label: 'Lowercase', type: 'checkbox', defaultValue: 'true' },
    { id: 'uppercase', label: 'Uppercase', type: 'checkbox', defaultValue: 'true' },
    { id: 'numbers', label: 'Numbers', type: 'checkbox', defaultValue: 'true' },
    { id: 'symbols', label: 'Symbols', type: 'checkbox', defaultValue: 'true' },
  ],
  samples: [
    {
      label: 'Strong 20-char password with symbols',
      fields: {
        length: '20',
        count: '1',
        lowercase: 'true',
        uppercase: 'true',
        numbers: 'true',
        symbols: 'true',
      },
    },
    {
      label: 'PIN code (6 digits)',
      fields: {
        length: '6',
        count: '1',
        lowercase: 'false',
        uppercase: 'false',
        numbers: 'true',
        symbols: 'false',
      },
    },
    {
      label: 'Letters only',
      fields: {
        length: '24',
        count: '1',
        lowercase: 'true',
        uppercase: 'true',
        numbers: 'false',
        symbols: 'false',
      },
    },
    {
      label: 'Maximum length',
      fields: {
        length: '512',
        count: '1',
        lowercase: 'true',
        uppercase: 'true',
        numbers: 'true',
        symbols: 'true',
      },
    },
    {
      label: 'Ten development passwords',
      fields: {
        length: '24',
        count: '10',
        lowercase: 'true',
        uppercase: 'true',
        numbers: 'true',
        symbols: 'true',
      },
    },
    {
      label: 'Lowercase only',
      fields: {
        length: '32',
        count: '1',
        lowercase: 'true',
        uppercase: 'false',
        numbers: 'false',
        symbols: 'false',
      },
    },
  ],
  run: ({ fields }) =>
    withToolError(() =>
      cryptoTextResult(
        'password-generator',
        generateTokens(
          tokenOptions({ ...fields, mode: 'custom', symbols: fields.symbols ?? 'true' }),
        ).join('\n'),
        `${countLabel(clampCount(fields.count), 'fresh password')} · allowed groups are not inclusion requirements. Output and downloaded files contain secrets.`,
      ),
    ),
};
