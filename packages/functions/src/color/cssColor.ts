import { FunctionError } from '../errors';
import { contrastRatio } from './contrast';
import { mapToGamut } from './gamut';
import {
  clamp,
  composite,
  d50ToD65,
  d65ToD50,
  degrees,
  hslToSrgb,
  labToXyz,
  linearToOklab,
  linearToXyzD65,
  multiply,
  oklabToLinear,
  polar,
  round,
  srgbToHsl,
  toLinear,
  trim,
  xyzD65ToLinear,
  xyzToLab,
  type Vector,
} from './cssColorSpace';

/**
 * An sRGB color with 0–1 channels; `gamutMapped` marks input that had to be brought into sRGB, and
 * `unmappedLinear` keeps its linear-sRGB value from before that, because CSS mixes the written one.
 */
export type CssColor = {
  alpha: number;
  b: number;
  g: number;
  gamutMapped: boolean;
  r: number;
  source: string;
  unmappedLinear?: Vector;
};
export type CssColorSyntax = 'commas' | 'spaces';
export type CssColorReport = {
  cmyk: string;
  contrast: { textColor: '#000000' | '#ffffff'; onBlack: number; onWhite: number };
  detected: string;
  hex: string;
  hsl: string;
  hwb: string;
  lab: string;
  lch: string;
  name: string;
  notes?: string[];
  oklab: string;
  oklch: string;
  rgb: string;
};

const namedHex =
  'aliceblue:f0f8ff,antiquewhite:faebd7,aqua:00ffff,aquamarine:7fffd4,azure:f0ffff,beige:f5f5dc,bisque:ffe4c4,black:000000,blanchedalmond:ffebcd,blue:0000ff,blueviolet:8a2be2,brown:a52a2a,burlywood:deb887,cadetblue:5f9ea0,chartreuse:7fff00,chocolate:d2691e,coral:ff7f50,cornflowerblue:6495ed,cornsilk:fff8dc,crimson:dc143c,cyan:00ffff,darkblue:00008b,darkcyan:008b8b,darkgoldenrod:b8860b,darkgray:a9a9a9,darkgreen:006400,darkgrey:a9a9a9,darkkhaki:bdb76b,darkmagenta:8b008b,darkolivegreen:556b2f,darkorange:ff8c00,darkorchid:9932cc,darkred:8b0000,darksalmon:e9967a,darkseagreen:8fbc8f,darkslateblue:483d8b,darkslategray:2f4f4f,darkslategrey:2f4f4f,darkturquoise:00ced1,darkviolet:9400d3,deeppink:ff1493,deepskyblue:00bfff,dimgray:696969,dimgrey:696969,dodgerblue:1e90ff,firebrick:b22222,floralwhite:fffaf0,forestgreen:228b22,fuchsia:ff00ff,gainsboro:dcdcdc,ghostwhite:f8f8ff,gold:ffd700,goldenrod:daa520,gray:808080,green:008000,greenyellow:adff2f,grey:808080,honeydew:f0fff0,hotpink:ff69b4,indianred:cd5c5c,indigo:4b0082,ivory:fffff0,khaki:f0e68c,lavender:e6e6fa,lavenderblush:fff0f5,lawngreen:7cfc00,lemonchiffon:fffacd,lightblue:add8e6,lightcoral:f08080,lightcyan:e0ffff,lightgoldenrodyellow:fafad2,lightgray:d3d3d3,lightgreen:90ee90,lightgrey:d3d3d3,lightpink:ffb6c1,lightsalmon:ffa07a,lightseagreen:20b2aa,lightskyblue:87cefa,lightslategray:778899,lightslategrey:778899,lightsteelblue:b0c4de,lightyellow:ffffe0,lime:00ff00,limegreen:32cd32,linen:faf0e6,magenta:ff00ff,maroon:800000,mediumaquamarine:66cdaa,mediumblue:0000cd,mediumorchid:ba55d3,mediumpurple:9370db,mediumseagreen:3cb371,mediumslateblue:7b68ee,mediumspringgreen:00fa9a,mediumturquoise:48d1cc,mediumvioletred:c71585,midnightblue:191970,mintcream:f5fffa,mistyrose:ffe4e1,moccasin:ffe4b5,navajowhite:ffdead,navy:000080,oldlace:fdf5e6,olive:808000,olivedrab:6b8e23,orange:ffa500,orangered:ff4500,orchid:da70d6,palegoldenrod:eee8aa,palegreen:98fb98,paleturquoise:afeeee,palevioletred:db7093,papayawhip:ffefd5,peachpuff:ffdab9,peru:cd853f,pink:ffc0cb,plum:dda0dd,powderblue:b0e0e6,purple:800080,rebeccapurple:663399,red:ff0000,rosybrown:bc8f8f,royalblue:4169e1,saddlebrown:8b4513,salmon:fa8072,sandybrown:f4a460,seagreen:2e8b57,seashell:fff5ee,sienna:a0522d,silver:c0c0c0,skyblue:87ceeb,slateblue:6a5acd,slategray:708090,slategrey:708090,snow:fffafa,springgreen:00ff7f,steelblue:4682b4,tan:d2b48c,teal:008080,thistle:d8bfd8,tomato:ff6347,turquoise:40e0d0,violet:ee82ee,wheat:f5deb3,white:ffffff,whitesmoke:f5f5f5,yellow:ffff00,yellowgreen:9acd32';

