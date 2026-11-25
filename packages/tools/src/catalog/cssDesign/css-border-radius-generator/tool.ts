import { ToolDefinition } from '@devtoolora/core';
import { createCssTool } from '../shared';

const radius = {
  bottomLeft: '16',
  bottomRight: '16',
  linked: 'true',
  topLeft: '16',
  topRight: '16',
};

export const cssBorderRadiusGeneratorTool: ToolDefinition = createCssTool({
  id: 'css-border-radius-generator',
  keywords: ['border-radius', 'rounded corners', 'corners', 'pill', 'blob'],
  name: 'CSS Border Radius Generator',
  kind: 'radius',
  fields: [
    { id: 'linked', label: 'Link corners', type: 'checkbox', defaultValue: 'true' },
    { id: 'topLeft', label: 'Top left', type: 'number', defaultValue: '16' },
    { id: 'topRight', label: 'Top right', type: 'number', defaultValue: '16' },
    { id: 'bottomRight', label: 'Bottom right', type: 'number', defaultValue: '16' },
    { id: 'bottomLeft', label: 'Bottom left', type: 'number', defaultValue: '16' },
  ],
  samples: [
    {
      label: 'Smooth card (16px)',
      fields: {
        linked: 'true',
        topLeft: '16',
        topRight: '16',
        bottomRight: '16',
        bottomLeft: '16',
      },
    },
    {
      label: 'Asymmetric leaf (24px / 8px)',
      fields: {
        linked: 'false',
        topLeft: '24',
        topRight: '8',
        bottomRight: '24',
        bottomLeft: '8',
      },
    },
    {
      fields: { ...radius, bottomLeft: '0', bottomRight: '0', topLeft: '0', topRight: '0' },
      label: 'Square corners',
    },
    {
      fields: {
        ...radius,
        bottomLeft: '0',
        bottomRight: '0',
        linked: 'false',
        topLeft: '32',
        topRight: '32',
      },
      label: 'Top corners',
    },
    {
      fields: { ...radius, bottomLeft: '200', bottomRight: '200', topLeft: '200', topRight: '200' },
      label: 'Capsule-like card',
    },
    {
      fields: {
        ...radius,
        bottomLeft: '64',
        bottomRight: '8',
        linked: 'false',
        topLeft: '0',
        topRight: '32',
      },
      label: 'Four distinct corners',
    },
  ],
  description:
    'Adjust linked or independent corners on a real card and export the exact four-corner border-radius rule.',
  relatedToolIds: ['css-box-shadow-generator', 'css-clip-path-generator'],
});
