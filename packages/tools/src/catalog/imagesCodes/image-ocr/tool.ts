import { ToolDefinition, type ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import { recognizeText } from '@devtoolora/functions/image';
import { withToolErrorAsync } from '../../../adapters/errors';
import { booleanField, choiceField } from '../../../adapters/fields';
import { fileBytesFromField } from '../../../adapters/files';
import { browserSafeCapabilities } from '../shared';
import { CZECH_DATA_URI, DEV_TOOLORA_DATA_URI } from './sample';

const languages = ['eng', 'ces', 'eng+ces'] as const;
const layouts = ['auto', 'block', 'line', 'sparse'] as const;

async function recognize(fields: Record<string, string>): Promise<ToolResult> {
  const source = fileBytesFromField(fields.file, 'Image file');
  const language = choiceField(
    fields.language,
    'eng',
    languages,
    'Language must be eng, ces or eng+ces.',
  );
  const layout = choiceField(
    fields.layout,
    'auto',
    layouts,
    'Layout must be auto, block, line or sparse.',
  );
  const name = fields.fileName || 'image';

  const result = await withToolErrorAsync(() =>
    recognizeText(
      { bytes: source.bytes, mimeType: source.mimeType, name },
      { language, layout, upscale: booleanField(fields.upscale, false) },
    ),
  );
  const stem = name.replace(/\.[^.]*$/, '') || 'image';

  return {
    artifact: {
      base64: base64Encode(new TextEncoder().encode(JSON.stringify(result.report, null, 2))),
      fileName: `${stem}-ocr.json`,
      mimeType: 'application/json',
    },
    resultActions: ['copy', 'save'],
    summary: result.summary,
    text: result.text,
  };
}

const sample = (
  label: string,
  file: string,
  options: { language?: string; layout?: string; upscale?: string } = {},
) => ({
  fields: {
    file,
    fileName: file === CZECH_DATA_URI ? 'czech.png' : 'devtoolora.png',
    language: 'eng',
    layout: 'auto',
    upscale: 'false',
    ...options,
  },
  label,
});

export const imageOcrTool: ToolDefinition = {
  autoRun: false,
  capabilities: browserSafeCapabilities,
  category: 'Images & Codes',
  description:
    'Read text from a PNG, JPEG, WebP, BMP or GIF image with an OCR engine that runs in your browser.',
  fields: [
    {
      accept: '.png,.jpg,.jpeg,.webp,.bmp,.gif',
      id: 'file',
      label: 'Image file',
      maxBytes: 20 * 1_048_576,
      required: true,
      type: 'file',
    },
    {
      defaultValue: 'eng',
      id: 'language',
      label: 'Language',
      options: [
        { label: 'English', value: 'eng' },
        { label: 'Czech', value: 'ces' },
        { label: 'English + Czech', value: 'eng+ces' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'auto',
      id: 'layout',
      label: 'Layout',
      options: [
        { label: 'Automatic page', value: 'auto' },
        { label: 'One block of text', value: 'block' },
        { label: 'Single line', value: 'line' },
        { label: 'Sparse text', value: 'sparse' },
      ],
      type: 'select',
    },
    { defaultValue: 'false', id: 'upscale', label: 'Upscale 2x', type: 'checkbox' },
  ],
  freshResults: true,
  id: 'image-ocr',
  inputKind: 'none',
  keywords: ['ocr', 'image to text', 'tesseract', 'scan', 'recognize', 'screenshot', 'czech'],
  name: 'Image to Text (OCR)',
  outputKind: 'text',
  relatedToolIds: ['heic-converter', 'pdf-text-extractor', 'image-tools'],
  resultActions: ['copy', 'save'],
  run: ({ fields }) => recognize(fields),
  runRequires: [{ anyOf: ['file'] }],
  runtime: 'ocr',
  samples: [
    sample('English, automatic layout', DEV_TOOLORA_DATA_URI),
    sample('Czech text', CZECH_DATA_URI, { language: 'ces' }),
    sample('English + Czech', DEV_TOOLORA_DATA_URI, { language: 'eng+ces' }),
    sample('Single line layout', DEV_TOOLORA_DATA_URI, { layout: 'line' }),
    sample('One block, upscaled', DEV_TOOLORA_DATA_URI, { layout: 'block', upscale: 'true' }),
    sample('Sparse text layout', DEV_TOOLORA_DATA_URI, { layout: 'sparse' }),
  ],
  supportsSelection: false,
};

export const imageToTextTool: ToolDefinition = {
  ...imageOcrTool,
  aliasOf: 'image-ocr',
  description: 'Convert a screenshot or photo of text into editable text, locally in your browser.',
  id: 'image-to-text',
  name: 'Image to Text',
};
