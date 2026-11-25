import { cssColorHex } from './hexColor';
export type GlassOptions = {
  blur: number;
  borderOpacity: number;
  cornerRadius: number;
  saturation: number;
  tint: string;
  tintOpacity: number;
};

export type NeumorphismOptions = {
  baseColor: string;
  blur: number;
  cornerRadius: number;
  intensity: number;
  offset: number;
  shape: 'concave' | 'convex' | 'flat' | 'pressed';
};

const round2 = (value: number): number => Number(value.toFixed(2));

function channels(value: string, label: string): number[] {
  const hex = cssColorHex(value, label);

  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

const toHex = (values: number[]): string =>
  `#${values.map((value) => value.toString(16).padStart(2, '0')).join('')}`;

export function generateGlassCss(options: GlassOptions): string {
  const [red, green, blue] = channels(options.tint, 'Tint');
  const filter = `blur(${round2(options.blur)}px) saturate(${round2(options.saturation)}%)`;

  return [
    '.glass {',
    `  background: rgba(${red}, ${green}, ${blue}, ${round2(options.tintOpacity / 100)});`,
    `  -webkit-backdrop-filter: ${filter};`,
    `  backdrop-filter: ${filter};`,
    `  border: 1px solid rgba(255, 255, 255, ${round2(options.borderOpacity / 100)});`,
    `  border-radius: ${round2(options.cornerRadius)}px;`,
    '}',
  ].join('\n');
}

export function neumorphismColors(
  base: string,
  intensity: number,
): { dark: string; light: string } {
  const amount = intensity / 100;
  const values = channels(base, 'Base color');

  return {
    dark: toHex(values.map((value) => Math.round(value * (1 - amount)))),
    light: toHex(values.map((value) => Math.min(255, Math.round(value * (1 + amount))))),
  };
}

export function generateNeumorphismCss(options: NeumorphismOptions): string {
  const { dark, light } = neumorphismColors(options.baseColor, options.intensity);
  const soft = neumorphismColors(options.baseColor, options.intensity / 2);
  const { shape } = options;
  const inset = shape === 'pressed' ? 'inset ' : '';
  const offset = `${round2(options.offset)}px`;
  const blur = `${round2(options.blur)}px`;
  const [from, to] = shape === 'convex' ? [soft.light, soft.dark] : [soft.dark, soft.light];
  const background =
    shape === 'concave' || shape === 'convex'
      ? `linear-gradient(145deg, ${from}, ${to})`
      : cssColorHex(options.baseColor, 'Base color');

  return [
    '.neumorphism {',
    `  background: ${background};`,
    `  box-shadow: ${inset}${offset} ${offset} ${blur} ${dark}, ${inset}-${offset} -${offset} ${blur} ${light};`,
    `  border-radius: ${round2(options.cornerRadius)}px;`,
    '}',
  ].join('\n');
}
