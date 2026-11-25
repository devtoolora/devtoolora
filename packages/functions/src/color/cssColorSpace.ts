export type Vector = [number, number, number];

const d50White: Vector = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];
const epsilon = 216 / 24389;
const kappa = 24389 / 27;

export const linearToXyzD65: Vector[] = [
  [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
];
export const xyzD65ToLinear: Vector[] = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];
export const d65ToD50: Vector[] = [
  [1.0479298208405488, 0.022946793341019088, -0.05019222954313557],
  [0.029627815688159344, 0.990434484573249, -0.01707382502938514],
  [-0.009243058152591178, 0.015055144896577895, 0.7518742899580008],
];
export const d50ToD65: Vector[] = [
  [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
  [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
  [0.012314001688319899, -0.020507696433477912, 1.3303659366080753],
];

export function hslToSrgb(h: number, s: number, l: number): Vector {
  const channel = (offset: number) => {
    const k = (offset + h / 30) % 12;

    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };

  return [channel(0), channel(8), channel(4)];
}

export function srgbToHsl(r: number, g: number, b: number): Vector {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return [0, 0, l];

  const s = delta / (1 - Math.abs(2 * l - 1));

  return [(hueSector(r, g, b, max, delta) * 60 + 360) % 360, s, l];
}

function hueSector(r: number, g: number, b: number, max: number, delta: number): number {
  if (max === r) return ((g - b) / delta) % 6;
  if (max === g) return (b - r) / delta + 2;

  return (r - g) / delta + 4;
}

export function linearToOklab([r, g, b]: Vector): Vector {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToLinear([lightness, a, b]: Vector): Vector {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function xyzToLab(xyz: Vector): Vector {
  const f = (value: number, white: number) => {
    const t = value / white;

    return t > epsilon ? Math.cbrt(t) : (kappa * t + 16) / 116;
  };

  const fx = f(xyz[0], d50White[0]);
  const fy = f(xyz[1], d50White[1]);
  const fz = f(xyz[2], d50White[2]);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToXyz([lightness, a, b]: Vector): Vector {
  const fy = (lightness + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const x = fx ** 3 > epsilon ? fx ** 3 : (116 * fx - 16) / kappa;
  const y = lightness > kappa * epsilon ? fy ** 3 : lightness / kappa;
  const z = fz ** 3 > epsilon ? fz ** 3 : (116 * fz - 16) / kappa;

  return [x * d50White[0], y * d50White[1], z * d50White[2]];
}

export function multiply(matrix: Vector[], vector: Vector): Vector {
  return matrix.map(
    (row) => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2],
  ) as Vector;
}

export function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function fromLinear(channel: number): number {
  const size = Math.abs(channel);

  return (
    Math.sign(channel) * (size <= 0.0031308 ? size * 12.92 : 1.055 * size ** (1 / 2.4) - 0.055)
  );
}

export function polar(chroma: number, hueDegrees: number): [number, number] {
  const radians = (hueDegrees * Math.PI) / 180;

  return [chroma * Math.cos(radians), chroma * Math.sin(radians)];
}

export function degrees(a: number, b: number): number {
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
}

export function composite(
  [r, g, b]: Vector,
  alpha: number,
  background: number,
): { b: number; g: number; r: number } {
  const blend = (channel: number) => Math.round(channel * alpha + background * (1 - alpha));

  return { b: blend(b), g: blend(g), r: blend(r) };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits: number): number {
  const factor = 10 ** digits;

  return Math.round(value * factor) / factor;
}

export function trim(value: number, digits: number): string {
  const result = round(value, digits);

  return String(Object.is(result, -0) ? 0 : result);
}
