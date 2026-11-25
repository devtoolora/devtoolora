import { ToolDefinition, ToolResult } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';

export const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];

export function configResult(
  text: string,
  fileName: string,
  summary: string,
  language = 'plaintext',
): ToolResult {
  return {
    artifact: { base64: encodeBase64Text(text), fileName, mimeType: 'text/plain;charset=utf-8' },
    language,
    summary,
    text,
  };
}

export const commonSamples: NonNullable<ToolDefinition['samples']> = [
  { label: 'Public app configuration', text: '# App\n export PORT = 3000\nDEBUG=false\n' },
  { label: 'Literal reference', text: 'BASE_URL=https://example.com\nAPI_URL=${BASE_URL}/v1\n' },
  { label: 'Quoted hash and spaces', text: 'LABEL="  demo # label  "\nEMPTY=\n' },
  { label: 'Compact comment', text: 'PORT=3000# development\n' },
  { label: 'Windows line endings', text: 'PORT=3000\r\nDEBUG=false\r\n' },
  { label: 'Duplicate variable diagnostic', text: 'PORT=3000\nPORT=4000\n' },
];
