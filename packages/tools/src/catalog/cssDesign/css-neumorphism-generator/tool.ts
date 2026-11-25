import { ToolDefinition, ToolError, type ToolField, type ToolResult } from '@devtoolora/core';
import { generateNeumorphismCss, type NeumorphismOptions } from '@devtoolora/functions/css';
import { withToolError } from '../../../adapters/errors';
import { cssGeneratorDefaults, cssToolResult } from '../shared';
import { rangeField, rangedNumber } from '../../../adapters/fields';

const shapes: NeumorphismOptions['shape'][] = ['flat', 'pressed', 'concave', 'convex'];

const baseColorField: ToolField = {
  defaultValue: '#e0e5ec',
  id: 'baseColor',
  label: 'Base color',
  placeholder: '#e0e5ec',
  presentation: 'color',
  type: 'text',
};
const offsetField = rangeField({
  defaultValue: '10',
  id: 'offset',
  label: 'Offset',
  max: 50,
  min: 1,
  unit: 'px',
});
const blurField = rangeField({
  defaultValue: '20',
  id: 'blur',
  label: 'Blur',
  max: 100,
  min: 0,
  unit: 'px',
});
const intensityField = rangeField({
  defaultValue: '15',
  id: 'intensity',
  label: 'Intensity',
  max: 50,
  min: 1,
  unit: '%',
});
const shapeField: ToolField = {
  defaultValue: 'flat',
  id: 'shape',
  label: 'Shape',
  options: shapes.map((value) => ({
    label: value.charAt(0).toUpperCase() + value.slice(1),
    value,
  })),
  presentation: 'segmented',
  type: 'select',
};
const cornerRadiusField = rangeField({
  defaultValue: '16',
  id: 'cornerRadius',
  label: 'Corner radius',
  max: 64,
  min: 0,
  unit: 'px',
});

function runNeumorphism(values: Record<string, string>): ToolResult {
  const baseColor = values.baseColor ?? '#e0e5ec';
  const shape = shapes.find((entry) => entry === (values.shape ?? 'flat'));

  if (!shape) throw new ToolError(`Shape must be one of: ${shapes.join(', ')}.`);

  const css = withToolError(() =>
    generateNeumorphismCss({
      baseColor,
      blur: rangedNumber(blurField, values),
      cornerRadius: rangedNumber(cornerRadiusField, values),
      intensity: rangedNumber(intensityField, values),
      offset: rangedNumber(offsetField, values),
      shape,
    }),
  );

  return cssToolResult({
    css,
    fields: values,
    fileName: 'neumorphism.css',
    kind: 'neumorphism',
    summary:
      'Soft-UI rule: apply it to an element on a page with the same base color. Neumorphic edges are low contrast and are not a focus or state indicator on their own. The preview viewport and label are not exported.',
  });
}

const sample = (label: string, fields: Record<string, string>) => ({ fields, label });

export const cssNeumorphismGeneratorTool: ToolDefinition = {
  ...cssGeneratorDefaults,
  description:
    'Generate soft-UI neumorphism shadows from one base color, with flat, pressed, concave and convex shapes and a live card on your base color.',
  fields: [baseColorField, shapeField, offsetField, blurField, intensityField, cornerRadiusField],
  id: 'css-neumorphism-generator',
  keywords: ['neumorphism', 'soft ui', 'box-shadow', 'embossed', 'skeuomorphism'],
  name: 'Neumorphism Generator',
  preview: 'css-neumorphism',
  relatedToolIds: ['css-box-shadow-generator', 'css-glassmorphism-generator'],
  run: ({ fields: values }) => runNeumorphism(values),
  samples: [
    sample('Classic flat', {}),
    sample('Pressed button', { shape: 'pressed' }),
    sample('Concave dish', { shape: 'concave' }),
    sample('Convex pillow', { shape: 'convex' }),
    sample('Dark mode', { baseColor: '#2b2f36', intensity: '25', shape: 'flat' }),
    sample('Subtle and tight', { blur: '10', intensity: '8', offset: '5' }),
  ],
};