export const namedColors = new Map(
  namedHex.split(',').map((entry) => entry.split(':') as [string, string]),
);

export function parseCssColor(value: string): CssColor {
  const input = value.trim();

  if (!input)
    throw colorError(
      'REQUIRED_COLOR',
      'Enter a color, such as #3b82f6, rgb(59 130 246) or oklch(62% 0.19 260).',
    );
  if (input.length > 200)
    throw colorError('INVALID_COLOR', 'Color input must be at most 200 characters.');

  const lower = input.toLowerCase();

  if (lower === 'transparent')
    return { alpha: 0, b: 0, g: 0, gamutMapped: false, r: 0, source: 'transparent' };
  if (lower === 'currentcolor' || lower === 'inherit' || lower === 'initial')
    throw colorError(
      'INVALID_COLOR',
      `${input} depends on where it is used, so it has no fixed value.`,
    );

  const named = namedColors.get(lower);

  if (named) return { ...hexColor(named), source: `named color ${lower}` };

  const hex = lower.match(/^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);

  if (hex) return { ...hexColor(hex[1]!), source: 'hex' };

  const fn = lower.match(/^([a-z]+)\(\s*(.*?)\s*\)$/s);

  if (!fn)
    throw colorError(
      'INVALID_COLOR',
      `"${input}" is not a CSS color. Use hex, rgb(), hsl(), hwb(), lab(), lch(), oklab(), oklch() or a color name.`,
    );

  const name = fn[1]!;
  const body = fn[2]!;

  if (!['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch'].includes(name))
    throw colorError(
      'INVALID_COLOR',
      `${name}() is not supported. Use hex, rgb(), hsl(), hwb(), lab(), lch(), oklab(), oklch() or a color name.`,
    );

  return parseColorFunction(name, body);
}

/** For color text printed into CSS as typed: parseCssColor also takes bare hex, invalid in CSS. */
export function parsePrintedCssColor(value: string): CssColor {
  const text = value.trim();

  if (/^[0-9a-f]+$/i.test(text))
    throw colorError('INVALID_COLOR', `A hex color needs its #: "${text}" is not valid CSS.`);

  return parseCssColor(text);
}

type ColorArguments = {
  alpha: number;
  channel: (index: 0 | 1 | 2, percent: number, label: string) => number;
  channels: [string, string, string];
};

function parseColorFunction(name: string, body: string): CssColor {
  const { alpha, channels } = splitArguments(body, name);
  const args: ColorArguments = {
    alpha: alpha === undefined ? 1 : clamp(numberValue(alpha, 1, `${name}() alpha`), 0, 1),
    channel: (index, percent, label) => numberValue(channels[index], percent, `${name}() ${label}`),
    channels,
  };

  if (name === 'rgb' || name === 'rgba') return parseRgbFunction(args);
  if (name === 'hsl' || name === 'hsla') return parseHslFunction(args);
  if (name === 'hwb') return parseHwbFunction(args);
  if (name === 'lab' || name === 'lch') return parseLabFunction(name, args);
  if (name === 'oklab' || name === 'oklch') return parseOklabFunction(name, args);

  throw colorError(
    'INVALID_COLOR',
    `${name}() is not supported. Use hex, rgb(), hsl(), hwb(), lab(), lch(), oklab(), oklch() or a color name.`,
  );
}

