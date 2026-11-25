import { ToolDefinition, ToolError, ToolResult } from '@devtoolora/core';
import { base64Encode, dataUriFromBytes } from '@devtoolora/functions/binary';
import * as imageFunctions from '@devtoolora/functions/image';
import { choiceField, numericField, rangeField, rangedNumber } from '../../adapters/fields';

export const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];

export const annotationWidthField = rangeField({
  defaultValue: '4',
  id: 'annotationWidth',
  label: 'Line width',
  max: 40,
  min: 1,
  unit: 'px',
  visibleWhen: { field: 'operation', is: ['annotate'] },
});
export const annotationFontSizeField = rangeField({
  defaultValue: '32',
  id: 'annotationFontSize',
  label: 'Font size',
  max: 256,
  min: 8,
  unit: 'px',
  visibleWhen: { field: 'operation', is: ['annotate'] },
});

function annotateOptions(
  fields: Record<string, string>,
): NonNullable<imageFunctions.ImageTransformOptions['annotate']> {
  const commands = imageFunctions.parseAnnotations(fields.annotations ?? '');

  if (!commands.length) throw new ToolError('Add at least one annotation command.');

  return {
    color: fields.annotationColor || '#e11d48',
    commands,
    font: choiceField(
      fields.annotationFont,
      'sans-serif',
      ['sans-serif', 'serif', 'monospace'],
      'Choose sans-serif, serif or monospace as the font.',
    ),
    fontSize: rangedNumber(annotationFontSizeField, fields),
    width: rangedNumber(annotationWidthField, fields),
  };
}

export function imageOptions(
  fields: Record<string, string>,
  operation: string,
): imageFunctions.ImageTransformOptions {
  // Hidden fields still arrive, so only the operations that show them may read them.
  const resizes = operation === 'transform';
  const format =
    (resizes || operation === 'compress') &&
    (fields.format === 'png' || fields.format === 'jpeg' || fields.format === 'webp')
      ? fields.format
      : undefined;

  return {
    annotate: operation === 'annotate' ? annotateOptions(fields) : undefined,
    operation: operation as imageFunctions.ImageTransformOptions['operation'],
    colorBlindnessMode: (fields.colorBlindnessMode ||
      'deuteranopia') as imageFunctions.ImageTransformOptions['colorBlindnessMode'],
    width: resizes ? numberOrUndefined(fields.width) : undefined,
    height: resizes ? numberOrUndefined(fields.height) : undefined,
    keepAspect: fields.keepAspect !== 'false',
    crop: {
      mode:
        resizes && (fields.cropMode === 'custom' || fields.cropMode === 'center')
          ? fields.cropMode
          : 'none',
      x: numberOrUndefined(fields.cropX),
      y: numberOrUndefined(fields.cropY),
      width: numberOrUndefined(fields.cropWidth),
      height: numberOrUndefined(fields.cropHeight),
    },
    angle: numberOrUndefined(fields.angle),
    flip: fields.flipMode === 'vertical' ? 'vertical' : 'horizontal',
    brightness: numberOrUndefined(fields.brightness),
    contrast: numberOrUndefined(fields.contrast),
    saturation: numberOrUndefined(fields.saturation),
    blur: numberOrUndefined(fields.blur),
    sepia: fields.sepia === 'true',
    invert: fields.invert === 'true',
    watermark: {
      text: fields.watermarkText,
      color: fields.watermarkColor,
      opacity: numberOrUndefined(fields.watermarkOpacity),
      rotation: numberOrUndefined(fields.watermarkRotation),
      size: numberOrUndefined(fields.watermarkSize),
      position: (fields.watermarkPosition || 'center') as NonNullable<
        imageFunctions.ImageTransformOptions['watermark']
      >['position'],
    },
    format,
    quality: resizes ? numberOrUndefined(fields.quality) : undefined,
  };
}

export function numberOrUndefined(value: string | undefined): number | undefined {
  const parsed = Number(value);

  return value?.trim() && Number.isFinite(parsed) ? parsed : undefined;
}

