import { gunzipSync } from 'fflate';
import { FunctionError } from '../errors';
import {
  WASM_SIMD_MESSAGE,
  isWasmBlockedError,
  loadRuntimeScript,
  runtimeFile,
  supportsWasmSimd,
} from '../runtime';
import { decodeImage, drawImageToCanvas, encodeCanvas } from './canvas';
import { detectImageFormat, pngChunkTypes } from './formats';
import { parseTesseractTsv } from './ocrTsv';
import type { OcrReport } from './ocrTsv';

export type OcrOptions = {
  language: 'ces' | 'eng' | 'eng+ces';
  layout: 'auto' | 'block' | 'line' | 'sparse';
  upscale: boolean;
};

export type OcrResult = { report: OcrReport; summary: string; text: string };

type TessApi = {
  End(): void;
  GetTSVText(page: number): string;
  GetUTF8Text(): string;
  Init(path: string | null, languages: string, mode: number): number;
  MeanTextConf(): number;
  Recognize(monitor: null): number;
  SetImageFile(): number;
  SetVariable(name: string, value: string): boolean;
};

type TesseractCore = {
  /** WebIDL glue: frees the C++ object; the binding has no `delete()`. */
  destroy?(object: TessApi): void;
  FS: {
    mkdir(path: string): void;
    writeFile(path: string, data: Uint8Array): void;
  };
  TessBaseAPI: new () => TessApi;
};

type TesseractCoreFactory = (options: { wasmBinary: Uint8Array }) => Promise<TesseractCore>;

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PIXELS = 25_000_000;
const UPSCALE = 2;
const ENGINE_FILE = 'tesseract-core-simd-lstm.js';
const LOW_CONFIDENCE = 60;
const LANGUAGE_NAMES: Record<string, string> = { ces: 'Czech', eng: 'English' };
const LAYOUT_MODES: Record<OcrOptions['layout'], string> = {
  auto: '3',
  block: '6',
  line: '7',
  sparse: '11',
};

let core: Promise<TesseractCore> | undefined;
const writtenLanguages = new Set<string>();

function createCore(): Promise<TesseractCore> {
  if (!supportsWasmSimd()) return Promise.reject(new FunctionError('OCR', WASM_SIMD_MESSAGE));

  return loadRuntimeScript<TesseractCoreFactory>('TesseractCore', ENGINE_FILE)
    .then((factory) => factory({ wasmBinary: runtimeFile('ocr', 'tesseract-core-simd-lstm.wasm') }))
    .then((module) => {
      module.FS.mkdir('/tessdata');

      return module;
    })
    .catch((error: unknown) => {
      core = undefined;

      throw isWasmBlockedError(error) ? new FunctionError('OCR', WASM_SIMD_MESSAGE) : error;
    });
}

export async function prepareOcr(): Promise<void> {
  core ??= createCore();
  await core;
}

function pixelError(upscale: boolean): FunctionError {
  return new FunctionError(
    'OCR',
    `The image exceeds the ${MAX_PIXELS.toLocaleString('en-US')} pixels limit. ${upscale ? 'Turn off Upscale or use a smaller image.' : 'Use a smaller image, or check that the file is not damaged.'}`,
  );
}

function headerSize(bytes: Uint8Array): { height: number; width: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (detectImageFormat(bytes)?.format === 'png' && bytes.length >= 24)
    return { height: view.getUint32(20), width: view.getUint32(16) };

  for (let offset = 2; offset + 9 < bytes.length;) {
    const marker = bytes[offset + 1];

    if (bytes[offset] !== 0xff) return undefined;
    if (
      marker !== undefined &&
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    )
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };

    offset += 2 + view.getUint16(offset + 2);
  }

  return undefined;
}

function hasDensity(bytes: Uint8Array, format: string): boolean {
  if (format === 'png') return pngChunkTypes(bytes).includes('pHYs');

  return bytes[6] === 0x4a && bytes[13] !== undefined && bytes[13] > 0 && bytes[13] < 3;
}

async function prepareInput(
  image: { bytes: Uint8Array; mimeType: string },
  upscale: boolean,
): Promise<{ bytes: Uint8Array; needsDpi: boolean; scale: number }> {
  const format = detectImageFormat(image.bytes)?.format;
  const direct = format === 'png' || format === 'jpeg';
  const scale = upscale ? UPSCALE : 1;
  const size = direct ? headerSize(image.bytes) : undefined;

  if (size && size.width * size.height * scale * scale > MAX_PIXELS) throw pixelError(upscale);
  if (direct && !upscale)
    return { bytes: image.bytes, needsDpi: !hasDensity(image.bytes, format), scale };

  const bitmap = await decodeImage(image.bytes, image.mimeType);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;

  if (width * height > MAX_PIXELS) throw pixelError(upscale);

  const canvas = drawImageToCanvas(bitmap, width, height);

  return { bytes: await encodeCanvas(canvas, 'png', 1), needsDpi: true, scale };
}

function writeLanguages(module: TesseractCore, languages: string[]): void {
  for (const language of languages) {
    if (writtenLanguages.has(language)) continue;

    module.FS.writeFile(
      `/tessdata/${language}.traineddata`,
      gunzipSync(runtimeFile('ocr', `${language}.traineddata.gzip`)),
    );

    writtenLanguages.add(language);
  }
}

function summarize(report: OcrReport, seconds: number): string {
  const language = report.language
    .split('+')
    .map((code) => LANGUAGE_NAMES[code])
    .join(' + ');
  const count = report.words.length;
  const base = `${count} ${count === 1 ? 'word' : 'words'} · mean confidence ${report.meanConfidence} % · ${language} · ${seconds.toFixed(1)} s.`;

  return count === 0 || report.meanConfidence < LOW_CONFIDENCE
    ? `${base} Low confidence: try Upscale, a different layout, or a sharper image.`
    : base;
}

export async function recognizeText(
  image: { bytes: Uint8Array; mimeType: string; name: string },
  options: OcrOptions,
): Promise<OcrResult> {
  if (image.bytes.length > MAX_BYTES)
    throw new FunctionError('OCR', 'The image exceeds the 20 MiB limit.');
  if (detectImageFormat(image.bytes)?.format === 'heic')
    throw new FunctionError('OCR', 'Convert HEIC first with HEIC to JPG & PNG.');

  const started = performance.now();

  await prepareOcr();

  const module = await core!;
  const input = await prepareInput(image, options.upscale);
  const languages = options.language.split('+');
  const api = new module.TessBaseAPI();

  try {
    writeLanguages(module, languages);
    if (api.Init('/tessdata', options.language, 1) !== 0)
      throw new FunctionError('OCR', 'Could not load the OCR language data.');

    api.SetVariable('tessedit_pageseg_mode', LAYOUT_MODES[options.layout]);
    api.SetVariable('preserve_interword_spaces', '1');
    if (input.needsDpi) api.SetVariable('user_defined_dpi', '300');

    module.FS.writeFile('/input', input.bytes);
    api.SetImageFile();
    if (api.Recognize(null) !== 0) throw new FunctionError('OCR', 'Text recognition failed.');

    const report = {
      ...parseTesseractTsv(api.GetTSVText(0), input.scale),
      language: options.language,
      meanConfidence: api.MeanTextConf(),
    };
    const text = api
      .GetUTF8Text()
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trimEnd();

    return { report, summary: summarize(report, (performance.now() - started) / 1000), text };
  } finally {
    api.End();
    module.destroy?.(api);
  }
}
