import { ToolDefinition, type ToolField, type ToolResult } from '@devtoolora/core';
import { generateGlassCss } from '@devtoolora/functions/css';
import { withToolError } from '../../../adapters/errors';
import { cssGeneratorDefaults, cssToolResult } from '../shared';
import { rangeField, rangedNumber } from '../../../adapters/fields';

const tintField: ToolField = {
  defaultValue: '#ffffff',
  id: 'tint',
  label: 'Tint',
  placeholder: '#ffffff',
  presentation: 'color',
  type: 'text',
};

const tintOpacityField = rangeField({
  defaultValue: '20',
  id: 'tintOpacity',
  label: 'Tint opacity',
  max: 100,
  min: 0,
  unit: '%',
});
const blurField = rangeField({
  defaultValue: '12',
  id: 'blur',
  label: 'Blur',
  max: 40,
  min: 0,
  unit: 'px',
});
const saturationField = rangeField({
  defaultValue: '140',
  id: 'saturation',
  label: 'Saturation',
  max: 200,
  min: 100,
  unit: '%',
});
const borderOpacityField = rangeField({
  defaultValue: '30',
  id: 'borderOpacity',
  label: 'Border opacity',
  max: 100,
  min: 0,
  unit: '%',
});
const cornerRadiusField = rangeField({
  defaultValue: '16',
  id: 'cornerRadius',
  label: 'Corner radius',
  max: 64,
  min: 0,
  unit: 'px',
});

function runGlass(values: Record<string, string>): ToolResult {
  const tint = values.tint ?? '#ffffff';

  const css = withToolError(() =>
    generateGlassCss({
      blur: rangedNumber(blurField, values),
      borderOpacity: rangedNumber(borderOpacityField, values),
      cornerRadius: rangedNumber(cornerRadiusField, values),
      saturation: rangedNumber(saturationField, values),
      tint,
      tintOpacity: rangedNumber(tintOpacityField, values),
    }),
  );

  return cssToolResult({
    css,
    fields: values,
    fileName: 'glass.css',
    kind: 'glass',
    summary:
      'Frosted-glass rule with a -webkit-backdrop-filter fallback. Text contrast depends on what is behind the panel, so check it on your real background. The preview backdrop and sample text are not exported.',
  });
}

const sample = (label: string, fields: Record<string, string>) => ({ fields, label });

export const cssGlassmorphismGeneratorTool: ToolDefinition = {
  ...cssGeneratorDefaults,
  description:
    'Build a frosted-glass card with tint, blur, saturation and border sliders, and judge text contrast over a colorful live backdrop.',
  fields: [
    tintField,
    tintOpacityField,
    blurField,
    saturationField,
    borderOpacityField,
    cornerRadiusField,
  ],
  id: 'css-glassmorphism-generator',
  keywords: ['glassmorphism', 'frosted glass', 'backdrop-filter', 'blur', 'glass'],
  name: 'Glassmorphism Generator',
  preview: 'css-glass',
  relatedToolIds: ['css-filter-generator', 'css-box-shadow-generator'],
  run: ({ fields: values }) => runGlass(values),
  samples: [
    sample('Classic frost', {}),
    sample('Heavy blur', { blur: '28', tintOpacity: '14' }),
    sample('Dark smoke', { saturation: '160', tint: '#0f172a', tintOpacity: '40' }),
    sample('Sharp edge', { borderOpacity: '60', cornerRadius: '4' }),
    sample('Pill panel', { blur: '20', cornerRadius: '64' }),
    sample('Rose tint', { saturation: '180', tint: '#fb7185', tintOpacity: '25' }),
  ],
};