export function parseBoundedInteger(
  value: string | undefined,
  label: string,
  min: number,
  max: number,
  fallback: number,
): number {
  return value?.trim() ? numericField(value, label, min, max, fallback) : fallback;
}

export function imageResult(
  bytes: Uint8Array,
  mimeType: string,
  fileName: string,
  summary: string,
): ToolResult {
  return {
    text: summary,
    summary,
    previewDataUri: dataUriFromBytes(bytes, mimeType),
    artifact: { base64: base64Encode(bytes), mimeType, fileName },
  };
}

export function fileExtension(extension: imageFunctions.ImageFormat): string {
  return extension === 'jpeg' ? 'jpg' : extension;
}

export function replaceExtension(name: string, extension: string): string {
  return `${name.replace(/\.[^.]+$/, '')}.${extension}`;
}

export const SAMPLE_PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAVklEQVR4AcXBQRGAQBDAsNJB3j2QgwQEnRy8gIh9NDnefX0MLG4mJCYxiUlMYhKTmMQkJjGJSUxiEpPYuR5GNjMSk5jEJCYxiUlMYhKTmMQkJjGJSewHvGQFbZXNf6YAAAAASUVORK5CYII=';

export const SAMPLE_RED_PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAK0lEQVR4nO3OIQEAAAwEoetfeovxBoGnq1tKQEBAQEBAQEBAQEBAQEBgHXhUDfhqRFDd3gAAAABJRU5ErkJggg==';

export const SAMPLE_BLUE_PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAALUlEQVR4nO3OIQEAAAwCMMK+fwUeAzMxv+TaKQEBAQEBAQEBAQEBAQEBgXXgAeCbiIhzLPC+AAAAAElFTkSuQmCC';

/**
 * A 16 × 16 JPEG with Apple iPhone 15 camera tags, a capture date and GPS coordinates in Prague.
 */
export const SAMPLE_GPS_JPEG_DATA_URI =
  'data:image/jpeg;base64,/9j/4QFORXhpZgAASUkqAAgAAAAGAA8BAgAGAAAAzgAAABABAgAKAAAA1AAAABIBAwABAAAAAQAAADIBAgAUAAAA3gAAAGmHBAABAAAAVgAAACWIBAABAAAAjAAAAAAAAAAEAJqCBQABAAAA8gAAAJ2CBQABAAAA+gAAACeIAwABAAAAQAAAAAOQAgAUAAAAAgEAAAAAAAAFAAAAAQAEAAAAAgMAAAEAAgACAAAATgAAAAIABQADAAAAFgEAAAMAAgACAAAARQAAAAQABQADAAAALgEAAAAAAABBcHBsZQBpUGhvbmUgMTUAMjAyNjowNjoxNCAxOTo0MjowNwABAAAAeAAAABIAAAAKAAAAMjAyNjowNjoxNCAxOTo0MjowNwAyAAAAAQAAAAUAAAABAAAAxgYAAGQAAAAOAAAAAQAAABkAAAABAAAA7AQAAGQAAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAQABADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAIF/8QAFhAAAwAAAAAAAAAAAAAAAAAAABRh/8QAFQEBAQAAAAAAAAAAAAAAAAAAAwT/xAAXEQADAQAAAAAAAAAAAAAAAAAAFGEV/9oADAMBAAIRAxEAPwCGqGqYrVDVAzYXv0//2Q==';

export const SAMPLE_TRANSPARENT_PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAxElEQVR4Ae3BS3EDQQxF0fuagyAImXA1MkEQCGWbco3nl3H1Ij6Hr39P3OBRzYacJi4SJ3lUc0FOEyeIEzyquSGniQPigEc1f5DTxA6xw6OaB+Q08YZ4w6OaB+U0sUFs8KjmA3KaeDFYbLCYeOFRzQflNPHLYLHBYoPFBosNFhMbPKr5gJwmXgwWGywm3vCo5kE5TWwQOzyqeUBOE2+IAx7V/EFOEzvECR7V3JDTxAFxkkc1F+Q0cYK4waOaDTlNfH1d9ANCvTwiumwMWwAAAABJRU5ErkJggg==';
