import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { isWasmBlockedError } from '@devtoolora/functions/runtime';
import { parseTesseractTsv, prepareOcr, recognizeText } from '@devtoolora/functions/image';
import { loadRuntimeFilesForTest } from './fixtures/runtimeFiles';
import { BLANK_PNG, CZECH_PNG, DEV_TOOLORA_PNG } from './fixtures/ocrFixtures';

const base64 = (value: string): Uint8Array => new Uint8Array(Buffer.from(value, 'base64'));
const png = (value: string) => ({ bytes: base64(value), mimeType: 'image/png', name: 'in.png' });
const english = { language: 'eng', layout: 'auto', upscale: false } as const;

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);

  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);

  return bytes;
}

describe('ocr', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeAll(async () => {
    await loadRuntimeFilesForTest('ocr', ['eng', 'ces']);

    await prepareOcr();
  }, 60_000);

  it('reads English text', async () => {
    const result = await recognizeText(png(DEV_TOOLORA_PNG), english);

    expect(result.text).toContain('Dev Toolora 2026');
    expect(result.report.words.length).toBeGreaterThanOrEqual(3);
    expect(result.report.meanConfidence).toBeGreaterThan(60);
    expect(result.summary).toMatch(/^\d+ words · mean confidence \d+ % · English · \d+\.\d s\.$/);
  });

  it('reads Czech with ces', async () => {
    const result = await recognizeText(png(CZECH_PNG), { ...english, language: 'ces' });

    expect(result.text).toContain('Příliš žluťoučký kůň');
    expect(result.summary).toContain('· Czech ·');
  });

  it('blank image gives empty text and the low-confidence hint', async () => {
    const result = await recognizeText(png(BLANK_PNG), english);

    expect(result.text).toBe('');
    expect(result.report.words).toEqual([]);
    expect(result.summary).toContain('0 words');

    expect(result.summary).toContain(
      'Low confidence: try Upscale, a different layout, or a sharper image.',
    );
  });

  it('upscale over the pixel limit fails before drawing', async () => {
    const canvas = vi.fn();

    vi.stubGlobal('OffscreenCanvas', canvas);

    await expect(
      recognizeText(
        { bytes: pngHeader(2600, 2600), mimeType: 'image/png', name: 'big.png' },
        { ...english, upscale: true },
      ),
    ).rejects.toThrow(/25,000,000 pixels/);

    expect(canvas).not.toHaveBeenCalled();
  });

  it('does not advise turning off Upscale when it is already off', async () => {
    await expect(
      recognizeText(
        { bytes: pngHeader(9000, 9000), mimeType: 'image/png', name: 'big.png' },
        english,
      ),
    ).rejects.toThrow(/25,000,000 pixels limit\. Use a smaller image, or check/);
  });

  it('rejects HEIC input', async () => {
    const bytes = new Uint8Array([0, 0, 0, 24, ...Buffer.from('ftypheic'), 0, 0, 0, 0]);

    await expect(
      recognizeText({ bytes, mimeType: 'image/heic', name: 'a.heic' }, english),
    ).rejects.toThrow('Convert HEIC first with HEIC to JPG & PNG.');
  });

  it('parses TSV lines and words and scales boxes back', () => {
    const tsv = [
      '5\t1\t1\t1\t1\t1\t20\t40\t10\t8\t90\ta',
      '5\t1\t1\t1\t1\t2\t40\t40\t10\t8\t70\tb',
    ].join('\n');
    const { lines, words } = parseTesseractTsv(tsv, 2);

    expect(lines[0]?.text).toBe('a b');
    expect(words[1]?.bbox.x).toBe(20);
    expect(lines[0]?.confidence).toBe(80);
  });

  it('maps a CSP compile error to the SIMD message', () => {
    const blocked = new Error("WebAssembly.instantiate(): Refused to compile … 'wasm-unsafe-eval'");

    expect(isWasmBlockedError(blocked)).toBe(true);
    expect(isWasmBlockedError(new Error('x'))).toBe(false);
  });
});
