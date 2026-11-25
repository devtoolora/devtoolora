import { ToolDefinition, ToolError } from '@devtoolora/core';

export const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];

export function conversionMode(fields: Record<string, string>): 'encode' | 'decode' {
  const mode = fields.mode || 'encode';

  if (mode !== 'encode' && mode !== 'decode') throw new ToolError('Choose Encode or Decode.');

  return mode;
}
