import { ToolDefinition, ToolResult } from '@devtoolora/core';
import { base64Encode, dataUriFromBytes } from '@devtoolora/functions/binary';
import * as imageFunctions from '@devtoolora/functions/image';
import { withToolErrorAsync } from '../../../adapters/errors';
import {
  choiceField,
  colorField,
  numericField,
  rangeField,
  rangedNumber,
} from '../../../adapters/fields';
import { filesFromField } from '../../../adapters/files';
import { ToolError } from '@devtoolora/core';
import { browserSafeCapabilities } from '../shared';

const delayField = rangeField({
  defaultValue: '100',
  id: 'delay',
  label: 'Delay (ms)',
  max: 60_000,
  min: 20,
  unit: 'ms',
});
const repeatCountField = rangeField({
  defaultValue: '3',
  id: 'repeatCount',
  label: 'Plays',
  max: 100,
  min: 1,
  visibleWhen: { field: 'repeat', is: ['count'] },
});

// Three 64 x 40 px frames of a growing dot, named so that file order is the frame order.
const FRAMES = JSON.stringify([
  {
    data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAYAAABOzvzpAAAAf0lEQVR42u3ZOxWAQAwEwDigxAM6zr8VJIAAoKBI3n2mWAE7zb3sxbYf18oJAAAAAAAAAACA6pytPTI9wFvpr0wH8Kd8JUL0Wr4KIXouX4EQvZfPRogRymciAAAwSPksBAAAAADwCgAA4BZwDdoDLEI2QauwfwEAAAAAAABgqdxcp+TqpHomDQAAAABJRU5ErkJggg==',
    name: '01.png',
  },
  {
    data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAYAAABOzvzpAAAAkklEQVR42u3asRGAIBBE0e3AyLEH+y+Diky0Aki4Axd+QOz8FyF3Oq773fkIgAkffcpZPcsCtKJnYuhv0aMx5BCfiSCX+CwEOcVnIMgtPhpBjvGRCHKNj0KQc3wEAgAAmMf3IgAAwALxPQgAAAAAAAAAwD0AAAD4GwQAAN4EeRVmLsBkiNkg02H2A9gQYUdop/MB2Sd2CZidu4EAAAAASUVORK5CYII=',
    name: '02.png',
  },
  {
    data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAYAAABOzvzpAAAAiElEQVR42u3asRGAIAxA0WxgaW/pUG7rXDqCQLzziK9Iz38VB4ll3a/sbOfx2WTPHjPHv4EQs8dnEaJCfAYhqsSPIkSl+BGEqBbfiwCgYnwPAoCq8a0IACrHtyAAAACgdvwTAgAAAAAAAAAAgJsgAAAAvAgB8CoMwM8QAL/D9gNsiNgR+tGW2A2EkMoeMS3WSwAAAABJRU5ErkJggg==',
    name: '03.png',
  },
]);

function parseDelays(value: string | undefined, count: number, fallback: number): number[] {
  if (!value?.trim()) return Array.from({ length: count }, () => fallback);

  return value.split(',').map((part) => {
    if (!/^\s*\d+\s*$/.test(part)) throw new ToolError('Delays must be whole numbers in ms.');

    return Number(part);
  });
}

function optionalSide(value: string | undefined, label: string): number | null {
  if (!value?.trim()) return null;

  try {
    return numericField(value, label, 1, 1024, 1);
  } catch (error) {
    // The shared message prints the limit as 1024; the tool copy writes 1,024.
    if (error instanceof ToolError) throw new ToolError(error.message.replace('1024', '1,024'));

    throw error;
  }
}

function loopCountFor(repeat: string, plays: number): number | null {
  if (repeat === 'forever') return 0;

  return plays === 1 ? null : plays - 1;
}

