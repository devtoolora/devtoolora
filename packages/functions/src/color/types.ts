export interface RgbColor {
  b: number;
  g: number;
  r: number;
}

export interface HslColor {
  h: number;
  l: number;
  s: number;
}

export type PaletteScheme = 'complementary' | 'analogous' | 'triadic' | 'split';

export interface PaletteFamily {
  base: string;
  name: string;
  shades: Record<'50' | '200' | '500' | '700' | '900', string>;
}
