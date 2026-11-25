import { ToolDefinition, type ToolField, type ToolResult } from '@devtoolora/core';
import { fluidClamp } from '@devtoolora/functions/css';
import { withToolError } from '../../../adapters/errors';
import { calculatorResult, cssGeneratorDefaults } from '../shared';
import { rangeField, rangedNumber } from '../../../adapters/fields';

const size = (id: string, label: string, defaultValue: string): ToolField =>
  rangeField({ defaultValue, id, label, max: 500, min: 1, step: 0.01, unit: 'px' });
const viewport = (id: string, label: string, defaultValue: string): ToolField =>
  rangeField({ defaultValue, id, label, max: 3840, min: 200, unit: 'px' });

const minSizeField = size('minSize', 'Minimum size', '16');
const maxSizeField = size('maxSize', 'Maximum size', '32');
const minViewportField = viewport('minViewport', 'Minimum viewport', '320');
const maxViewportField = viewport('maxViewport', 'Maximum viewport', '1280');
const rootSizeField = rangeField({
  defaultValue: '16',
  id: 'rootSize',
  label: 'Root font size',
  max: 64,
  min: 1,
  unit: 'px',
});
const unitField: ToolField = {
  defaultValue: 'rem',
  id: 'unit',
  label: 'Output unit',
  options: [
    { label: 'rem', value: 'rem' },
    { label: 'px', value: 'px' },
  ],
  presentation: 'segmented',
  type: 'select',
};

const zoomNote =
  'WCAG 1.4.4 warning: the maximum is more than 2.5 times the minimum, so text may not reach 200 % on browser zoom.';

function runClamp(values: Record<string, string>): ToolResult {
  const unit = values.unit ?? 'rem';
  const { css, ratio, samples, zoomWarning } = withToolError(() =>
    fluidClamp({
      maxSize: rangedNumber(maxSizeField, values),
      maxViewport: rangedNumber(maxViewportField, values),
      minSize: rangedNumber(minSizeField, values),
      minViewport: rangedNumber(minViewportField, values),
      rootSize: rangedNumber(rootSizeField, values),
      unit: unit === 'px' ? 'px' : 'rem',
    }),
  );
  const width = Math.max(...samples.map((sample) => String(sample.size).length));
  const table = samples.map(
    ({ size: px, viewport: vw }) => ` * ${`${vw}px`.padEnd(8)}${String(px).padStart(width)}px`,
  );
  const text = [
    `.fluid-type {\n  ${css}\n}`,
    '',
    `/* ${'Viewport'.padEnd(8)}${'Size'.padStart(width + 2)}`,
    ...table,
    ...(zoomWarning ? [` * ${zoomNote}`] : []),
    ' */',
    '',
  ].join('\n');

  return calculatorResult(
    text,
    'fluid-type.css',
    `Size ratio ${ratio}.${zoomWarning ? ` ${zoomNote}` : ' Passes the 2.5 zoom guideline.'}`,
    'css',
  );
}

const sample = (label: string, fields: Record<string, string>) => ({ fields, label });

export const cssClampGeneratorTool: ToolDefinition = {
  ...cssGeneratorDefaults,
  description:
    'Generate a fluid font-size with CSS clamp() between two viewport widths, with a size table and a WCAG zoom warning.',
  fields: [
    minSizeField,
    maxSizeField,
    minViewportField,
    maxViewportField,
    rootSizeField,
    unitField,
  ],
  id: 'css-clamp-generator',
  keywords: ['clamp', 'fluid typography', 'responsive font size', 'viewport', 'vw'],
  name: 'Fluid Type / clamp() Generator',
  relatedToolIds: ['css-unit-converter', 'css-grid-generator'],
  run: ({ fields: values }) => runClamp(values),
  samples: [
    sample('Body text 16 to 20', { maxSize: '20', maxViewport: '1280', minSize: '16' }),
    sample('Heading 24 to 48', { maxSize: '48', minSize: '24' }),
    sample('Display 32 to 96 (zoom warning)', { maxSize: '96', minSize: '32' }),
    sample('Pixel output', { unit: 'px' }),
    sample('Wide layout', { maxViewport: '1920', minViewport: '375' }),
    sample('62.5 % root', { rootSize: '10' }),
  ],
};
