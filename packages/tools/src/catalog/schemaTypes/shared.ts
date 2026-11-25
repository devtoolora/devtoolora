import { ToolDefinition, ToolError, type ToolField } from '@devtoolora/core';
import { type JsonSchemaDraft } from '@devtoolora/functions/schema';

export const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];

export const capabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];
export const draftOptions: Extract<ToolField, { type: 'select' }>['options'] = [
  { label: '2020-12', value: '2020-12' },
  { label: '2019-09', value: '2019-09' },
  { label: 'Draft 7', value: 'draft-07' },
];

export function draftValue(value: string): JsonSchemaDraft {
  if (value === '2020-12' || value === '2019-09' || value === 'draft-07') return value;

  throw new ToolError('Choose draft-07, 2019-09 or 2020-12.');
}