function parseRgbFunction({ alpha, channel }: ColorArguments): CssColor {
  const r = channel(0, 255, 'red') / 255;
  const g = channel(1, 255, 'green') / 255;
  const b = channel(2, 255, 'blue') / 255;

  return {
    alpha,
    b: clamp(b, 0, 1),
    g: clamp(g, 0, 1),
    gamutMapped: [r, g, b].some((item) => item < 0 || item > 1),
    r: clamp(r, 0, 1),
    source: 'rgb()',
  };
}

function parseHslFunction({ alpha, channel, channels }: ColorArguments): CssColor {
  const [r, g, b] = hslToSrgb(
    hue(channels[0]),
    clamp(channel(1, 100, 'saturation'), 0, 100) / 100,
    clamp(channel(2, 100, 'lightness'), 0, 100) / 100,
  );

  return { alpha, b, g, gamutMapped: false, r, source: 'hsl()' };
}

function parseHwbFunction({ alpha, channel, channels }: ColorArguments): CssColor {
  let white = clamp(channel(1, 100, 'whiteness'), 0, 100) / 100;
  let black = clamp(channel(2, 100, 'blackness'), 0, 100) / 100;

  if (white + black > 1) {
    const total = white + black;

    white /= total;
    black /= total;
  }

  const [red, green, blue] = hslToSrgb(hue(channels[0]), 1, 0.5);
  const tint = (item: number) => item * (1 - white - black) + white;

  return {
    alpha,
    b: tint(blue),
    g: tint(green),
    gamutMapped: false,
    r: tint(red),
    source: 'hwb()',
  };
}

function parseLabFunction(name: 'lab' | 'lch', { alpha, channel, channels }: ColorArguments) {
  const lightness = clamp(channel(0, 100, 'lightness'), 0, 100);
  const [a, b] =
    name === 'lab'
      ? [channel(1, 125, 'a'), channel(2, 125, 'b')]
      : polar(Math.max(0, channel(1, 150, 'chroma')), hue(channels[2]));
  const linear = multiply(xyzD65ToLinear, multiply(d50ToD65, labToXyz([lightness, a, b])));

  return mapToGamut(linear, alpha, `${name}()`);
}

function parseOklabFunction(name: 'oklab' | 'oklch', { alpha, channel, channels }: ColorArguments) {
  const lightness = clamp(channel(0, 1, 'lightness'), 0, 1);
  const [a, b] =
    name === 'oklab'
      ? [channel(1, 0.4, 'a'), channel(2, 0.4, 'b')]
      : polar(Math.max(0, channel(1, 0.4, 'chroma')), hue(channels[2]));

  return mapToGamut(oklabToLinear([lightness, a, b]), alpha, `${name}()`);
}

function cmykPercentages(color: CssColor) {
  const k = 1 - Math.max(color.r, color.g, color.b);

  return k >= 1
    ? [0, 0, 0, 100]
    : [
        (1 - color.r - k) / (1 - k),
        (1 - color.g - k) / (1 - k),
        (1 - color.b - k) / (1 - k),
        k,
      ].map((value) => value * 100);
}

function hexText(rounded: Vector, alpha: number) {
  const channels = rounded.map((channel) => channel.toString(16).padStart(2, '0')).join('');

  return `#${channels}${
    alpha < 1
      ? Math.round(alpha * 255)
          .toString(16)
          .padStart(2, '0')
      : ''
  }`;
}

function contrastReport(rounded: Vector, alpha: number): CssColorReport['contrast'] {
  const onWhite = composite(rounded, alpha, 255);
  const onBlack = composite(rounded, alpha, 0);
  const whiteRatio = round(contrastRatio(onWhite, { b: 255, g: 255, r: 255 }), 2);
  const blackRatio = round(contrastRatio(onBlack, { b: 0, g: 0, r: 0 }), 2);

  return {
    onBlack: blackRatio,
    onWhite: whiteRatio,
    textColor: blackRatio >= whiteRatio ? '#000000' : '#ffffff',
  };
}

