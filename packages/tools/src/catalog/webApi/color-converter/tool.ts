import { ToolDefinition, ToolError } from '@devtoolora/core';
import { cssColorSwatchSvg, formatCssColor, parseCssColor } from '@devtoolora/functions/color';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { processJsonDocument } from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';

const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];

export const colorConverterTool: ToolDefinition = {
  id: 'color-converter',
  name: 'Color Converter',
  category: 'CSS & Design',
  description:
    'Convert any CSS color, including hex, rgb(), hsl(), hwb(), oklch(), oklab(), lab(), lch() and named colors, with alpha, a live swatch and contrast on white and black.',
  samples: [
    { fields: { syntax: 'commas' }, label: 'Hex (#3b82f6)', text: '#3b82f6' },
    { fields: { syntax: 'commas' }, label: 'Hex with alpha', text: '#3b82f680' },
    {
      fields: { syntax: 'spaces' },
      label: 'Modern rgb() with alpha',
      text: 'rgb(59 130 246 / 50%)',
    },
    { fields: { syntax: 'spaces' }, label: 'OKLCH', text: 'oklch(62% 0.19 260)' },
    { fields: { syntax: 'commas' }, label: 'Named color', text: 'rebeccapurple' },
    { fields: { syntax: 'spaces' }, label: 'Outside the sRGB gamut', text: 'oklch(70% 0.4 150)' },
  ],
  inputKind: 'text',
  inputPresentation: {
    label: 'Color',
    placeholder:
      '#3b82f6, rgb(59 130 246 / 50%), hsl(217 91% 60%), oklch(62% 0.19 260) or royalblue',
  },
  outputKind: 'json',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  autoRun: true,
  freshResults: true,
  fields: [
    {
      defaultValue: 'commas',
      help: 'Commas: rgb(59, 130, 246) and rgba(). Spaces: CSS Color 4 rgb(59 130 246 / 50%).',
      id: 'syntax',
      label: 'rgb() and hsl() syntax',
      options: [
        { label: 'Commas', value: 'commas' },
        { label: 'Spaces', value: 'spaces' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  keywords: [
    'color converter',
    'hex to rgb',
    'rgb to hex',
    'hex to hsl',
    'oklch',
    'oklab',
    'lab',
    'lch',
    'hwb',
    'cmyk',
    'css color',
    'named colors',
    'contrast',
  ],
  relatedToolIds: ['color-palette', 'css-box-shadow-generator'],
  resultActions: ['copy', 'replace', 'insert', 'scratch'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const syntax = fields.syntax || 'commas';

      if (syntax !== 'commas' && syntax !== 'spaces')
        throw new ToolError('Choose Commas or Spaces syntax.');

      const color = parseCssColor(text);
      const report = formatCssColor(color, syntax);
      const output = JSON.stringify(report, null, 2);
      const best = report.contrast.textColor === '#000000' ? 'black' : 'white';

      return {
        jsonTree: {
          expandedLevels: 2,
          nodes: processJsonDocument(output, { collectTree: true, mode: 'minify' }).nodes,
        },
        language: 'json',
        previewDataUri: `data:image/svg+xml;base64,${encodeBase64Text(cssColorSwatchSvg(color, report))}`,
        summary: `${report.hex} · ${report.oklch} · ${best} text reads better (${Math.max(report.contrast.onBlack, report.contrast.onWhite)}:1)${color.gamutMapped ? ' · mapped into sRGB' : ''}.`,
        text: output,
      };
    }),
};