async function generate(fields: Record<string, string>): Promise<ToolResult> {
  const files = filesFromField(fields.files, 'Images');
  const repeat = choiceField(
    fields.repeat,
    'forever',
    ['forever', 'count'],
    'Choose forever or count as the repeat mode.',
  );
  const plays = repeat === 'count' ? rangedNumber(repeatCountField, fields) : 0;
  const result = await withToolErrorAsync(() =>
    imageFunctions.createGif(
      files.map(({ bytes, mimeType, name }) => ({ bytes, mimeType, name })),
      {
        background: fields.background?.trim() || 'transparent',
        delays: parseDelays(
          fields.delays,
          files.length,
          numericField(fields.delay, 'Delay', 0, 1_000_000, 100),
        ),
        dither: choiceField(
          fields.dither,
          'floyd-steinberg',
          ['floyd-steinberg', 'none'],
          'Choose floyd-steinberg or none as the dither.',
        ),
        fit: choiceField(
          fields.fit,
          'contain',
          ['contain', 'cover', 'stretch'],
          'Choose contain, cover or stretch as the fit.',
        ),
        height: optionalSide(fields.height, 'Height'),
        loopCount: loopCountFor(repeat, plays),
        width: optionalSide(fields.width, 'Width'),
      },
    ),
  );
  const base = (files[0]?.name ?? '').replace(/[\\/]/g, '').replace(/\.[^.]*$/, '') || 'animation';

  return {
    artifact: { base64: base64Encode(result.gif), fileName: `${base}.gif`, mimeType: 'image/gif' },
    previewDataUri: dataUriFromBytes(result.gif, 'image/gif'),
    resultActions: ['save', 'copy'],
    summary: result.summary,
    text: result.text,
  };
}

const sample = (label: string, fields: Record<string, string>) => ({
  fields: { files: FRAMES, ...fields },
  label,
});

export const gifMakerTool: ToolDefinition = {
  autoRun: false,
  capabilities: browserSafeCapabilities,
  category: 'Images & Codes',
  description:
    'Turn images into an animated GIF with per-frame delays, fit, background and loop count.',
  fields: [
    {
      accept: 'image/png,image/jpeg,image/webp,image/bmp,image/gif',
      id: 'files',
      label: 'Images',
      maxBytes: 10 * 1_048_576,
      multiple: true,
      required: true,
      type: 'file',
    },
    { id: 'width', label: 'Width (px)', placeholder: 'First frame', type: 'text' },
    { id: 'height', label: 'Height (px)', placeholder: 'First frame', type: 'text' },
    {
      defaultValue: 'contain',
      id: 'fit',
      label: 'Fit',
      options: [
        { label: 'Contain', value: 'contain' },
        { label: 'Cover', value: 'cover' },
        { label: 'Stretch', value: 'stretch' },
      ],
      type: 'select',
    },
    colorField('background', 'Background', 'transparent'),
    delayField,
    {
      id: 'delays',
      label: 'Delays per frame (ms)',
      placeholder: 'e.g. 100,200,100',
      type: 'text',
    },
    {
      defaultValue: 'forever',
      id: 'repeat',
      label: 'Repeat',
      options: [
        { label: 'Forever', value: 'forever' },
        { label: 'Number of plays', value: 'count' },
      ],
      type: 'select',
    },
    repeatCountField,
    {
      defaultValue: 'floyd-steinberg',
      id: 'dither',
      label: 'Dither',
      options: [
        { label: 'Floyd-Steinberg', value: 'floyd-steinberg' },
        { label: 'None', value: 'none' },
      ],
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'gif-maker',
  inputKind: 'none',
  keywords: ['gif', 'animation', 'images', 'frames', 'animated', 'slideshow'],
  name: 'Images to GIF',
  outputKind: 'text',
  relatedToolIds: ['gif-frame-extractor', 'sprite-sheet-generator', 'image-tools'],
  resultActions: ['save', 'copy'],
  run: ({ fields }) => generate(fields),
  runRequires: [{ anyOf: ['files'] }],
  samples: [
    sample('Three-frame blink', {}),
    sample('Transparent background, wide canvas', { height: '40', width: '96' }),
    sample('Cover on a square canvas', { fit: 'cover', height: '48', width: '48' }),
    sample('Delays per frame', { delays: '300,100,500' }),
    sample('Plays 3 times', { repeat: 'count', repeatCount: '3' }),
    sample('No dithering', { dither: 'none' }),
  ],
  supportsSelection: false,
};

export const imagesToGifTool: ToolDefinition = {
  ...gifMakerTool,
  aliasOf: 'gif-maker',
  description: 'Combine several pictures into one looping animated GIF, in file order.',
  id: 'images-to-gif',
  name: 'Animated GIF Maker',
};
