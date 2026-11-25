import { trim } from '../color/cssColorSpace';
import type { BarcodeFormat, EncodedBarcode } from './index';

export interface BarcodeSvgOptions {
  format: BarcodeFormat;
  height: number;
  moduleWidth: number;
  showText: boolean;
}

const quietZones: Record<BarcodeFormat, [number, number]> = {
  code128: [10, 10],
  code39: [10, 10],
  ean13: [11, 7],
  upca: [9, 9],
};
const guardModules = (index: number) => index < 3 || (index >= 45 && index < 50) || index >= 92;
const guardExtension = 5;
const fontSize = 12;
const num = (value: number) => trim(value, 2);

function barPath(modules: string, left: number, options: BarcodeSvgOptions, guards: boolean) {
  const { height, moduleWidth } = options;
  const parts: string[] = [];
  let index = 0;

  while (index < modules.length) {
    if (modules[index] !== '1') {
      index += 1;

      continue;
    }

    const guard = guards && guardModules(index);
    let end = index;

    while (modules[end + 1] === '1' && (guards && guardModules(end + 1)) === guard) end += 1;

    const barHeight = height + (guard ? guardExtension * moduleWidth : 0);

    parts.push(
      `M${num(left + index * moduleWidth)} 0h${num((end - index + 1) * moduleWidth)}v${num(barHeight)}h-${num((end - index + 1) * moduleWidth)}z`,
    );

    index = end + 1;
  }

  return parts.join('');
}

const escapeText = (text: string) =>
  [...text]
    .map((char) => (char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? '·' : char))
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

type Label = { anchor: 'middle'; length?: number; text: string; x: number };

function labels(text: string, options: BarcodeSvgOptions, quiet: [number, number], total: number) {
  const mw = options.moduleWidth;
  const place = (from: number, to: number, value: string): Label => ({
    anchor: 'middle',
    length: (to - from) * mw * 0.9,
    text: value,
    x: ((from + to) / 2 + quiet[0]) * mw,
  });
  const outside = (value: string, side: 'left' | 'right'): Label => ({
    anchor: 'middle',
    text: value,
    x: (side === 'left' ? quiet[0] / 2 : total - quiet[1] / 2) * mw,
  });

  if (options.format === 'ean13') {
    return [
      outside(text.slice(0, 1), 'left'),
      place(3, 45, text.slice(1, 7)),
      place(50, 92, text.slice(7)),
    ];
  }

  if (options.format === 'upca') {
    return [
      outside(text.slice(0, 1), 'left'),
      place(10, 45, text.slice(1, 6)),
      place(50, 85, text.slice(6, 11)),
      outside(text.slice(11), 'right'),
    ];
  }

  return [{ anchor: 'middle', text, x: (total / 2) * mw } as Label];
}

export function barcodeSvg(encoded: EncodedBarcode, options: BarcodeSvgOptions): string {
  const { format, height, moduleWidth, showText } = options;
  const quiet = quietZones[format];
  const isEan = format === 'ean13' || format === 'upca';
  const totalModules = encoded.modules.length + quiet[0] + quiet[1];
  const width = totalModules * moduleWidth;
  const barsHeight = height + (isEan ? guardExtension * moduleWidth : 0);
  const textY = barsHeight + fontSize + 2;
  const totalHeight = showText ? textY + 4 : barsHeight;
  const text = showText
    ? labels(encoded.humanText, options, quiet, totalModules)
        .map((label) => {
          const length = label.length
            ? ` textLength="${num(label.length)}" lengthAdjust="spacing"`
            : '';

          return `<text x="${num(label.x)}" y="${num(textY)}" text-anchor="${label.anchor}"${length}>${escapeText(label.text)}</text>`;
        })
        .join('')
    : '';
  const body = `<path d="${barPath(encoded.modules, quiet[0] * moduleWidth, options, isEan)}" fill="#000"/>`;
  const textGroup = text
    ? `<g font-family="monospace" font-size="${fontSize}" fill="#000">${text}</g>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}" height="${num(totalHeight)}" viewBox="0 0 ${num(width)} ${num(totalHeight)}"><rect width="100%" height="100%" fill="#fff"/>${body}${textGroup}</svg>`;
}
