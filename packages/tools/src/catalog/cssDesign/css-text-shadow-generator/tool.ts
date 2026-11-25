import { ToolDefinition, type ToolResult } from '@devtoolora/core';
import { generateTextShadowCss, parseTextShadowLayers } from '@devtoolora/functions/css';
import { withToolError } from '../../../adapters/errors';
import { cssGeneratorDefaults, cssToolResult } from '../shared';

const defaultLayers = '[{"x":2,"y":2,"blur":4,"color":"rgba(15, 23, 42, 0.35)"}]';

function runTextShadow(values: Record<string, string>): ToolResult {
  const css = withToolError(() =>
    generateTextShadowCss(parseTextShadowLayers(values.layers ?? defaultLayers)),
  );

  return cssToolResult({
    css,
    fields: values,
    fileName: 'text-shadow.css',
    kind: 'text-shadow',
    summary:
      'Text shadow generated. The first layer paints on top. Text color, size and weight in the preview are not exported.',
  });
}

const sample = (label: string, layers: string) => ({ fields: { layers }, label });

export const cssTextShadowGeneratorTool: ToolDefinition = {
  ...cssGeneratorDefaults,
  description:
    'Build one to five text-shadow layers with sliders, color pickers and a live headline preview on light, dark and brand surfaces.',
  fields: [{ defaultValue: defaultLayers, id: 'layers', label: 'Layers', type: 'textarea' }],
  id: 'css-text-shadow-generator',
  keywords: ['text-shadow', 'glow', 'outline', 'typography', 'shadow'],
  name: 'CSS Text Shadow Generator',
  preview: 'css-text-shadow',
  relatedToolIds: ['css-box-shadow-generator', 'css-gradient-generator'],
  run: ({ fields: values }) => runTextShadow(values),
  samples: [
    sample('Soft drop shadow', defaultLayers),
    sample('Hard offset', '[{"x":3,"y":3,"blur":0,"color":"#172033"}]'),
    sample(
      'Neon glow',
      '[{"x":0,"y":0,"blur":6,"color":"#22d3ee"},{"x":0,"y":0,"blur":18,"color":"rgba(34, 211, 238, 0.6)"}]',
    ),
    sample(
      'Embossed',
      '[{"x":0,"y":1,"blur":0,"color":"rgba(255, 255, 255, 0.8)"},{"x":0,"y":-1,"blur":0,"color":"rgba(0, 0, 0, 0.35)"}]',
    ),
    sample(
      'Outline',
      '[{"x":1,"y":1,"blur":0,"color":"#000000"},{"x":-1,"y":-1,"blur":0,"color":"#000000"},{"x":1,"y":-1,"blur":0,"color":"#000000"},{"x":-1,"y":1,"blur":0,"color":"#000000"}]',
    ),
    sample(
      'Long shadow',
      '[{"x":4,"y":4,"blur":0,"color":"#1d4ed8"},{"x":8,"y":8,"blur":0,"color":"#1e40af"},{"x":12,"y":12,"blur":0,"color":"#1e3a8a"}]',
    ),
  ],
};
