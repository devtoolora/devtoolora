import { type ToolDefinition, type ToolResult } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';

export const capabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];
export const actions: ToolDefinition['resultActions'] = [
  'copy',
  'replace',
  'insert',
  'scratch',
  'save',
];

export function result(
  text: string,
  fileName: string,
  language: 'json' | 'plaintext',
  summary: string,
): ToolResult {
  return {
    artifact: {
      base64: encodeBase64Text(text),
      fileName,
      mimeType: language === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
    },
    language,
    summary,
    text,
  };
}
