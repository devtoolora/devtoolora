import { describe, expect, it, vi } from 'vitest';
import { runtimeManifest } from '../src/runtime';
import { handleRuntimeRequest, isRuntimeRequest } from '../src/runtime/messages';
import { loadRuntimeFilesForTest } from './fixtures/runtimeFiles';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const heicEntries = runtimeManifest.heic.filter((entry) => entry.kind === 'data');

async function heicRequest(corrupt = false) {
  const files: Record<string, ArrayBuffer> = {};

  for (const entry of heicEntries) {
    const bytes = await readFile(require.resolve(entry.source));
    const copy = new Uint8Array(bytes);

    if (corrupt) copy[0]! ^= 1;

    files[entry.name] = copy.buffer;
  }

  return { files, id: '1', records: runtimeManifest.heic, runtime: 'heic' as const };
}

describe('runtime messages', () => {
  it('recognizes runtime requests', () => {
    expect(isRuntimeRequest({ type: 'loadRuntime' })).toBe(true);
    expect(isRuntimeRequest({ type: 'runTool' })).toBe(false);
  });

  it('loadRuntime ocr replies runtimeReady after the engine is ready', async () => {
    await loadRuntimeFilesForTest('ocr');
    const reply = await handleRuntimeRequest({
      files: {},
      id: 'a',
      records: runtimeManifest.ocr,
      runtime: 'ocr',
      type: 'loadRuntime',
    });

    expect(reply).toEqual({ id: 'a', ok: true, type: 'runtimeReady' });
  }, 60_000);

  it('addRuntimeFiles stores ces without re-preparing', async () => {
    const prepare = vi.fn(async () => undefined);
    const reply = await handleRuntimeRequest(
      { ...(await heicRequest()), type: 'addRuntimeFiles' },
      prepare,
    );

    expect(reply.type).toBe('runtimeFilesAdded');
    expect(prepare).not.toHaveBeenCalled();
  });

  it('a corrupted file rejects with the file name', async () => {
    const request = { ...(await heicRequest(true)), type: 'loadRuntime' as const };

    await expect(handleRuntimeRequest(request, async () => undefined)).rejects.toThrow(
      heicEntries[0]!.name,
    );
  });
});
