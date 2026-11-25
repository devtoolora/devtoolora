import { FunctionError } from '../errors';
import { parseCssColor, type CssColor } from './cssColor';
import { fromLinear, linearToOklab, toLinear, type Vector } from './cssColorSpace';
import { machado2009 } from './machado2009';
import { inkFor } from './swatches';

export type VisionType = 'achromat' | 'deutan' | 'protan' | 'tritan';
export type VisionPair = {
  a: number;
  b: number;
  deltaE: Record<'normal' | VisionType, number>;
  flags: Array<'close for everyone' | VisionType>;
};
export type VisionResult = {
  distances: VisionPair[];
  pairs: VisionPair[];
  rows: Array<{ colors: string[]; type: 'normal' | VisionType }>;
};

const threshold = 0.08;
const severityMessage = 'Severity must be 0-100 in steps of 10.';
const visionTypes: VisionType[] = ['protan', 'deutan', 'tritan', 'achromat'];

export function splitPalette(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if ((char === ',' && depth === 0) || char === '\n') {
      parts.push(current);
      current = '';
    } else current += char;
  }

  parts.push(current);

  return parts.map((part) => part.trim()).filter(Boolean);
}

function matrixFor(type: 'deutan' | 'protan' | 'tritan', severity: number): number[][] {
  const matrix = machado2009[type][severity / 10];

  if (!matrix) throw new FunctionError('INVALID_SEVERITY', severityMessage);

  return matrix;
}

function simulate(rgb: Vector, type: VisionType, severity: number): Vector {
  const linear = rgb.map(toLinear) as Vector;
  const out =
    type === 'achromat'
      ? (() => {
          const y = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
          const mix = severity / 100;

          return linear.map((value) => value * (1 - mix) + y * mix);
        })()
      : matrixFor(type, severity).map((row) =>
          row.reduce((sum, weight, index) => sum + weight * (linear[index] ?? 0), 0),
        );

  return out.map((value) => fromLinear(Math.min(1, Math.max(0, value)))) as Vector;
}

const toHex = (rgb: Vector) =>
  `#${rgb
    .map((value) =>
      Math.round(value * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
const channels = (hex: string): Vector =>
  [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255) as Vector;
const oklab = (hex: string) => linearToOklab(channels(hex).map(toLinear) as Vector);

const delta = (a: string, b: string) => {
  const [x, y] = [oklab(a), oklab(b)];

  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

function measurePair(rows: VisionResult['rows'], a: number, b: number): VisionPair {
  const deltaE = {} as VisionPair['deltaE'];
  const flags: VisionPair['flags'] = [];

  for (const row of rows) deltaE[row.type] = delta(row.colors[a] ?? '', row.colors[b] ?? '');
  if (deltaE.normal < threshold) flags.push('close for everyone');

  for (const row of rows)
    if (row.type !== 'normal' && deltaE[row.type] < threshold && deltaE.normal >= threshold)
      flags.push(row.type);

  return { a, b, deltaE, flags };
}

function measurePairs(rows: VisionResult['rows']): VisionPair[] {
  const count = rows[0]?.colors.length ?? 0;
  const pairs: VisionPair[] = [];

  for (let a = 0; a < count; a += 1)
    for (let b = a + 1; b < count; b += 1) pairs.push(measurePair(rows, a, b));

  return pairs;
}

export function simulatePalette(
  colors: CssColor[],
  options: { severity: number; types: VisionType[] },
): VisionResult {
  if (!Number.isInteger(options.severity / 10) || options.severity < 0 || options.severity > 100)
    throw new FunctionError('INVALID_SEVERITY', severityMessage);
  if (colors.length < 2 || colors.length > 12)
    throw new FunctionError('INVALID_PALETTE', 'Enter 2-12 colors.');
  if (colors.some((color) => color.alpha < 1))
    throw new FunctionError('INVALID_PALETTE', 'Colors must be opaque; remove the alpha channel.');
  if (options.types.length === 0)
    throw new FunctionError('INVALID_PALETTE', 'Select at least one vision type.');

  const normal = colors.map((color) => toHex([color.r, color.g, color.b]));
  const rows: VisionResult['rows'] = [{ colors: normal, type: 'normal' }];

  for (const type of visionTypes.filter((entry) => options.types.includes(entry)))
    rows.push({
      colors: colors.map((color) =>
        toHex(simulate([color.r, color.g, color.b], type, options.severity)),
      ),
      type,
    });

  const distances = measurePairs(rows);

  return { distances, pairs: distances.filter((pair) => pair.flags.length > 0), rows };
}

export function parsePalette(text: string): CssColor[] {
  return splitPalette(text).map((entry) => parseCssColor(entry));
}

function partnersOf(result: VisionResult, type: 'normal' | VisionType, index: number): number[] {
  const flag = type === 'normal' ? 'close for everyone' : type;

  return result.pairs
    .filter((pair) => pair.flags.includes(flag) && (pair.a === index || pair.b === index))
    .map((pair) => (pair.a === index ? pair.b : pair.a));
}

export function visionGridSvg(result: VisionResult): string {
  const [tileWidth, tileHeight, labelWidth, head, legend] = [56, 36, 32, 22, 26];
  const count = result.rows[0]?.colors.length ?? 0;
  const width = labelWidth + result.rows.length * tileWidth;
  const height = head + count * tileHeight + legend;
  const font = 'font-family="Arial, Helvetica, sans-serif"';
  const cells = result.rows.flatMap((row, column) =>
    row.colors.map((color, index) => {
      const [x, y] = [labelWidth + column * tileWidth, head + index * tileHeight];
      const partners = partnersOf(result, row.type, index).map((partner) => partner + 1);
      const ink = inkFor(color);
      const mark =
        partners.length > 3
          ? `≈${partners.slice(0, 2).join(',')} +${partners.length - 2}`
          : `≈${partners.join(',')}`;

      return `<rect x="${x}" y="${y}" width="${tileWidth}" height="${tileHeight}" fill="${color}"/>${
        partners.length
          ? `<rect x="${x + 2}" y="${y + 2}" width="${tileWidth - 4}" height="${tileHeight - 4}" fill="none" stroke="${ink}" stroke-width="2"/><text x="${x + tileWidth / 2}" y="${y + 22}" text-anchor="middle" ${font} font-size="11" font-weight="bold" fill="${ink}">${mark}</text>`
          : ''
      }`;
    }),
  );
  const headings = result.rows.map(
    (row, column) =>
      `<text x="${labelWidth + column * tileWidth + tileWidth / 2}" y="15" text-anchor="middle" ${font} font-size="11" fill="#444444">${row.type}</text>`,
  );
  const rowLabels = Array.from(
    { length: count },
    (_, index) =>
      `<text x="4" y="${head + index * tileHeight + 22}" ${font} font-size="12" fill="#444444">#${index + 1}</text>`,
  );
  const note = result.pairs.length
    ? '≈2: hard to tell apart from color #2 in that view'
    : 'No hard-to-tell pairs';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#ffffff"/>${[...headings, ...rowLabels, ...cells].join('')}<text x="4" y="${height - 9}" ${font} font-size="11" fill="#444444">${note}</text></svg>`;
}
