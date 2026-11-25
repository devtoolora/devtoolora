import { ToolDefinition } from '@devtoolora/core';
import * as cssFunctions from '@devtoolora/functions/css';
import { createCssTool } from '../shared';

const clip = {
  centerX: '50',
  centerY: '50',
  insetBottom: '10',
  insetLeft: '10',
  insetRight: '10',
  insetRound: '0',
  insetTop: '10',
  points: '[[50,0],[100,100],[0,100]]',
  radius: '50',
  radiusX: '50',
  radiusY: '35',
  shape: 'polygon',
  webkit: 'false',
};

export const cssClipPathGeneratorTool: ToolDefinition = createCssTool({
  id: 'css-clip-path-generator',
  keywords: ['clip-path', 'polygon', 'mask', 'shape', 'cutout'],
  name: 'CSS Clip-Path Generator',
  kind: 'clip-path',
  fields: [
    {
      id: 'shape',
      label: 'Shape',
      type: 'select',
      defaultValue: 'polygon',
      presentation: 'segmented',
      options: [
        { label: 'Polygon', value: 'polygon' },
        { label: 'Circle', value: 'circle' },
        { label: 'Ellipse', value: 'ellipse' },
        { label: 'Inset', value: 'inset' },
      ],
    },
    {
      id: 'points',
      label: 'Points',
      type: 'textarea',
      defaultValue: cssFunctions.clipShapeDefaults.points,
      visibleWhen: { field: 'shape', is: ['polygon'] },
    },
    {
      id: 'radius',
      label: 'Radius',
      type: 'number',
      defaultValue: cssFunctions.clipShapeDefaults.radius,
      visibleWhen: { field: 'shape', is: ['circle'] },
    },
    {
      id: 'radiusX',
      label: 'Radius X',
      type: 'number',
      defaultValue: cssFunctions.clipShapeDefaults.radiusX,
      visibleWhen: { field: 'shape', is: ['ellipse'] },
    },
    {
      id: 'radiusY',
      label: 'Radius Y',
      type: 'number',
      defaultValue: cssFunctions.clipShapeDefaults.radiusY,
      visibleWhen: { field: 'shape', is: ['ellipse'] },
    },
    {
      id: 'centerX',
      label: 'Center X',
      type: 'number',
      defaultValue: cssFunctions.clipShapeDefaults.centerX,
      visibleWhen: { field: 'shape', is: ['circle', 'ellipse'] },
    },
    {
      id: 'centerY',
      label: 'Center Y',
      type: 'number',
      defaultValue: cssFunctions.clipShapeDefaults.centerY,
      visibleWhen: { field: 'shape', is: ['circle', 'ellipse'] },
    },
    ...(['Top', 'Right', 'Bottom', 'Left'] as const).map((edge) => ({
      id: `inset${edge}`,
      label: `Inset ${edge.toLowerCase()}`,
      type: 'number' as const,
      defaultValue: cssFunctions.clipShapeDefaults[`inset${edge}`],
      visibleWhen: { field: 'shape', is: ['inset'] },
    })),
    {
      id: 'insetRound',
      label: 'Corner radius',
      type: 'number',
      defaultValue: cssFunctions.clipShapeDefaults.insetRound,
      visibleWhen: { field: 'shape', is: ['inset'] },
    },
    {
      id: 'webkit',
      label: 'Add -webkit- prefix',
      type: 'checkbox',
      defaultValue: 'false',
      help: 'Only for Safari 13 and older WebKit browsers.',
    },
  ],
  description:
    'Clip an element to a polygon, circle, ellipse or rounded inset with draggable points and 28 presets, then export clip-path CSS.',
  relatedToolIds: ['image-tools', 'css-triangle-generator', 'css-border-radius-generator'],
  samples: [
    { fields: { ...clip, points: '[[50,0],[100,100],[0,100]]' }, label: 'Triangle' },
    { fields: { ...clip, points: '[[20,0],[80,0],[100,100],[0,100]]' }, label: 'Trapezoid' },
    { fields: { ...clip, points: '[[25,0],[100,0],[75,100],[0,100]]' }, label: 'Parallelogram' },
    { fields: { ...clip, points: '[[50,0],[100,50],[50,100],[0,50]]' }, label: 'Rhombus' },
    {
      fields: { ...clip, points: '[[50,0],[100,38],[81,100],[19,100],[0,38]]' },
      label: 'Pentagon',
    },
    {
      fields: { ...clip, points: '[[25,0],[75,0],[100,50],[75,100],[25,100],[0,50]]' },
      label: 'Hexagon',
    },
    {
      fields: { ...clip, points: '[[50,0],[90,20],[100,60],[75,100],[25,100],[0,60],[10,20]]' },
      label: 'Heptagon',
    },
    {
      fields: {
        ...clip,
        points: '[[30,0],[70,0],[100,30],[100,70],[70,100],[30,100],[0,70],[0,30]]',
      },
      label: 'Octagon',
    },
    {
      fields: {
        ...clip,
        points: '[[50,0],[83,12],[100,43],[94,78],[68,100],[32,100],[6,78],[0,43],[17,12]]',
      },
      label: 'Nonagon',
    },
    {
      fields: {
        ...clip,
        points: '[[50,0],[80,10],[100,35],[100,70],[80,90],[50,100],[20,90],[0,70],[0,35],[20,10]]',
      },
      label: 'Decagon',
    },
    {
      fields: {
        ...clip,
        points: '[[20,0],[80,0],[100,20],[100,80],[80,100],[20,100],[0,80],[0,20]]',
      },
      label: 'Bevel',
    },
    {
      fields: {
        ...clip,
        points:
          '[[0,15],[15,15],[15,0],[85,0],[85,15],[100,15],[100,85],[85,85],[85,100],[15,100],[15,85],[0,85]]',
      },
      label: 'Rabbet',
    },
    {
      fields: { ...clip, points: '[[40,0],[40,20],[100,20],[100,80],[40,80],[40,100],[0,50]]' },
      label: 'Left arrow',
    },
    {
      fields: { ...clip, points: '[[0,25],[60,25],[60,0],[100,50],[60,100],[60,75],[0,75]]' },
      label: 'Right arrow',
    },
    {
      fields: { ...clip, points: '[[25,0],[100,0],[100,100],[25,100],[0,50]]' },
      label: 'Left point',
    },
    {
      fields: { ...clip, points: '[[0,0],[75,0],[100,50],[75,100],[0,100]]' },
      label: 'Right point',
    },
    {
      fields: { ...clip, points: '[[100,0],[75,50],[100,100],[25,100],[0,50],[25,0]]' },
      label: 'Left chevron',
    },
    {
      fields: { ...clip, points: '[[0,0],[65,0],[100,50],[65,100],[0,100],[35,50]]' },
      label: 'Chevron',
    },
    {
      fields: {
        ...clip,
        points: '[[50,0],[61,35],[98,35],[68,57],[79,91],[50,70],[21,91],[32,57],[2,35],[39,35]]',
      },
      label: 'Star',
    },
    {
      fields: {
        ...clip,
        points:
          '[[10,25],[35,25],[35,0],[65,0],[65,25],[90,25],[90,50],[65,50],[65,100],[35,100],[35,50],[10,50]]',
      },
      label: 'Cross',
    },
    {
      fields: {
        ...clip,
        points:
          '[[20,0],[0,20],[30,50],[0,80],[20,100],[50,70],[80,100],[100,80],[70,50],[100,20],[80,0],[50,30]]',
      },
      label: 'Close',
    },
    {
      fields: { ...clip, points: '[[0,0],[100,0],[100,75],[75,75],[75,100],[50,75],[0,75]]' },
      label: 'Message',
    },
    {
      fields: {
        ...clip,
        points:
          '[[0,0],[0,100],[25,100],[25,25],[75,25],[75,75],[25,75],[25,100],[100,100],[100,0]]',
      },
      label: 'Frame',
    },
    { fields: { ...clip, points: '[[0,0],[100,0],[100,100],[0,100]]' }, label: 'Rectangle' },
    { fields: { ...clip, shape: 'circle' }, label: 'Circle' },
    { fields: { ...clip, radiusX: '50', radiusY: '30', shape: 'ellipse' }, label: 'Ellipse' },
    {
      fields: {
        ...clip,
        insetBottom: '5',
        insetLeft: '5',
        insetRight: '5',
        insetTop: '5',
        shape: 'inset',
      },
      label: 'Inset',
    },
    {
      fields: { ...clip, insetRound: '24', shape: 'inset', webkit: 'true' },
      label: 'Rounded inset with -webkit- prefix',
    },
  ],
});
