import { ToolDefinition, ToolError, ToolResult } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';

export const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];

export function mathOutput(
  text: string,
  fileName: string,
  summary: string,
  isJson: boolean,
): ToolResult {
  return {
    artifact: {
      base64: encodeBase64Text(text),
      fileName: `${fileName}.${isJson ? 'json' : 'txt'}`,
      mimeType: isJson ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
    },
    language: isJson ? 'json' : 'plaintext',
    summary,
    text,
  };
}

export function parseFiniteNumber(value: string | undefined, label: string): number {
  if (value === undefined || !value.trim()) throw new ToolError(`${label} input is required.`);
  if (value.length > 128 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()))
    throw new ToolError(`${label} must be a decimal number (up to 128 characters).`);

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new ToolError(`${label} must be a number.`);
  }

  return parsed;
}
