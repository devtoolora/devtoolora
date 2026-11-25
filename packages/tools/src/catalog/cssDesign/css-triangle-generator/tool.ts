import { ToolDefinition } from '@devtoolora/core';
import { createCssTool } from '../shared';

export const cssTriangleGeneratorTool: ToolDefinition = createCssTool({
  id: 'css-triangle-generator',
  keywords: ['triangle', 'arrow', 'caret', 'tooltip arrow', 'border trick'],
  name: 'CSS Triangle Generator',
  kind: 'triangle',
  fields: [
    { id: 'size', label: 'Size', type: 'number', defaultValue: '48' },
    {
      id: 'direction',
      label: 'Direction',
      type: 'select',
      defaultValue: 'up',
      options: [
        { label: 'Up', value: 'up' },
        { label: 'Right', value: 'right' },
        { label: 'Down', value: 'down' },
        { label: 'Left', value: 'left' },
      ],
    },
    { id: 'color', label: 'Color', type: 'text', defaultValue: '#2563eb' },
  ],
  samples: [
    { label: 'Arrow up (32px blue)', fields: { size: '32', direction: 'up', color: '#2563eb' } },
    {
      label: 'Dropdown caret (16px dark)',
      fields: { size: '16', direction: 'down', color: '#1e293b' },
    },
    { fields: { color: '#2563eb', direction: 'right', size: '24' }, label: 'Right pointer' },
    { fields: { color: '#ff8a34', direction: 'left', size: '24' }, label: 'Left pointer' },
    {
      fields: { color: 'rgba(37,99,235,0.25)', direction: 'up', size: '48' },
      label: 'Transparent pointer',
    },
    { fields: { color: '#2563eb', direction: 'down', size: '200' }, label: 'Large border size' },
  ],
  description:
    'Build a border-based CSS triangle with live direction/color preview and clean CSS export.',
  relatedToolIds: ['css-clip-path-generator', 'color-converter'],
});
