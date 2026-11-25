import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  addRuntimeFiles,
  loadRuntimeScript,
  runtimeFile,
  runtimeManifest,
  setRuntimeScriptBase,
} from '@devtoolora/functions/runtime';
import { loadRuntimeFilesForTest } from './fixtures/runtimeFiles';

const require = createRequire(import.meta.url);
const sourceBytes = (source: string): Promise<Buffer> => readFile(require.resolve(source));
const toBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) as ArrayBuffer;

describe('runtime files', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).libheif;
  });

  it('manifest lists the shipped runtime files', () => {
    const { heic, ocr } = runtimeManifest;
    const byName = (entries: typeof ocr) => Object.fromEntries(entries.map((e) => [e.name, e]));

    expect(ocr.map((entry) => entry.name)).toEqual([
      'tesseract-core-simd-lstm.js',
      'tesseract-core-simd-lstm.wasm',
      'eng.traineddata.gzip',
      'ces.traineddata.gzip',
    ]);

    expect(ocr.map((entry) => entry.language)).toEqual([undefined, undefined, 'eng', 'ces']);
    expect(ocr.map((entry) => entry.kind)).toEqual(['script', 'data', 'data', 'data']);

    expect(heic.map((entry) => [entry.name, entry.kind])).toEqual([
      ['libheif.js', 'script'],
      ['libheif.wasm', 'data'],
    ]);

    expect(byName(ocr)['tesseract-core-simd-lstm.wasm']!.bytes).toBe(2_857_601);
    expect(byName(ocr)['tesseract-core-simd-lstm.js']!.bytes).toBe(89_271);
    expect(byName(heic)['libheif.wasm']!.bytes).toBe(1_463_506);
    expect(byName(heic)['libheif.js']!.bytes).toBe(91_255);
    expect(byName(ocr)['eng.traineddata.gzip']!.bytes).toBe(2_952_873);
    expect(byName(ocr)['ces.traineddata.gzip']!.bytes).toBe(2_225_029);
  });

  it('every manifest hash matches the file in node_modules', async () => {
    for (const entry of [...runtimeManifest.heic, ...runtimeManifest.ocr]) {
      const bytes = await sourceBytes(entry.source);

      expect(createHash('sha256').update(bytes).digest('hex'), entry.name).toBe(entry.sha256);
    }
  });

  it('rejects a corrupted byte by name', async () => {
    const bytes = new Uint8Array(await sourceBytes('libheif-js/libheif-wasm/libheif.wasm'));

    bytes[100]! ^= 0xff;

    await expect(
      addRuntimeFiles('heic', { 'libheif.wasm': toBuffer(bytes) }, runtimeManifest.heic),
    ).rejects.toThrow(/libheif\.wasm.*SHA-256/);
  });

  it('accepts a replaced library when the records match it', async () => {
    const bytes = new Uint8Array(await sourceBytes('libheif-js/libheif-wasm/libheif.wasm'));

    bytes[100]! ^= 0xff;

    const records = runtimeManifest.heic.map((entry) =>
      entry.name === 'libheif.wasm'
        ? {
            ...entry,
            bytes: bytes.length,
            sha256: createHash('sha256').update(bytes).digest('hex'),
          }
        : entry,
    );

    await addRuntimeFiles('heic', { 'libheif.wasm': toBuffer(bytes) }, records);
    expect(runtimeFile('heic', 'libheif.wasm')).toEqual(bytes);
  });

  it('rejects unknown and missing files', async () => {
    await expect(
      addRuntimeFiles('heic', { 'x.wasm': new ArrayBuffer(1) }, runtimeManifest.heic),
    ).rejects.toThrow(/Unknown runtime file x\.wasm/);

    expect(() => runtimeFile('ocr', 'eng.traineddata.gzip')).toThrow(
      /eng\.traineddata\.gzip is not loaded/,
    );
  });

  it('loads real files through the test helper', async () => {
    await loadRuntimeFilesForTest('ocr');
    expect(runtimeFile('ocr', 'eng.traineddata.gzip').length).toBe(2_952_873);
    expect(typeof (globalThis as Record<string, unknown>).TesseractCore).toBe('function');
  });

  it('loadRuntimeScript prefers an existing global', async () => {
    const factory = () => undefined;

    (globalThis as Record<string, unknown>).libheif = factory;
    await expect(loadRuntimeScript('libheif', 'libheif.js')).resolves.toBe(factory);
  });

  it('loadRuntimeScript without a global or base fails by name', async () => {
    await expect(loadRuntimeScript('libheif', 'libheif.js')).rejects.toThrow(
      /libheif\.js is not loaded in this worker/,
    );
  });

  it('loadRuntimeScript rejects a script that never calls define and does not cache it', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'runtime-script-'));

    await writeFile(join(folder, 'no-define.js'), 'globalThis.noDefineRan = true;\n');
    await writeFile(join(folder, 'amd.js'), "define([], () => 'factory');\n");
    setRuntimeScriptBase(`${pathToFileURL(folder).href}/`);

    await expect(loadRuntimeScript('libheif', 'no-define.js')).rejects.toThrow(
      'Could not load no-define.js.',
    );

    expect((globalThis as Record<string, unknown>).noDefineRan).toBe(true);
    await expect(loadRuntimeScript('libheif', 'amd.js')).resolves.toBe('factory');
  });
});
