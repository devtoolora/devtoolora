import { parsePrintedCssColor } from '../color/cssColor';
import { FunctionError } from '../errors';

export type GradientStop = { color: string; position: number };
export type GradientOptions = {
  angle: number;
  interpolation: 'default' | 'oklab' | 'oklch';
  positionX: number;
  positionY: number;
  repeating: boolean;
  shape: 'circle' | 'ellipse';
  stops: GradientStop[];
  type: 'linear' | 'radial' | 'conic';
};

const stopCountError = 'Gradient stops must be a JSON array of 2 to 8 stops.';

export function parseGradientStops(json: string): GradientStop[] {
  if (json.length > 4000)
    throw new FunctionError('INVALID_CSS', 'Gradient stop JSON is limited to 4,000 characters.');

  let stops: unknown;

  try {
    stops = JSON.parse(json);
  } catch {
    throw new FunctionError('INVALID_CSS', 'Gradient stops must be valid JSON.');
  }

  if (!Array.isArray(stops) || stops.length < 2 || stops.length > 8)
    throw new FunctionError('INVALID_CSS', stopCountError);

  return stops.map(parseStop);
}

function parseStop(stop: unknown, index: number): GradientStop {
  const label = `Stop ${index + 1}`;

  if (!stop || typeof stop !== 'object' || Array.isArray(stop))
    throw new FunctionError('INVALID_CSS', `${label} must be an object.`);

  const keys = Object.keys(stop);
  const { color, position } = stop as Record<string, unknown>;

  if (keys.length !== 2 || !keys.includes('color') || !keys.includes('position'))
    throw new FunctionError(
      'INVALID_CSS',
      `${label} must have exactly a string color and a numeric position.`,
    );
  if (typeof position !== 'number' || !Number.isFinite(position) || position < 0 || position > 100)
    throw new FunctionError('INVALID_CSS', `${label} position must be a number between 0 and 100.`);
  if (Math.abs(Math.round(position * 100) - position * 100) > 1e-6)
    throw new FunctionError('INVALID_CSS', `${label} position allows up to 2 decimals.`);

  return { color: stopColor(color, label), position };
}

function stopColor(color: unknown, label: string): string {
  const trimmed = typeof color === 'string' ? color.trim() : '';

  // Printed as typed: reject declaration breakers.
  if (!trimmed || /[;{}"'\\<>]/.test(trimmed))
    throw new FunctionError('INVALID_CSS', `${label} color must be a CSS color such as #2563eb.`);

  try {
    parsePrintedCssColor(trimmed);
  } catch (error) {
    throw new FunctionError(
      'INVALID_CSS',
      `${label} color: ${error instanceof Error ? error.message : 'not a CSS color.'}`,
    );
  }

  return trimmed;
}

const number = (value: number): string => String(Math.round(value * 100) / 100);

function gradientPrelude(options: GradientOptions): string {
  const at = `at ${number(options.positionX)}% ${number(options.positionY)}%`;

  if (options.type === 'linear') return `${number(options.angle)}deg`;
  if (options.type === 'radial') return `${options.shape} ${at}`;

  return `from ${number(options.angle)}deg ${at}`;
}

export function generateGradientCss(options: GradientOptions): { css: string; reordered: boolean } {
  const sorted = [...options.stops].sort((left, right) => left.position - right.position);
  const reordered = sorted.some((stop, index) => stop !== options.stops[index]);
  const stops = sorted.map((stop) => `${stop.color} ${number(stop.position)}%`).join(', ');
  const name = `${options.repeating ? 'repeating-' : ''}${options.type}-gradient`;
  const prelude = gradientPrelude(options);
  const line = (method: string): string =>
    `  background-image: ${name}(${prelude}${method}, ${stops});`;
  const lines = [line('')];

  if (options.interpolation !== 'default') lines.push(line(` in ${options.interpolation}`));

  return { css: `.gradient {\n${lines.join('\n')}\n}`, reordered };
}
