import type { RgbColor } from './types';

export function relativeLuminance(rgb: RgbColor): number {
  const linear = (channel: number): number => {
    const value = channel / 255;

    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  return linear(rgb.r) * 0.2126 + linear(rgb.g) * 0.7152 + linear(rgb.b) * 0.0722;
}

export function contrastRatio(first: RgbColor, second: RgbColor): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const high = Math.max(firstLuminance, secondLuminance);
  const low = Math.min(firstLuminance, secondLuminance);

  return (high + 0.05) / (low + 0.05);
}
