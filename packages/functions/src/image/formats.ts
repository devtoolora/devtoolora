import { FunctionError } from '../errors';
import type { DetectedImageFormat, ImageFile, ImageFormat } from './types';

export function detectImageFormat(bytes: Uint8Array): DetectedImageFormat | undefined {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  const format = (name: string, extension: string, mimeType: string) => ({
    format: name,
    extension,
    mimeType,
  });

  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)
  )
    return format('png', 'png', 'image/png');
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return format('jpeg', 'jpg', 'image/jpeg');
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP')
    return format('webp', 'webp', 'image/webp');
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')
    return format('gif', 'gif', 'image/gif');
  if (ascii(0, 2) === 'BM' && bytes.length > 14) return format('bmp', 'bmp', 'image/bmp');
  if (ascii(4, 8) === 'ftyp' && /^avi[fs]$/.test(ascii(8, 12)))
    return format('avif', 'avif', 'image/avif');
  if (ascii(4, 8) === 'ftyp' && /^he[iv][cxms]$/.test(ascii(8, 12)))
    return format('heic', 'heic', 'image/heic');
  if (ascii(0, 4) === 'II*\0' || ascii(0, 4) === 'MM\0*')
    return format('tiff', 'tiff', 'image/tiff');
  if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0)
    return format('ico', 'ico', 'image/x-icon');

  return undefined;
}

export function mayHaveAlpha(bytes: Uint8Array, format: string): boolean {
  if (format === 'jpeg') return false;
  if (format === 'webp') return String.fromCharCode(...bytes.subarray(12, 16)) !== 'VP8 ';
  if (format === 'png')
    return bytes[25] === 4 || bytes[25] === 6 || pngChunkTypes(bytes).includes('tRNS');

  return true;
}

export function pngChunkTypes(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const types: string[] = [];

  for (let offset = 8; offset + 8 <= bytes.length; offset += view.getUint32(offset) + 12) {
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));

    types.push(type);
    if (type === 'IEND') break;
  }

  return types;
}

export function sourceFormat(file: ImageFile): ImageFormat {
  const detected = detectImageFormat(file.bytes);

  if (!detected) return mimeExtension(file.mimeType);

  return detected.format === 'jpeg' || detected.format === 'webp' ? detected.format : 'png';
}

export function mimeForExtension(extension: ImageFormat): string {
  return `image/${extension}`;
}

export function mimeExtension(mimeType: string): ImageFormat {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpeg';
  if (mimeType.includes('webp')) return 'webp';

  return 'png';
}

export function normalizedQuality(value = 82): number {
  return Math.max(1, Math.min(100, Number.isFinite(value) ? value : 82)) / 100;
}

export function aspectRatio(width: number, height: number): string {
  const divisor = gcd(width, height);

  return `${width / divisor}:${height / divisor}`;
}

function gcd(left: number, right: number): number {
  return right === 0 ? left : gcd(right, left % right);
}

export function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export function imageError(message: string): FunctionError {
  return new FunctionError('IMAGE_ERROR', message);
}
