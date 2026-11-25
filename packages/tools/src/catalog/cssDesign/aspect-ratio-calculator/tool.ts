import { ToolDefinition, type ToolField, type ToolResult } from '@devtoolora/core';
import { aspectRatio, solveAspect } from '@devtoolora/functions/css';
import { calculatorResult, cssGeneratorDefaults } from '../shared';
import { rangeField, rangedNumber } from '../../../adapters/fields';

const dimension = (
  id: string,
  label: string,
  defaultValue: string,
  visibleWhen?: ToolField['visibleWhen'],
): ToolField =>
  rangeField({ defaultValue, id, label, max: 1000000, min: 0.01, step: 0.01, visibleWhen });

const widthField = dimension('width', 'Width', '1920');
const heightField = dimension('height', 'Height', '1080');
const solveForField: ToolField = {
  defaultValue: 'none',
  id: 'solveFor',
  label: 'Solve for',
  options: [
    { label: 'None', value: 'none' },
    { label: 'Width', value: 'width' },
    { label: 'Height', value: 'height' },
  ],
  presentation: 'segmented',
  type: 'select',
};
const targetWidthField = dimension('targetWidth', 'Target width', '1280', {
  field: 'solveFor',
  is: ['height'],
});
const targetHeightField = dimension('targetHeight', 'Target height', '720', {
  field: 'solveFor',
  is: ['width'],
});

function runAspect(values: Record<string, string>): ToolResult {
  const solveFor = values.solveFor ?? 'none';
  const raw: [number, number] = [
    rangedNumber(widthField, values),
    rangedNumber(heightField, values),
  ];
  const { css, decimal, nearest, paddingTop, ratio } = aspectRatio(...raw);
  const sign = nearest.deviation < 0 ? '-' : '+';
  const lines: Array<[string, string]> = [
    ['Ratio', `${ratio[0]}:${ratio[1]}`],
    ['Decimal', String(decimal)],
    ['Nearest', `${nearest.label} (${sign}${Math.abs(nearest.deviation).toFixed(4)} %)`],
    ['CSS', css],
    ['', `padding-top: ${paddingTop}%;`],
  ];

  if (solveFor === 'height')
    lines.push([
      'Height',
      String(solveAspect(raw, { width: rangedNumber(targetWidthField, values) })),
    ]);

  if (solveFor === 'width')
    lines.push([
      'Width',
      String(solveAspect(raw, { height: rangedNumber(targetHeightField, values) })),
    ]);

  const text = `${lines.map(([label, value]) => `${label.padEnd(9)}${value}`).join('\n')}\n`;

  return calculatorResult(
    text,
    'aspect-ratio.txt',
    `${ratio[0]}:${ratio[1]} (${decimal}), nearest common ratio ${nearest.label}.`,
    'plaintext',
  );
}

const sample = (label: string, fields: Record<string, string>) => ({ fields, label });

export const aspectRatioCalculatorTool: ToolDefinition = {
  ...cssGeneratorDefaults,
  description:
    'Simplify a width and height to an aspect ratio, find the nearest common ratio and get aspect-ratio CSS or the missing dimension.',
  fields: [widthField, heightField, solveForField, targetWidthField, targetHeightField],
  id: 'aspect-ratio-calculator',
  keywords: ['aspect ratio', '16:9', 'resolution', 'dimensions', 'width height'],
  name: 'Aspect Ratio Calculator',
  relatedToolIds: ['image-tools', 'css-unit-converter'],
  run: ({ fields: values }) => runAspect(values),
  samples: [
    sample('Full HD 16:9', {}),
    sample('Scale to 1280 wide', { solveFor: 'height', targetWidth: '1280' }),
    sample('Laptop 1366x768', { height: '768', width: '1366' }),
    sample('Portrait phone', { height: '2400', width: '1080' }),
    sample('Photo 3:2 to height 600', {
      height: '2000',
      solveFor: 'width',
      targetHeight: '600',
      width: '3000',
    }),
    sample('Square', { height: '512', width: '512' }),
  ],
};
