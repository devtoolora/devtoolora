import { parsePrintedCssColor } from '../color/cssColor';
import { trim } from '../color/cssColorSpace';
import { stream } from '../data/fakeDataGenerators';

const WIDTH = 800;
const HEIGHT = 600;

export interface MeshPoint {
  x: number;
  y: number;
}

export function meshRadii({ x, y }: MeshPoint): { rx: number; ry: number } {
  const round = (value: number) => Number(trim(value, 2));

  return {
    rx: round(Math.SQRT2 * Math.max(x, 100 - x) * (WIDTH / 100)),
    ry: round(Math.SQRT2 * Math.max(y, 100 - y) * (HEIGHT / 100)),
  };
}

function layerSvg(point: MeshPoint, color: string, index: number, stop: number): string {
  const { rx, ry } = meshRadii(point);
  const cx = trim((point.x * WIDTH) / 100, 2);
  const cy = trim((point.y * HEIGHT) / 100, 2);

  return `<radialGradient id="m${index}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${cx} ${cy}) scale(${trim(rx, 2)} ${trim(ry, 2)})"><stop offset="0" stop-color="${color}"/><stop offset="${stop / 100}" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
}

export function meshGradient(options: { background: string; colors: string[]; seed: number }): {
  css: string;
  points: MeshPoint[];
  svg: string;
} {
  const { background, colors, seed } = options;

  // Parsing rejects anything that is not a plain CSS color, so values are safe in CSS and XML.
  [background, ...colors].forEach((color) => parsePrintedCssColor(color));
  const stop = Math.min(50, Math.round(200 / colors.length));
  const random = stream(seed, 'mesh');
  const points = colors.map(() => ({
    x: Math.round(random() * 100),
    y: Math.round(random() * 100),
  }));
  const layers = colors.map(
    (color, index) =>
      `radial-gradient(at ${points[index]?.x}% ${points[index]?.y}%, ${color} 0px, transparent ${stop}%)`,
  );
  const css = `.mesh {\n  background-color: ${background};\n  background-image:\n    ${layers.join(',\n    ')};\n}`;
  const defs = colors.map((color, index) =>
    layerSvg(points[index] ?? { x: 50, y: 50 }, color, index, stop),
  );
  const rects = colors
    .map((_, index) => `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#m${index})"/>`)
    .reverse();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}"><defs>${defs.join('')}</defs><rect width="${WIDTH}" height="${HEIGHT}" fill="${background}"/>${rects.join('')}</svg>`;

  return { css, points, svg };
}
