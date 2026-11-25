import { FunctionError } from '../errors';

export type ShadowColor = { hex: string; opacity: number };
export type ShadowLayer = {
  blur: number;
  color: string;
  inset: boolean;
  spread: number;
  x: number;
  y: number;
};

export type TextShadowLayer = { blur: number; color: string; x: number; y: number };

export function shadowColor(value: string): ShadowColor {
  if (typeof value !== 'string' || value.length > 256) throw colorError();

  const color = value.trim();

  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) {
    const hex =
      color.length < 6
        ? [...color.slice(1)].map((character) => character.repeat(2)).join('')
        : color.slice(1);

    return {
      hex: `#${hex.slice(0, 6).toLowerCase()}`,
      opacity: hex.length === 8 ? Number.parseInt(hex.slice(6), 16) / 255 : 1,
    };
  }

  const match = /^(rgb|rgba)\(([^()]*)\)$/i.exec(color);
  const channels = match?.[2]!.split(',').map((part) => part.trim()) ?? [];

  if (!match || channels.length !== (match[1]!.toLowerCase() === 'rgba' ? 4 : 3))
    throw colorError();

  const percents = channels.slice(0, 3).filter((part) => part.endsWith('%')).length;

  // Browsers reject comma-form rgb() that mixes numbers and percentages.
  if (percents !== 0 && percents !== 3) throw colorError();

  const rgb = channels.slice(0, 3).map((part) => {
    if (!/^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)%?$/.test(part)) throw colorError();

    const channel = Number.parseFloat(part);
    const maximum = part.endsWith('%') ? 100 : 255;

    if (!Number.isFinite(channel) || channel > maximum) throw colorError();

    return Math.round((channel * 255) / maximum);
  });
  let opacity = 1;

  const [, , , alpha] = channels;

  if (alpha !== undefined) {
    if (!/^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)%?$/.test(alpha)) throw colorError();

    const maximum = alpha.endsWith('%') ? 100 : 1;

    opacity = Number.parseFloat(alpha) / maximum;
    if (!Number.isFinite(opacity) || opacity > 1) throw colorError();
  }

  return {
    hex: `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`,
    opacity,
  };
}

export function shadowColorWithOpacity(hex: string, opacity: number): string {
  const color = shadowColor(hex);

  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw colorError();

  const channels = [1, 3, 5].map((index) => Number.parseInt(color.hex.slice(index, index + 2), 16));

  return `rgba(${channels.join(', ')}, ${Math.round(opacity * 10000) / 10000})`;
}

interface LayerListMessages {
  count: string;
  json: string;
  limit: number;
  tooLong: string;
}

function parseLayerList(value: string, messages: LayerListMessages): unknown[] {
  if (value.length > messages.limit) throw new FunctionError('INVALID_CSS', messages.tooLong);

  let layers: unknown;

  try {
    layers = JSON.parse(value);
  } catch {
    throw new FunctionError('INVALID_CSS', messages.json);
  }

  if (!Array.isArray(layers) || layers.length < 1 || layers.length > 5)
    throw new FunctionError('INVALID_CSS', messages.count);

  return layers;
}

export function parseShadowLayers(value: string): ShadowLayer[] {
  const layers = parseLayerList(value, {
    count: 'Shadow layers must contain between one and five valid layers.',
    json: 'Shadow layers must be valid JSON.',
    limit: 10_000,
    tooLong: 'Shadow layer JSON is limited to 10,000 UTF-16 units.',
  });

  return layers.map((layer: unknown, index: number) => {
    if (!layer || typeof layer !== 'object' || Array.isArray(layer))
      throw new FunctionError('INVALID_CSS', `Layer ${index + 1} must be an object.`);

    const entries: Record<string, unknown> = Object.fromEntries(Object.entries(layer));
    const { blur, color, inset, spread, x, y } = entries;

    if (
      Object.keys(entries).some(
        (key) => !['blur', 'color', 'inset', 'spread', 'x', 'y'].includes(key),
      ) ||
      typeof inset !== 'boolean' ||
      typeof color !== 'string' ||
      typeof blur !== 'number' ||
      typeof spread !== 'number' ||
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      ![blur, spread, x, y].every(Number.isFinite)
    )
      throw new FunctionError(
        'INVALID_CSS',
        `Layer ${index + 1} requires numeric x/y/blur/spread, string color and boolean inset, with no unknown properties.`,
      );

    shadowColor(color);
    if (blur < 0 || blur > 300 || [spread, x, y].some((number) => number < -200 || number > 200))
      throw new FunctionError(
        'INVALID_CSS',
        `Layer ${index + 1} dimensions must use blur 0-300 and offsets/spread -200 to 200.`,
      );

    return { blur, color, inset, spread, x, y };
  });
}

const textShadowKeys = ['blur', 'color', 'x', 'y'];

export function parseTextShadowLayers(value: string): TextShadowLayer[] {
  const layers = parseLayerList(value, {
    count: 'Text shadow layers must contain one to five layers.',
    json: 'Text shadow layers must be valid JSON.',
    limit: 4000,
    tooLong: 'Text shadow layer JSON is limited to 4,000 characters.',
  });

  return layers.map((layer: unknown, index: number) => {
    const entries: Record<string, unknown> =
      layer && typeof layer === 'object' && !Array.isArray(layer)
        ? Object.fromEntries(Object.entries(layer))
        : {};
    const { blur, color, x, y } = entries;
    const fail = (reason: string): FunctionError =>
      new FunctionError('INVALID_CSS', `Layer ${index + 1} ${reason}`);

    if (
      Object.keys(entries).length !== 4 ||
      !Object.keys(entries).every((key) => textShadowKeys.includes(key)) ||
      typeof color !== 'string' ||
      typeof blur !== 'number' ||
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      ![blur, x, y].every(Number.isFinite)
    )
      throw fail('requires numeric x, y and blur and a string color, with no other properties.');

    shadowColor(color);
    if (blur < 0 || blur > 100 || [x, y].some((number) => number < -100 || number > 100))
      throw fail('must use blur 0-100 and offsets -100 to 100.');

    return { blur, color, x, y };
  });
}

export function generateTextShadowCss(layers: TextShadowLayer[]): string {
  const px = (number: number): string => `${Math.round(number * 100) / 100}px`;
  const values = layers.map(
    (layer) => `${px(layer.x)} ${px(layer.y)} ${px(layer.blur)} ${layer.color.trim()}`,
  );

  return `.text {\n  text-shadow: ${values.join(', ')};\n}`;
}

function colorError(): FunctionError {
  return new FunctionError(
    'INVALID_CSS',
    'Shadow color must be #RGB, #RGBA, #RRGGBB, #RRGGBBAA or comma-form rgb()/rgba() with valid channels and opacity.',
  );
}
