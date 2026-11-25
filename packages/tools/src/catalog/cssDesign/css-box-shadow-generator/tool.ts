import { ToolDefinition } from '@devtoolora/core';
import { createCssTool } from '../shared';

export const cssBoxShadowGeneratorTool: ToolDefinition = createCssTool({
  id: 'css-box-shadow-generator',
  keywords: ['box-shadow', 'drop shadow', 'elevation', 'inset', 'shadow'],
  name: 'CSS Box Shadow Generator',
  kind: 'shadow',
  fields: [
    {
      id: 'layers',
      label: 'Layers',
      type: 'textarea',
      defaultValue:
        '[{"x":0,"y":12,"blur":28,"spread":0,"color":"rgba(15, 23, 42, 0.18)","inset":false}]',
    },
  ],
  samples: [
    {
      label: 'Soft floating card',
      fields: {
        layers:
          '[{"x":0,"y":12,"blur":28,"spread":0,"color":"rgba(15, 23, 42, 0.18)","inset":false}]',
      },
    },
    {
      label: 'Layered elevation',
      fields: {
        layers:
          '[{"x":0,"y":4,"blur":6,"spread":-1,"color":"rgba(0,0,0,0.1)","inset":false},{"x":0,"y":2,"blur":4,"spread":-2,"color":"rgba(0,0,0,0.1)","inset":false}]',
      },
    },
    {
      fields: {
        layers: '[{"x":0,"y":0,"blur":0,"spread":2,"color":"rgba(37,99,235,0.5)","inset":true}]',
      },
      label: 'Inset outline',
    },
    {
      fields: { layers: '[{"x":8,"y":8,"blur":0,"spread":0,"color":"#172033","inset":false}]' },
      label: 'Hard offset',
    },
    {
      fields: {
        layers:
          '[{"x":0,"y":0,"blur":12,"spread":2,"color":"#2563eb80","inset":false},{"x":0,"y":0,"blur":40,"spread":-4,"color":"rgba(37,99,235,0.2)","inset":false}]',
      },
      label: 'Layered glow',
    },
    {
      fields: {
        layers: '[{"x":0,"y":12,"blur":28,"spread":0,"color":"rgba(0,0,0,0)","inset":false}]',
      },
      label: 'Transparent layer',
    },
  ],
  description:
    'Build one to five editable shadow layers with a real card preview, opacity, inset mode and exact CSS export.',
  relatedToolIds: ['css-border-radius-generator', 'color-converter', 'css-keyframes-generator'],
});
