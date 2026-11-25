import { trim } from '../color/cssColorSpace';
import { FunctionError } from '../errors';
import { opaqueColor } from './curve';
import { svgDataUri } from './dataUri';

interface PatternOptions {
  background?: string;
  foreground: string;
  strokeSize: number;
  tileSize: number;
  type: 'checkers' | 'diagonal' | 'dots' | 'grid' | 'zigzag';
}

function shapes(options: PatternOptions, fg: string): string {
  const { strokeSize: s, tileSize: t } = options;
  const [n, h, q, w] = [t, t / 2, t / 4, (3 * t) / 4].map((v) => trim(v, 2));
  const stroke = `fill="none" stroke="${fg}" stroke-width="${trim(s, 2)}"`;

  switch (options.type) {
    case 'dots':
      return `<circle cx="${h}" cy="${h}" r="${trim(s / 2, 2)}" fill="${fg}"/>`;
    case 'grid':
      return `<path d="M${trim(s / 2, 2)} 0V${n}M0 ${trim(s / 2, 2)}H${n}" ${stroke}/>`;
    case 'diagonal':
      return `<path d="M0 ${n}L${n} 0M-${h} ${h}L${h} -${h}M${h} ${trim(1.5 * t, 2)}L${trim(1.5 * t, 2)} ${h}" ${stroke}/>`;
    case 'zigzag':
      return `<polyline points="-${h},${q} 0,${w} ${h},${q} ${n},${w} ${trim(1.5 * t, 2)},${q}" ${stroke} stroke-linejoin="round"/>`;
    case 'checkers':
      return `<rect width="${h}" height="${h}" fill="${fg}"/><rect x="${h}" y="${h}" width="${h}" height="${h}" fill="${fg}"/>`;
  }
}

export function svgPattern(options: PatternOptions): {
  css: string;
  previewSvg: string;
  tile: string;
} {
  const { strokeSize, tileSize, type } = options;
  const limit = type === 'dots' ? tileSize : tileSize / 2;

  if (!Number.isFinite(tileSize) || tileSize < 4 || tileSize > 200)
    throw new FunctionError('SVG_PATTERN_TILE', 'Tile size must be between 4 and 200.');

  if (!Number.isFinite(strokeSize) || strokeSize < 1 || strokeSize > limit)
    throw new FunctionError(
      'SVG_PATTERN_STROKE',
      `Stroke size must be between 1 and ${trim(limit, 2)} for this tile.`,
    );

  const fg = opaqueColor(options.foreground, 'Foreground');
  const bg =
    options.background === undefined ? undefined : opaqueColor(options.background, 'Background');
  const size = trim(tileSize, 2);
  const inner =
    (bg === undefined ? '' : `<rect width="${size}" height="${size}" fill="${bg}"/>`) +
    shapes(options, fg);
  const ns = 'xmlns="http://www.w3.org/2000/svg"';
  const tile = `<svg ${ns} width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${inner}</svg>`;
  const previewSvg = `<svg ${ns} width="320" height="200" viewBox="0 0 320 200"><defs><pattern id="p" width="${size}" height="${size}" patternUnits="userSpaceOnUse">${inner}</pattern></defs><rect width="320" height="200" fill="url(#p)"/></svg>`;
  const css = [
    '.pattern {',
    ...(bg === undefined ? [] : [`  background-color: ${bg};`]),
    `  background-image: url("${svgDataUri(tile, 'url')}");`,
    `  background-size: ${size}px ${size}px;`,
    '}',
  ].join('\n');

  return { css, previewSvg, tile };
}
