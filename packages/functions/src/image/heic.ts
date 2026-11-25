import { FunctionError } from '../errors';
import { WASM_HEIC_MESSAGE, isWasmBlockedError, loadRuntimeScript, runtimeFile } from '../runtime';

export type DecodedHeicImage = { data: Uint8ClampedArray; height: number; width: number };

type HeifImage = {
  display(
    target: { data: Uint8ClampedArray; height: number; width: number },
    done: (result: unknown) => void,
  ): void;
  free(): void;
  get_height(): number;
  get_width(): number;
  is_primary(): boolean;
};

type HeifDecoder = { decode(bytes: Uint8Array): HeifImage[]; decoder: number | null };

type Libheif = { heif_context_free(context: number): void; HeifDecoder: new () => HeifDecoder };

type LibheifOptions = { wasmBinary: Uint8Array; onRuntimeInitialized(): void };

export type LibheifFactory = (options: LibheifOptions) => Libheif;

const MAX_IMAGES = 50;
const MAX_PIXELS = 64_000_000;
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis'];
const GENERIC_BRANDS = ['mif1', 'msf1'];
const AVIF_MESSAGE =
  'This is an AVIF file; browsers open it directly. Use Image Tools to convert it.';
const NOT_HEIC_MESSAGE = 'This is not a HEIC/HEIF file.';

let libheif: Promise<Libheif> | undefined;

function startLibheif(load: () => Promise<LibheifFactory>): Promise<Libheif> {
  return load().then(
    (factory) =>
      new Promise<Libheif>((resolve, reject) => {
        try {
          // Read the module after the callback so a synchronous call still sees it.
          const module: Libheif = factory({
            onRuntimeInitialized: () => void Promise.resolve().then(() => resolve(module)),
            wasmBinary: runtimeFile('heic', 'libheif.wasm'),
          });
        } catch (error) {
          reject(error);
        }
      }),
  );
}

const defaultLoad = (): Promise<LibheifFactory> =>
  loadRuntimeScript<LibheifFactory>('libheif', 'libheif.js');

function mapBlocked(error: unknown): never {
  throw isWasmBlockedError(error) ? new FunctionError('HEIC', WASM_HEIC_MESSAGE) : error;
}

function getLibheif(load?: () => Promise<LibheifFactory>): Promise<Libheif> {
  if (load) return startLibheif(load).catch(mapBlocked);

  libheif ??= startLibheif(defaultLoad).catch((error: unknown) => {
    libheif = undefined;

    return mapBlocked(error);
  });

  return libheif;
}

export async function prepareHeic(load?: () => Promise<LibheifFactory>): Promise<void> {
  await getLibheif(load);
}

export function detectHeic(bytes: Uint8Array): void {
  const text = (start: number, end: number): string =>
    String.fromCharCode(...bytes.subarray(start, end));
  const boxSize =
    bytes.length >= 12 ? new DataView(bytes.buffer, bytes.byteOffset).getUint32(0) : 0;

  if (text(4, 8) !== 'ftyp') throw new FunctionError('HEIC', NOT_HEIC_MESSAGE);

  const major = text(8, 12);
  const compatible: string[] = [];

  for (let offset = 16; offset + 4 <= Math.min(boxSize, bytes.length); offset += 4)
    compatible.push(text(offset, offset + 4));

  if (major === 'avif' || major === 'avis') throw new FunctionError('HEIC', AVIF_MESSAGE);
  if (HEIC_BRANDS.includes(major)) return;
  if (!GENERIC_BRANDS.includes(major)) throw new FunctionError('HEIC', NOT_HEIC_MESSAGE);
  if (compatible.some((brand) => HEIC_BRANDS.includes(brand))) return;
  if (compatible.includes('avif')) throw new FunctionError('HEIC', AVIF_MESSAGE);
  // Generic HEIF (mif1/msf1) without an HEVC brand is left to libheif.
}

function display(image: HeifImage): Promise<DecodedHeicImage> {
  const width = image.get_width();
  const height = image.get_height();

  if (width * height > MAX_PIXELS)
    throw new FunctionError(
      'HEIC',
      `An image exceeds the ${MAX_PIXELS.toLocaleString('en-US')} pixels limit.`,
    );

  const target = { data: new Uint8ClampedArray(width * height * 4), height, width };

  return new Promise((resolve, reject) => {
    image.display(target, (result) =>
      result
        ? resolve(target)
        : reject(new FunctionError('HEIC', 'This HEIC file could not be decoded: display failed.')),
    );
  });
}

export async function decodeHeic(
  bytes: Uint8Array,
  images: 'all' | 'primary',
  load?: () => Promise<LibheifFactory>,
): Promise<DecodedHeicImage[]> {
  detectHeic(bytes);

  const module = await getLibheif(load);
  const decoder = new module.HeifDecoder();
  let decoded: HeifImage[] = [];

  try {
    decoded = decoder.decode(bytes);

    if (decoded.length === 0) throw new Error('no image found');
    if (decoded.length > MAX_IMAGES)
      throw new FunctionError('HEIC', `The file has more than ${MAX_IMAGES} images.`);

    const primaryFirst = (primary: boolean) => decoded.filter((i) => i.is_primary() === primary);
    const ordered = [...primaryFirst(true), ...primaryFirst(false)];
    const selected = images === 'primary' ? ordered.slice(0, 1) : ordered;
    const result: DecodedHeicImage[] = [];

    for (const image of selected) result.push(await display(image));

    return result;
  } catch (error) {
    if (error instanceof FunctionError) throw error;

    throw new FunctionError(
      'HEIC',
      `This HEIC file could not be decoded: ${error instanceof Error ? error.message : String(error)}.`,
    );
  } finally {
    // HeifDecoder frees a context only on its next decode: release the handles, then the context.
    for (const image of decoded) image.free();
    if (decoder.decoder) module.heif_context_free(decoder.decoder);
  }
}
