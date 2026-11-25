import { ToolDefinition, ToolError } from '@devtoolora/core';
import type { XmlFormatOptions } from '@devtoolora/functions/format';

export const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];

export function indentationField(fields: Record<string, string>): 2 | 4 | 'tab' {
  const indentation = fields.indentation || '2';

  if (indentation === 'tab') return 'tab';
  if (indentation === '4') return 4;
  if (indentation === '2') return 2;

  throw new ToolError('Choose 2 spaces, 4 spaces or tabs.');
}

export function xmlFormatOptions(fields: Record<string, string>): XmlFormatOptions {
  return { indentation: indentationField(fields) };
}
