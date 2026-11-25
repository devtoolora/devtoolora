import { ToolDefinition, ToolResult } from '@devtoolora/core';
import { base64Encode, dataUriFromBytes } from '@devtoolora/functions/binary';
import * as imageFunctions from '@devtoolora/functions/image';
import { withToolErrorAsync } from '../../../adapters/errors';
import { fileBytesFromField } from '../../../adapters/files';
import { browserSafeCapabilities } from '../shared';
import {
  ANIMATED_GIF_DATA_URI,
  INTERLACED_GIF_DATA_URI,
  LOCAL_PALETTE_GIF_DATA_URI,
} from './sample';

async function extractFrames(fields: Record<string, string>): Promise<ToolResult> {
  const source = fileBytesFromField(fields.file, 'GIF file');
  const result = await withToolErrorAsync(() =>
    imageFunctions.extractGifFrames(source.bytes, fields.fileName ?? '', fields.frames ?? ''),
  );

  return {
    artifact: {
      base64: base64Encode(result.zip),
      fileName: result.fileName,
      mimeType: 'application/zip',
    },
    language: 'json',
    previewDataUri: dataUriFromBytes(result.firstPng, 'image/png'),
    resultActions: ['save', 'copy'],
    summary: result.summary,
    text: JSON.stringify(result.report, null, 2),
  };
}

const sample = (label: string, file: string, frames: string, fileName: string) => ({
  fields: { file, fileName, frames },
  label,
});

export const gifFrameExtractorTool: ToolDefinition = {
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Images & Codes',
  description:
    'Split a GIF into PNG frames in a zip, with a JSON file of delays, disposal and frame rectangles.',
  fields: [
    {
      accept: '.gif,image/gif',
      id: 'file',
      label: 'GIF file',
      maxBytes: 20 * 1_048_576,
      required: true,
      type: 'file',
    },
    {
      id: 'frames',
      label: 'Frames',
      placeholder: 'All frames, or e.g. 1-10,15',
      type: 'text',
    },
  ],
  freshResults: true,
  id: 'gif-frame-extractor',
  inputKind: 'none',
  keywords: ['gif', 'frames', 'animation', 'split', 'extract', 'png', 'zip'],
  name: 'GIF Frame Extractor',
  outputKind: 'json',
  relatedToolIds: ['sprite-sheet-generator', 'image-tools', 'pixel-diff', 'gif-maker'],
  resultActions: ['save', 'copy'],
  run: ({ fields }) => extractFrames(fields),
  runRequires: [{ anyOf: ['file'] }],
  samples: [
    sample('3-frame animation, all frames', ANIMATED_GIF_DATA_URI, '', 'blink.gif'),
    sample('Only frame 2', ANIMATED_GIF_DATA_URI, '2', 'blink.gif'),
    sample('Frames 1 and 3', ANIMATED_GIF_DATA_URI, '1,3', 'blink.gif'),
    sample('Interlaced single frame', INTERLACED_GIF_DATA_URI, '', 'interlaced.gif'),
    sample('Local palettes, loops 3 times', LOCAL_PALETTE_GIF_DATA_URI, '', 'palettes.gif'),
    sample('Local palettes, frames 2-3', LOCAL_PALETTE_GIF_DATA_URI, '2-3', 'palettes.gif'),
  ],
  supportsSelection: false,
};

export const gifSplitterTool: ToolDefinition = {
  ...gifFrameExtractorTool,
  aliasOf: 'gif-frame-extractor',
  description: 'Split an animated GIF into numbered PNG images and a timing file, in one zip.',
  id: 'gif-splitter',
  name: 'GIF Splitter',
};
