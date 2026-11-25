import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import type { RuntimeName } from '../../src/runtime/files';
import { addRuntimeFiles, runtimeManifest } from '@devtoolora/functions/runtime';

const require = createRequire(import.meta.url);

const glueGlobals: Record<string, string> = {
  'libheif.js': 'libheif',
  'tesseract-core-simd-lstm.js': 'TesseractCore',
};

export async function loadRuntimeFilesForTest(
  runtime: RuntimeName,
  languages: string[] = ['eng'],
): Promise<void> {
  const entries = runtimeManifest[runtime];
  const files: Record<string, ArrayBuffer> = {};

  for (const entry of entries) {
    if (entry.kind === 'script') {
      (globalThis as Record<string, unknown>)[glueGlobals[entry.name]!] = require(entry.source);
    } else if (!entry.language || languages.includes(entry.language)) {
      const bytes = await readFile(require.resolve(entry.source));

      files[entry.name] = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
    }
  }

  await addRuntimeFiles(runtime, files, entries);
}