export function formatCssColor(color: CssColor, syntax: CssColorSyntax = 'commas'): CssColorReport {
  const rounded: Vector = [
    Math.round(color.r * 255),
    Math.round(color.g * 255),
    Math.round(color.b * 255),
  ];
  const hasAlpha = color.alpha < 1;
  const alphaText = trim(color.alpha, 3);
  const modernAlpha = hasAlpha ? ` / ${alphaText}` : '';
  const [h, s, l] = srgbToHsl(color.r, color.g, color.b);
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  const linear = [color.r, color.g, color.b].map(toLinear) as Vector;
  const [okL, okA, okB] = linearToOklab(linear);
  const [labL, labA, labB] = xyzToLab(multiply(d65ToD50, multiply(linearToXyzD65, linear)));
  const okChroma = Math.hypot(okA, okB);
  const labChroma = Math.hypot(labA, labB);
  const hueText = (value: number, chroma: number, threshold: number) =>
    chroma < threshold ? 'none' : trim(value, 2);
  const cmyk = cmykPercentages(color);
  const hex = hexText(rounded, color.alpha);
  const contrast = contrastReport(rounded, color.alpha);
  const notes: string[] = [];

  if (color.gamutMapped)
    notes.push(
      'The input is outside the sRGB gamut, so it was mapped into sRGB by reducing chroma; hex and rgb() show the mapped color.',
    );
  if (hasAlpha)
    notes.push('Contrast ratios composite the transparent color over white or black first.');

  return {
    detected: color.source,
    hex,
    rgb:
      syntax === 'commas'
        ? `${hasAlpha ? 'rgba' : 'rgb'}(${rounded.join(', ')}${hasAlpha ? `, ${alphaText}` : ''})`
        : `rgb(${rounded.join(' ')}${modernAlpha})`,
    hsl:
      syntax === 'commas'
        ? `${hasAlpha ? 'hsla' : 'hsl'}(${trim(h, 1)}, ${trim(s * 100, 1)}%, ${trim(l * 100, 1)}%${hasAlpha ? `, ${alphaText}` : ''})`
        : `hsl(${trim(h, 1)} ${trim(s * 100, 1)}% ${trim(l * 100, 1)}%${modernAlpha})`,
    hwb: `hwb(${trim(h, 1)} ${trim(min * 100, 1)}% ${trim((1 - max) * 100, 1)}%${modernAlpha})`,
    oklch: `oklch(${trim(okL * 100, 2)}% ${trim(okChroma, 4)} ${hueText(degrees(okA, okB), okChroma, 0.0002)}${modernAlpha})`,
    oklab: `oklab(${trim(okL * 100, 2)}% ${trim(okA, 4)} ${trim(okB, 4)}${modernAlpha})`,
    lch: `lch(${trim(labL, 2)} ${trim(labChroma, 2)} ${hueText(degrees(labA, labB), labChroma, 0.02)}${modernAlpha})`,
    lab: `lab(${trim(labL, 2)} ${trim(labA, 2)} ${trim(labB, 2)}${modernAlpha})`,
    cmyk: `cmyk(${cmyk.map((value) => `${trim(value, 1)}%`).join(', ')})`,
    name: nearestName([okL, okA, okB], hex.slice(1, 7)),
    contrast,
    ...(notes.length > 0 ? { notes } : {}),
  };
}

export function cssColorSwatchSvg(color: CssColor, report: CssColorReport): string {
  const fill = `rgb(${[color.r, color.g, color.b].map((channel) => Math.round(channel * 255)).join(' ')} / ${trim(color.alpha, 3)})`;
  const text = report.contrast.textColor;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="160" viewBox="0 0 480 160"><defs><pattern id="c" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#ffffff"/><rect width="8" height="8" fill="#d0d7de"/><rect x="8" y="8" width="8" height="8" fill="#d0d7de"/></pattern><clipPath id="r"><rect width="480" height="160" rx="16"/></clipPath></defs><g clip-path="url(#r)"><rect width="480" height="160" fill="url(#c)"/><rect width="480" height="160" fill="${fill}"/></g><text x="24" y="70" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="${text}">${report.hex}</text><text x="24" y="104" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="${text}">${report.oklch}</text><text x="24" y="132" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="${text}">${report.contrast.onWhite}:1 on white · ${report.contrast.onBlack}:1 on black</text></svg>`;
}

