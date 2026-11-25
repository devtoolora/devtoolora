import { ToolDefinition } from '@devtoolora/core';
import { randomUuid as randomUuidValue } from '@devtoolora/functions/crypto';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, cryptoTextResult, clampCount, countLabel } from '../shared';

export const uuidTool: ToolDefinition = {
  badge: { accent: 'signal', icon: 'fingerprint' },
  id: 'uuid',
  keywords: ['guid', 'uuid v4', 'random id', 'unique identifier'],
  name: 'UUID Generator',
  category: 'Crypto',
  description: 'Generate 1–100 random UUID v4 identifiers, one value per line.',
  relatedToolIds: ['ulid', 'random-token'],
  inputKind: 'none',
  outputKind: 'text',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  resultActions: ['copy', 'scratch', 'save'],
  autoRun: false,
  fields: [{ id: 'count', label: 'Count', type: 'number', defaultValue: '1' }],
  samples: [
    { label: 'Single UUID v4', fields: { count: '1' } },
    { label: '5 UUIDs', fields: { count: '5' } },
    ...[10, 25, 50, 100].map((count) => ({
      fields: { count: String(count) },
      label: `${count} UUIDs`,
    })),
  ],
  run: ({ fields }) =>
    withToolError(() =>
      cryptoTextResult(
        'uuid',
        Array.from({ length: clampCount(fields.count) }, () => randomUuidValue()).join('\n'),
        `${countLabel(clampCount(fields.count), 'UUID v4 identifier')} · one per line · fresh random values, not time ordered.`,
      ),
    ),
};
