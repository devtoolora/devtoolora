import { ToolDefinition, ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import * as imageFunctions from '@devtoolora/functions/image';
import { withToolErrorAsync } from '../../../adapters/errors';
import { fileBytesFromField } from '../../../adapters/files';
import {
  browserSafeCapabilities,
  numberOrUndefined,
  SAMPLE_BLUE_PNG_DATA_URI,
  SAMPLE_PNG_DATA_URI,
  SAMPLE_RED_PNG_DATA_URI,
  SAMPLE_TRANSPARENT_PNG_DATA_URI,
} from '../shared';

/** The 32 × 32 blue square with an 8 × 8 red block in the top right. */
const SAMPLE_BLUE_CHANGED_PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAU0lEQVR4AcXBsQ2AQAzAQMdi1B+LXUNLRYXku+HsEpKYxCR28bO9hy9zljeJSUxiEpOYxCQ2nF1CEpOYxCQmMYlJTGISk5jEJCYxiUlMYhKTmMQevlEIBeh36usAAAAASUVORK5CYII=';

/** The 32 × 32 blue square shifted to rgb(6 106 255). */
const SAMPLE_BLUE_LIGHTER_PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAR0lEQVR4AcXBMQEAMAyAMMoxsfP/tzJI5v1dQhKTmMQkJjGJSUxiEpOYxCQmMYlJTGISk5jEJCYxiUlMYhKTmMQkJjGJSewAPHQCrl6v2OYAAAAASUVORK5CYII=';

export const pixelDiffTool: ToolDefinition = {
  id: 'pixel-diff',
  keywords: ['image diff', 'compare images', 'visual regression', 'screenshot diff', 'difference'],
  name: 'Pixel Diff',
  category: 'Images & Codes',
  description: 'Compare two same-size local images and generate a highlighted difference map.',
  inputKind: 'none',
  outputKind: 'json',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  resultActions: ['save', 'copy', 'scratch'],
  fields: [
    { id: 'beforeImage', label: 'Before image', required: true, type: 'file', accept: 'image/*' },
    { id: 'afterImage', label: 'After image', required: true, type: 'file', accept: 'image/*' },
    { id: 'threshold', label: 'Difference threshold', type: 'number', defaultValue: '10' },
  ],
  relatedToolIds: ['image-tools', 'svg-to-png', 'batch-image-tools'],
  samples: [
    {
      fields: {
        afterImage: SAMPLE_PNG_DATA_URI,
        beforeImage: SAMPLE_PNG_DATA_URI,
        threshold: '0',
      },
      label: 'Identical images (0 changed)',
    },
    {
      fields: {
        afterImage: SAMPLE_BLUE_CHANGED_PNG_DATA_URI,
        beforeImage: SAMPLE_BLUE_PNG_DATA_URI,
        threshold: '10',
      },
      label: 'One changed region (64 pixels)',
    },
    {
      fields: {
        afterImage: SAMPLE_BLUE_LIGHTER_PNG_DATA_URI,
        beforeImage: SAMPLE_BLUE_PNG_DATA_URI,
        threshold: '10',
      },
      label: 'Small color shift below the threshold',
    },
    {
      fields: {
        afterImage: SAMPLE_BLUE_LIGHTER_PNG_DATA_URI,
        beforeImage: SAMPLE_BLUE_PNG_DATA_URI,
        threshold: '0',
      },
      label: 'Same color shift with threshold 0',
    },
    {
      fields: {
        afterImage: SAMPLE_BLUE_PNG_DATA_URI,
        beforeImage: SAMPLE_RED_PNG_DATA_URI,
        threshold: '50',
      },
      label: 'Completely different colors',
    },
    {
      fields: {
        afterImage: SAMPLE_BLUE_PNG_DATA_URI,
        beforeImage: SAMPLE_TRANSPARENT_PNG_DATA_URI,
        threshold: '40',
      },
      label: 'Logo on transparency vs solid fill',
    },
  ],
  run: ({ fields }) => pixelDiffImages(fields),
};

async function pixelDiffImages(fields: Record<string, string>): Promise<ToolResult> {
  const before = fileBytesFromField(fields.beforeImage, 'Before image');
  const after = fileBytesFromField(fields.afterImage, 'After image');
  const result = await withToolErrorAsync(() =>
    imageFunctions.pixelDiff(
      { name: 'before', ...before },
      { name: 'after', ...after },
      numberOrUndefined(fields.threshold) ?? 10,
    ),
  );

  return {
    text: JSON.stringify(
      { width: result.width, height: result.height, changedPixels: result.changedPixels },
      null,
      2,
    ),
    language: 'json',
    artifact: {
      base64: base64Encode(result.bytes),
      mimeType: 'image/png',
      fileName: 'pixel-diff.png',
    },
  };
}
