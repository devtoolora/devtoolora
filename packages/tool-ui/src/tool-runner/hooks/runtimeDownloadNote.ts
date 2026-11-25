import type { ToolRuntime } from '@devtoolora/core';
import { runtimeManifest } from '@devtoolora/functions/runtime';

const megabytes = (bytes: number): string => (bytes / 1_000_000).toFixed(1);

function dataBytes(runtime: ToolRuntime, language?: string): number {
  return runtimeManifest[runtime]
    .filter((entry) => entry.kind === 'data' && entry.language === language)
    .reduce((total, entry) => total + entry.bytes, 0);
}

export function runtimeDownloadNote(runtime: ToolRuntime): string {
  const engine = dataBytes(runtime);

  if (runtime === 'heic')
    return `Downloads about ${megabytes(engine)} MB on first use. Cached for offline use.`;

  const english = dataBytes(runtime, 'eng');

  return (
    `Downloads about ${megabytes(engine + english)} MB on first use ` +
    `(engine ${megabytes(engine)} MB + English ${megabytes(english)} MB; ` +
    `Czech ${megabytes(dataBytes(runtime, 'ces'))} MB more when selected). Cached for offline use.`
  );
}
