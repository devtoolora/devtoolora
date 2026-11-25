import { stream } from '../data/fakeDataGenerators';
import { catmullRomPath, opaqueColor } from './curve';

export function svgBlob(options: {
  fill: string;
  points: number;
  randomness: number;
  seed: number;
  size: number;
}): string {
  const { points, randomness, seed, size } = options;
  const fill = opaqueColor(options.fill, 'Fill');
  const random = stream(seed, 'blob');
  const radius = 0.45 * size;
  const center = size / 2;
  const curve = Array.from({ length: points }, (_, index): [number, number] => {
    const angle = (2 * Math.PI * index) / points;
    const r = radius * (1 - 0.5 * (randomness / 100) * random());

    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><!-- seed: ${seed} --><path fill="${fill}" d="${catmullRomPath(curve, true)}"/></svg>`;
}
