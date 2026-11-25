import type { AnnotateOptions } from './annotate';

export type ImageFile = { bytes: Uint8Array; mimeType: string; name: string };
export type ImageFormat = 'png' | 'jpeg' | 'webp';
export type ImageTransformOptions = {
  angle?: number;
  annotate?: AnnotateOptions;
  blur?: number;
  brightness?: number;
  colorBlindnessMode?: 'deuteranopia' | 'protanopia' | 'tritanopia' | 'achromatopsia';
  contrast?: number;
  crop?: {
    height?: number;
    mode: 'none' | 'center' | 'cover' | 'custom';
    width?: number;
    x?: number;
    y?: number;
  };
  flip?: 'horizontal' | 'vertical';
  format?: ImageFormat;
  height?: number;
  invert?: boolean;
  keepAspect?: boolean;
  operation?:
    | 'transform'
    | 'annotate'
    | 'rotate'
    | 'flip'
    | 'grayscale'
    | 'color-blindness'
    | 'filters'
    | 'watermark';
  quality?: number;
  saturation?: number;
  sepia?: boolean;
  watermark?: {
    color?: string;
    opacity?: number;
    position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    rotation?: number;
    size?: number;
    text?: string;
  };
  width?: number;
};
export type EncodedImage = { bytes: Uint8Array; extension: ImageFormat; mimeType: string };
export type DetectedImageFormat = { extension: string; format: string; mimeType: string };
export type ImageInspection = {
  aspectRatio: string;
  detectedExtension: string;
  /**
   * Read from the file's signature bytes; `mimeType` is the detected type, `file.mimeType` the one
   * the file was given.
   */
  detectedFormat: string;
  file: { height: number; mimeType: string; name: string; width: number };
  megapixels: number;
  mimeType: string;
  pageCount: number;
  transparent: boolean;
};
export type MetadataRemoval = {
  hasMetadata: boolean;
  height: number;
  image: EncodedImage;
  metadata: Record<string, unknown>;
  metadataChunks?: string[];
  webpFallback: boolean;
  width: number;
};
