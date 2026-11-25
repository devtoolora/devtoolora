export type FilterFunction =
  | 'blur'
  | 'brightness'
  | 'contrast'
  | 'grayscale'
  | 'hue-rotate'
  | 'invert'
  | 'opacity'
  | 'saturate'
  | 'sepia';

type FilterSpec = {
  id: FilterFunction;
  identity: number;
  max: number;
  min: number;
  unit: 'deg' | 'px' | '%';
};

const spec = (
  id: FilterFunction,
  unit: FilterSpec['unit'],
  max: number,
  identity = 0,
): FilterSpec => ({ id, identity, max, min: 0, unit });

export const filterFunctions: ReadonlyArray<FilterSpec> = [
  spec('blur', 'px', 50),
  spec('brightness', '%', 300, 100),
  spec('contrast', '%', 300, 100),
  spec('grayscale', '%', 100),
  spec('hue-rotate', 'deg', 360),
  spec('invert', '%', 100),
  spec('opacity', '%', 100, 100),
  spec('saturate', '%', 300, 100),
  spec('sepia', '%', 100),
];

export function generateFilterCss(
  values: Record<FilterFunction, number>,
  target: 'backdrop-filter' | 'filter',
): string {
  const parts = filterFunctions
    .filter((entry) => values[entry.id] !== entry.identity)
    .map((entry) => `${entry.id}(${Number(values[entry.id].toFixed(2))}${entry.unit})`);
  const value = parts.length > 0 ? parts.join(' ') : 'none';

  const declarations =
    target === 'filter'
      ? [`filter: ${value};`]
      : [`-webkit-backdrop-filter: ${value};`, `backdrop-filter: ${value};`];

  return `.filter {\n${declarations.map((line) => `  ${line}`).join('\n')}\n}`;
}
