import { contrastRatio } from './contrast';
import { parseCssColor } from './cssColor';

export type Swatch = { color: string; detail?: string; label: string; marked?: boolean };

const width = 300;
const rowHeight = 32;
const font = 'font-family="Arial, Helvetica, sans-serif" font-size="13"';
// The preview checkerboard averages to about this light gray; translucent colors sit over it.
const backdrop = 0.93;

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function inkFor(color: string): string {
  const { alpha, b, g, r } = parseCssColor(color);
  const over = (channel: number) => (channel * alpha + backdrop * (1 - alpha)) * 255;
  const rgb = { b: over(b), g: over(g), r: over(r) };

  return contrastRatio(rgb, { b: 0, g: 0, r: 0 }) >= contrastRatio(rgb, { b: 255, g: 255, r: 255 })
    ? '#000000'
    : '#ffffff';
}

export function swatchStripSvg(swatches: Swatch[]): string {
  const height = Math.max(rowHeight, swatches.length * rowHeight);
  const rows = swatches.map((swatch, index) => {
    const y = index * rowHeight;
    const ink = inkFor(swatch.color);
    const weight = swatch.marked ? ' font-weight="bold"' : '';
    const text = (x: number, anchor: string, value: string) =>
      `<text x="${x}" y="${y + 21}" text-anchor="${anchor}" ${font}${weight} fill="${ink}">${escapeXml(value)}</text>`;
    const marker = swatch.marked
      ? `<rect x="1.5" y="${y + 1.5}" width="${width - 3}" height="${rowHeight - 3}" fill="none" stroke="${ink}" stroke-width="3"/>`
      : '';

    return `<rect y="${y}" width="${width}" height="${rowHeight}" fill="${escapeXml(swatch.color)}"/>${marker}${text(12, 'start', swatch.label)}${swatch.detail ? text(width - 12, 'end', swatch.detail) : ''}`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${rows.join('')}</svg>`;
}
