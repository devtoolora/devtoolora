import { shadowColor, type ShadowLayer } from './shadow';
import { bounded, cssError, integer, oneOf, strictChoices } from './validators';

export function generateGridCss(options: {
  alignContent: string;
  alignItems: string;
  autoFlow: string;
  columnGap: number;
  columns: number;
  justifyContent: string;
  justifyItems: string;
  minTrack: number;
  rowGap: number;
  rows: number;
}): string {
  if (
    ![options.columns, options.rows, options.columnGap, options.rowGap, options.minTrack].every(
      Number.isInteger,
    )
  )
    throw cssError('Grid counts and pixel sizes must be whole numbers.');

  strictChoices(options, {
    alignContent: ['start', 'center', 'end', 'space-between', 'space-around', 'stretch'],
    alignItems: ['start', 'center', 'end', 'stretch'],
    autoFlow: ['row', 'column', 'row dense', 'column dense'],
    justifyContent: ['start', 'center', 'end', 'space-between', 'space-around', 'stretch'],
    justifyItems: ['start', 'center', 'end', 'stretch'],
  });

  return `.layout {\n  display: grid;\n  grid-template-columns: repeat(${integer(options.columns, 'Columns', 1, 12)}, minmax(${integer(options.minTrack, 'Minimum track', 40, 600)}px, 1fr));\n  grid-template-rows: repeat(${integer(options.rows, 'Rows', 1, 8)}, minmax(80px, auto));\n  column-gap: ${integer(options.columnGap, 'Column gap', 0, 96)}px;\n  row-gap: ${integer(options.rowGap, 'Row gap', 0, 96)}px;\n  grid-auto-flow: ${oneOf(options.autoFlow, ['row', 'column', 'row dense', 'column dense'], 'row')};\n  justify-items: ${oneOf(options.justifyItems, ['start', 'center', 'end', 'stretch'], 'stretch')};\n  align-items: ${oneOf(options.alignItems, ['start', 'center', 'end', 'stretch'], 'stretch')};\n  justify-content: ${oneOf(options.justifyContent, ['start', 'center', 'end', 'space-between', 'space-around', 'stretch'], 'stretch')};\n  align-content: ${oneOf(options.alignContent, ['start', 'center', 'end', 'space-between', 'space-around', 'stretch'], 'stretch')};\n}`;
}

export function generateFlexboxCss(options: {
  align: string;
  alignContent: string;
  basis: number;
  direction: string;
  gap: number;
  grow: number;
  justify: string;
  order: number;
  shrink: number;
  wrap: string;
}): string {
  if (![options.gap, options.basis, options.order].every(Number.isInteger))
    throw cssError('Flex gap, basis and order must be whole numbers.');

  strictChoices(options, {
    align: ['flex-start', 'center', 'flex-end', 'stretch'],
    alignContent: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'stretch'],
    direction: ['row', 'column', 'row-reverse', 'column-reverse'],
    justify: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around'],
    wrap: ['nowrap', 'wrap', 'wrap-reverse'],
  });

  return `.layout {\n  display: flex;\n  flex-direction: ${options.direction};\n  flex-wrap: ${options.wrap};\n  justify-content: ${options.justify};\n  align-items: ${options.align};\n  align-content: ${options.alignContent};\n  gap: ${integer(options.gap, 'Gap', 0, 96)}px;\n}\n\n.layout > .item--featured {\n  flex: ${bounded(options.grow, 'Featured item grow', 0, 12)} ${bounded(options.shrink, 'Featured item shrink', 0, 12)} ${integer(options.basis, 'Featured item basis', 0, 800)}px;\n  order: ${integer(options.order, 'Featured item order', -12, 12)};\n}`;
}

export function generateShadowCss(layers: ShadowLayer[]): string {
  if (!Array.isArray(layers) || layers.length < 1 || layers.length > 5)
    throw cssError('Shadow layers must contain between one and five valid layers.');

  const values = layers.map((layer) => {
    if (typeof layer.inset !== 'boolean') throw cssError('Shadow inset must be a boolean.');

    shadowColor(layer.color);
    const color = layer.color.trim();

    return `${layer.inset ? 'inset ' : ''}${bounded(layer.x, 'Shadow horizontal offset', -200, 200)}px ${bounded(layer.y, 'Shadow vertical offset', -200, 200)}px ${bounded(layer.blur, 'Shadow blur', 0, 300)}px ${bounded(layer.spread, 'Shadow spread', -200, 200)}px ${color}`;
  });

  return `.element {\n  box-shadow: ${values.join(',\n    ')};\n}`;
}

export function generateRadiusCss(
  topLeft: number,
  topRight: number,
  bottomRight: number,
  bottomLeft: number,
): string {
  if (![topLeft, topRight, bottomRight, bottomLeft].every(Number.isInteger))
    throw cssError('Corner radii must be whole pixel values.');

  return `.element {\n  border-radius: ${integer(topLeft, 'Top left radius', 0, 200)}px ${integer(topRight, 'Top right radius', 0, 200)}px ${integer(bottomRight, 'Bottom right radius', 0, 200)}px ${integer(bottomLeft, 'Bottom left radius', 0, 200)}px;\n}`;
}

export function generateTriangleCss(
  sizeValue: number,
  directionValue: string,
  colorValue: string,
): string {
  if (!Number.isInteger(sizeValue))
    throw cssError('Triangle border size must be a whole pixel value.');

  const size = integer(sizeValue, 'Size', 1, 200);

  try {
    shadowColor(colorValue);
  } catch {
    throw cssError(
      'Triangle color must be valid hex or comma-form rgb()/rgba(), with bounded channels and alpha.',
    );
  }

  const color = colorValue.trim();

  if (!['up', 'right', 'down', 'left'].includes(directionValue))
    throw cssError(
      'Choose Up, Right, Down or Left. Unknown directions are not replaced with defaults.',
    );

  const direction = directionValue;
  const border = `${size}px solid transparent`;
  const colored = `${size}px solid ${color}`;
  const sides: Record<string, string> = {
    up: `border-left: ${border};\n  border-right: ${border};\n  border-bottom: ${colored};`,
    right: `border-top: ${border};\n  border-bottom: ${border};\n  border-left: ${colored};`,
    down: `border-left: ${border};\n  border-right: ${border};\n  border-top: ${colored};`,
    left: `border-top: ${border};\n  border-bottom: ${border};\n  border-right: ${colored};`,
  };

  return `.triangle {\n  width: 0;\n  height: 0;\n  ${sides[direction]}\n}`;
}