function splitArguments(
  body: string,
  name: string,
): { alpha?: string; channels: [string, string, string] } {
  const [main = '', alpha, extra] = body.split('/').map((part) => part.trim());

  if (extra !== undefined)
    throw colorError('INVALID_COLOR', `${name}() has more than one / separator.`);

  if (main.includes(',')) {
    if (alpha !== undefined)
      throw colorError('INVALID_COLOR', `${name}() cannot mix commas with a / alpha separator.`);

    const parts = main.split(',').map((part) => part.trim());

    if (parts.length !== 3 && parts.length !== 4)
      throw colorError('INVALID_COLOR', `${name}() needs three channels and an optional alpha.`);
    if (!['rgb', 'rgba', 'hsl', 'hsla'].includes(name))
      throw colorError('INVALID_COLOR', `${name}() uses spaces between channels, not commas.`);

    checkLegacyChannels(parts, name);

    return { alpha: parts[3], channels: threeChannels(parts.slice(0, 3), name) };
  }

  const channels = main.split(/\s+/).filter(Boolean);

  if (channels.length !== 3)
    throw colorError(
      'INVALID_COLOR',
      `${name}() needs exactly three channels${alpha === undefined ? ', with an optional / alpha' : ''}.`,
    );

  return { alpha, channels: threeChannels(channels, name) };
}

/** CSS Color 4 legacy syntax is stricter than the space form, and browsers drop what breaks it. */
function checkLegacyChannels(parts: string[], name: string): void {
  if (parts.includes('none'))
    throw colorError('INVALID_COLOR', `${name}() cannot use none with commas; use spaces.`);

  const percents = parts.slice(0, 3).map((part) => part.endsWith('%'));

  if (name.startsWith('hsl')) {
    if (!percents[1] || !percents[2])
      throw colorError(
        'INVALID_COLOR',
        `${name}() with commas needs % on saturation and lightness, such as hsl(120, 50%, 50%).`,
      );
  } else if (percents.includes(true) && percents.includes(false))
    throw colorError('INVALID_COLOR', `${name}() with commas cannot mix numbers and percentages.`);
}

function threeChannels(parts: string[], name: string): [string, string, string] {
  const [first, second, third] = parts;

  if (first === undefined || second === undefined || third === undefined)
    throw colorError('INVALID_COLOR', `${name}() needs three channels and an optional alpha.`);

  return [first, second, third];
}

function numberValue(text: string, percentScale: number, label: string): number {
  if (text === 'none') return 0;

  const match = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(%?)$/);

  if (!match)
    throw colorError('INVALID_COLOR', `${label} "${text}" is not a number or percentage.`);

  return match[2] ? (Number(match[1]) / 100) * percentScale : Number(match[1]);
}

const hueUnitToDegrees: Record<string, (value: number) => number> = {
  deg: (value) => value,
  grad: (value) => value * 0.9,
  rad: (value) => (value * 180) / Math.PI,
  turn: (value) => value * 360,
};

function hue(text: string): number {
  if (text === 'none') return 0;

  const match = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(deg|rad|grad|turn)?$/);

  if (!match)
    throw colorError(
      'INVALID_COLOR',
      `Hue "${text}" must be a number with an optional deg, rad, grad or turn unit.`,
    );

  const value = Number(match[1]);
  const degreesValue = hueUnitToDegrees[match[2] ?? 'deg']!(value);

  return ((degreesValue % 360) + 360) % 360;
}

function hexColor(hex: string): Omit<CssColor, 'source'> {
  const full = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join('') : hex;
  const channel = (offset: number) =>
    Number.parseInt(full.slice(offset, offset + 2) || 'ff', 16) / 255;

  return { alpha: channel(6), b: channel(4), g: channel(2), gamutMapped: false, r: channel(0) };
}

function nearestName(oklab: Vector, hex: string): string {
  let best = '';
  let distance = Number.POSITIVE_INFINITY;

  for (const [name, value] of namedColors) {
    if (value === hex) return name;

    const color = hexColor(value);
    const candidate = linearToOklab([color.r, color.g, color.b].map(toLinear) as Vector);
    const delta = Math.hypot(
      candidate[0] - oklab[0],
      candidate[1] - oklab[1],
      candidate[2] - oklab[2],
    );

    if (delta < distance) {
      best = name;
      distance = delta;
    }
  }

  return `closest named color: ${best} (ΔE ${trim(distance * 100, 1)})`;
}

function colorError(code: string, message: string): FunctionError {
  return new FunctionError(code, message);
}
