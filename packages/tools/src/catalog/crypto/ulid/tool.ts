import { ToolDefinition } from '@devtoolora/core';
import { createUlid as createUlidValue } from '@devtoolora/functions/crypto';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, cryptoTextResult, clampCount, countLabel } from '../shared';

export const ulidTool: ToolDefinition = {
  id: 'ulid',
  keywords: ['sortable id', 'unique identifier', 'timestamp id', 'crockford base32'],
  name: 'ULID Generator',
  category: 'Crypto',
  description: 'Generate 1–100 uppercase ULIDs with a millisecond timestamp and random suffix.',
  relatedToolIds: ['uuid', 'random-token'],
  inputKind: 'none',
  outputKind: 'text',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  resultActions: ['copy', 'scratch', 'save'],
  autoRun: false,
  fields: [{ id: 'count', label: 'Count', type: 'number', defaultValue: '1' }],
  samples: [
    { label: 'Single ULID', fields: { count: '1' } },
    { label: '5 ULIDs', fields: { count: '5' } },
    ...[10, 25, 50, 100].map((count) => ({
      fields: { count: String(count) },
      label: `${count} ULIDs`,
    })),
  ],
  run: ({ fields }) =>
    withToolError(() =>
      cryptoTextResult(
        'ulid',
        Array.from({ length: clampCount(fields.count) }, () => createUlidValue()).join('\n'),
        `${countLabel(clampCount(fields.count), 'ULID')} · one per line · timestamp visible; same-millisecond order is not guaranteed.`,
      ),
    ),
};
