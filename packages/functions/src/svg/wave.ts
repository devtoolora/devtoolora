import { trim } from '../color/cssColorSpace';
import { stream } from '../data/fakeDataGenerators';
import { catmullRomPath, opaqueColor } from './curve';

interface WaveOptions {
  amplitude: number;
  color: string;
  height: number;
  layers: number;
  peaks: number;
  position: 'bottom' | 'top';
  seed: number;
  style: 'sine' | 'smooth';
  width: number;
}

function layerHeights(options: WaveOptions, layer: number): number[] {
  const { amplitude, height, layers, peaks, seed, style } = options;
  const mid = height * (0.6 - 0.1 * (layers - 1 - layer));
  const span = (amplitude / 100) * 0.4 * height;
  const random = stream(seed + layer, 'wave');
  const offsets =
    style === 'sine'
      ? Array.from({ length: peaks * 16 + 1 }, (_, i) => -Math.sin((2 * Math.PI * i) / 16))
      : Array.from({ length: 2 * peaks + 1 }, () => 2 * random() - 1);

  return offsets.map((offset) => Math.min(height, Math.max(0, mid + span * offset)));
}

export function svgWave(options: WaveOptions): string {
  const { height, layers, position, style, width } = options;
  const color = opaqueColor(options.color, 'Color');
  const flip = (y: number) => (position === 'top' ? height - y : y);
  const edge = flip(height);
  const paths = Array.from({ length: layers }, (_, layer) => {
    const ys = layerHeights(options, layer);
    const points = ys.map((y, i): [number, number] => [(width * i) / (ys.length - 1), flip(y)]);
    const d = `${catmullRomPath(points, false, [0, height])}L${width} ${edge}L0 ${edge}Z`;

    return `<path fill="${color}" fill-opacity="${trim((layer + 1) / layers, 2)}" d="${d}"/>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="none">${style === 'smooth' ? `<!-- seed: ${options.seed} -->` : ''}${paths.join('')}</svg>`;
}
