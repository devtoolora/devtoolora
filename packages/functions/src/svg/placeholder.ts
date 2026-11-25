import { boundedInteger } from '../validation';

export function createSvgPlaceholder(
  options: {
    background?: string;
    foreground?: string;
    height?: number;
    label?: string;
    width?: number;
  } = {},
): string {
  const width = boundedInteger(options.width ?? 1200, 'Width', 1, 10000);
  const height = boundedInteger(options.height ?? 630, 'Height', 1, 10000);
  const label = options.label || `${width}x${height}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${escapeHtml(options.background || '#1f2937')}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="${escapeHtml(options.foreground || '#ffffff')}" font-family="Arial, sans-serif" font-size="${Math.max(16, Math.round(width / 14))}">${escapeHtml(label)}</text></svg>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
