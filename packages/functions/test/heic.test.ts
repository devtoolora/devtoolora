import { beforeAll, describe, expect, it, vi } from 'vitest';
import { decodeHeic, detectHeic, prepareHeic } from '@devtoolora/functions/image';
import { loadRuntimeFilesForTest } from './fixtures/runtimeFiles';
import {
  AVIF_HEADER,
  CORNERS_HEIC,
  MULTI_HEIC,
  ROTATED_HEIC,
  TRUNCATED_HEIC,
} from './fixtures/heicFixtures';

const base64 = (value: string): Uint8Array => new Uint8Array(Buffer.from(value, 'base64'));
const pixel = (image: { data: Uint8ClampedArray; width: number }, x: number, y: number) =>
  Array.from(image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 3));

function near(actual: number[], expected: number[]): void {
  actual.forEach((value, index) =>
    expect(Math.abs(value - expected[index]!)).toBeLessThanOrEqual(2),
  );
}

describe('heic', () => {
  beforeAll(async () => {
    await loadRuntimeFilesForTest('heic');
    await prepareHeic();
  });

  it('decodes 64×64 with matching corners', async () => {
    const [image] = await decodeHeic(base64(CORNERS_HEIC), 'primary');

    expect([image!.width, image!.height]).toEqual([64, 64]);
    near(pixel(image!, 2, 2), [255, 0, 0]);
    near(pixel(image!, 61, 61), [0, 0, 255]);
  });

  it('applies irot so the output is upright', async () => {
    const [image] = await decodeHeic(base64(ROTATED_HEIC), 'primary');

    expect([image!.width, image!.height]).toEqual([32, 64]);
    // heif-convert puts the red square top-right after the 270° rotation.
    near(pixel(image!, 29, 2), [255, 0, 0]);
    near(pixel(image!, 2, 2), [255, 255, 255]);
  });

  it('primary vs all', async () => {
    expect(await decodeHeic(base64(MULTI_HEIC), 'primary')).toHaveLength(1);
    expect(await decodeHeic(base64(MULTI_HEIC), 'all')).toHaveLength(2);
  });

  it('detects AVIF and non-HEIC', () => {
    expect(() => detectHeic(base64(AVIF_HEADER))).toThrow(
      'This is an AVIF file; browsers open it directly. Use Image Tools to convert it.',
    );

    expect(() =>
      detectHeic(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 13)),
    ).toThrow('This is not a HEIC/HEIF file.');
  });

  it('truncated file fails with a message', async () => {
    await expect(decodeHeic(base64(TRUNCATED_HEIC), 'all')).rejects.toThrow(/could not be decoded/);
  });

  const CONTEXT = 7;

  const mockLoad =
    (decode: () => unknown[], contextFree: (context: number) => void = vi.fn()) =>
    () =>
      Promise.resolve((options: { onRuntimeInitialized(): void }) => {
        options.onRuntimeInitialized();

        return {
          HeifDecoder: class {
            decoder: number | null = null;

            decode = () => {
              this.decoder = CONTEXT;

              return decode();
            };
          },
          heif_context_free: contextFree,
        };
      }) as never;

  it('pixel limit', async () => {
    const display = vi.fn();
    const image = {
      display,
      free: vi.fn(),
      get_height: () => 8001,
      get_width: () => 8000,
      is_primary: () => true,
    };

    await expect(
      decodeHeic(
        base64(CORNERS_HEIC),
        'all',
        mockLoad(() => [image]),
      ),
    ).rejects.toThrow(/64,000,000 pixels/);

    expect(display).not.toHaveBeenCalled();
    expect(image.free).toHaveBeenCalledTimes(1);
  });

  it('frees the libheif context once per decode, also when decoding fails', async () => {
    const contextFree = vi.fn();
    const image = {
      display: (target: unknown, done: (r: unknown) => void) => done(target),
      free: vi.fn(),
      get_height: () => 1,
      get_width: () => 1,
      is_primary: () => true,
    };

    const failing = () => {
      throw new Error('boom');
    };

    await decodeHeic(
      base64(CORNERS_HEIC),
      'all',
      mockLoad(() => [image], contextFree),
    );

    expect(contextFree).toHaveBeenCalledTimes(1);

    await expect(
      decodeHeic(base64(CORNERS_HEIC), 'all', mockLoad(failing, contextFree)),
    ).rejects.toThrow('This HEIC file could not be decoded: boom.');

    expect(contextFree).toHaveBeenCalledTimes(2);

    await expect(
      decodeHeic(
        base64(CORNERS_HEIC),
        'all',
        mockLoad(() => [], contextFree),
      ),
    ).rejects.toThrow(/no image found/);

    expect(contextFree).toHaveBeenCalledTimes(3);
    expect(contextFree).toHaveBeenCalledWith(CONTEXT);
  });

  it('puts the primary image first and frees every image', async () => {
    const make = (width: number, primary: boolean) => ({
      display: (target: unknown, done: (r: unknown) => void) => done(target),
      free: vi.fn(),
      get_height: () => 1,
      get_width: () => width,
      is_primary: () => primary,
    });
    const images = [make(1, false), make(2, true)];

    const all = await decodeHeic(
      base64(CORNERS_HEIC),
      'all',
      mockLoad(() => images),
    );
    const primary = await decodeHeic(
      base64(CORNERS_HEIC),
      'primary',
      mockLoad(() => images),
    );

    expect(all.map((image) => image.width)).toEqual([2, 1]);
    expect(primary.map((image) => image.width)).toEqual([2]);
    images.forEach((image) => expect(image.free).toHaveBeenCalledTimes(2));
  });

  it('rejects more than 50 images', async () => {
    const images = Array.from({ length: 51 }, () => ({ free: vi.fn(), is_primary: () => false }));

    await expect(
      decodeHeic(
        base64(CORNERS_HEIC),
        'all',
        mockLoad(() => images),
      ),
    ).rejects.toThrow(/50 images/);
  });
});
