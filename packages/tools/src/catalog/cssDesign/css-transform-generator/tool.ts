import { ToolDefinition, type ToolField, type ToolResult } from '@devtoolora/core';
import {
  generateTransformCss,
  transformOrigins,
  type TransformValues,
} from '@devtoolora/functions/css';
import { withToolError } from '../../../adapters/errors';
import { cssGeneratorDefaults, cssToolResult } from '../shared';
import { rangeField, rangedNumber } from '../../../adapters/fields';

type NumericKey = Exclude<keyof TransformValues, 'origin'>;

const numeric = (
  id: NumericKey,
  label: string,
  min: number,
  max: number,
  unit: string,
  defaultValue = '0',
): ToolField => rangeField({ defaultValue, id, label, max, min, unit });

const numericFields: ToolField[] = [
  numeric('translateX', 'Translate X', -200, 200, 'px'),
  numeric('translateY', 'Translate Y', -200, 200, 'px'),
  numeric('rotate', 'Rotate', -360, 360, 'deg'),
  numeric('rotateX', 'Rotate X', -180, 180, 'deg'),
  numeric('rotateY', 'Rotate Y', -180, 180, 'deg'),
  numeric('scaleX', 'Scale X', 0, 300, '%', '100'),
  numeric('scaleY', 'Scale Y', 0, 300, '%', '100'),
  numeric('skewX', 'Skew X', -80, 80, 'deg'),
  numeric('skewY', 'Skew Y', -80, 80, 'deg'),
  numeric('perspective', 'Perspective (0 = none)', 0, 2000, 'px'),
];

const originField: ToolField = {
  defaultValue: 'center',
  id: 'origin',
  label: 'Transform origin',
  options: transformOrigins.map((value) => ({ label: value, value })),
  type: 'select',
};

function runTransform(values: Record<string, string>): ToolResult {
  const numbers = Object.fromEntries(
    numericFields.map((field) => [field.id, rangedNumber(field, values)]),
  ) as Record<NumericKey, number>;
  const css = withToolError(() =>
    generateTransformCss({ ...numbers, origin: values.origin ?? 'center' }),
  );

  return cssToolResult({
    css,
    fields: values,
    fileName: 'transform.css',
    kind: 'transform',
    summary:
      'Functions at identity are omitted and the order is fixed: perspective, translate, rotate, rotateX, rotateY, scale, skew. transform-origin is printed only when it is not center. The preview card and its dashed outline are not exported.',
  });
}

const sample = (label: string, fields: Record<string, string>) => ({ fields, label });

export const cssTransformGeneratorTool: ToolDefinition = {
  ...cssGeneratorDefaults,
  description:
    'Compose translate, rotate, 3D rotation, scale, skew and perspective with sliders and a transform-origin picker, and compare the transformed card with its original position.',
  fields: [...numericFields, originField],
  id: 'css-transform-generator',
  keywords: ['transform', 'rotate', 'scale', 'skew', 'translate', 'perspective', '3d'],
  name: 'CSS Transform Generator',
  preview: 'css-transform',
  relatedToolIds: ['css-keyframes-generator', 'css-border-radius-generator'],
  run: ({ fields: values }) => runTransform(values),
  samples: [
    sample('Tilt and grow', { rotate: '15', scaleX: '110', scaleY: '110' }),
    sample('3D card flip', { perspective: '800', rotateY: '35' }),
    sample('Lean back', { perspective: '900', rotateX: '40' }),
    sample('Italic slant', { skewX: '-12' }),
    sample('Nudge from corner', {
      origin: 'top left',
      rotate: '-8',
      translateX: '24',
      translateY: '12',
    }),
    sample('Squash and stretch', { scaleX: '130', scaleY: '70' }),
  ],
};
