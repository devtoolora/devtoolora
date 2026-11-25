import type { ToolResult } from '@devtoolora/core';
import type { SavedToolFile } from '../../types';

export function base64Bytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export function downloadFile(file: SavedToolFile) {
  const bytes = Uint8Array.from(file.bytes);
  const url = URL.createObjectURL(new Blob([bytes.buffer], { type: file.mimeType }));
  const link = document.createElement('a');

  link.href = url;
  link.download = file.fileName;
  link.click();
  // Revoking in the same task cancels the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const textFileExtensions: Record<string, string> = { json: 'json', markdown: 'md' };

export function textFileName(toolName: string, result: ToolResult): string {
  const slug = toolName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `${slug}.${textFileExtensions[result.language ?? ''] ?? 'txt'}`;
}
