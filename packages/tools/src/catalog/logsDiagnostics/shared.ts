import { ToolDefinition, ToolResult } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';

export const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];

const mimeTypes = new Map([
  ['html', 'text/html'],
  ['markdown', 'text/markdown'],
]);

export const flatten = (value: string): string => value.replace(/[\t\r\n]/g, ' ');

export function logOutput(
  text: string,
  fileName: string,
  language: string,
  summary: string,
): ToolResult {
  return {
    artifact: {
      base64: encodeBase64Text(text),
      fileName,
      mimeType: `${mimeTypes.get(language) ?? 'text/plain'};charset=utf-8`,
    },
    language,
    summary,
    text,
  };
}
