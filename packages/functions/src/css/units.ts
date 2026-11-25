export type CssUnit =
  | '%'
  | 'cm'
  | 'em'
  | 'in'
  | 'mm'
  | 'pc'
  | 'pt'
  | 'px'
  | 'Q'
  | 'rem'
  | 'vh'
  | 'vmax'
  | 'vmin'
  | 'vw';

export type CssUnitContext = {
  parentFontSize: number;
  rootFontSize: number;
  viewportHeight: number;
  viewportWidth: number;
};

export const cssUnits: CssUnit[] = [
  'px',
  'rem',
  'em',
  '%',
  'pt',
  'pc',
  'in',
  'cm',
  'mm',
  'Q',
  'vw',
  'vh',
  'vmin',
  'vmax',
];

const round4 = (value: number): number => Number(value.toFixed(4));

function pxPerUnit(unit: CssUnit, context: CssUnitContext): number {
  const { parentFontSize, rootFontSize, viewportHeight, viewportWidth } = context;
  const cm = 96 / 2.54;

  return {
    '%': parentFontSize / 100,
    cm,
    em: parentFontSize,
    in: 96,
    mm: cm / 10,
    pc: 16,
    pt: 4 / 3,
    px: 1,
    Q: cm / 40,
    rem: rootFontSize,
    vh: viewportHeight / 100,
    vmax: Math.max(viewportHeight, viewportWidth) / 100,
    vmin: Math.min(viewportHeight, viewportWidth) / 100,
    vw: viewportWidth / 100,
  }[unit];
}

export function convertCssUnit(
  value: number,
  unit: CssUnit,
  context: CssUnitContext,
): Array<{ unit: CssUnit; value: number }> {
  const px = value * pxPerUnit(unit, context);

  return cssUnits
    .filter((target) => target !== unit)
    .map((target) => ({ unit: target, value: round4(px / pxPerUnit(target, context)) }));
}
