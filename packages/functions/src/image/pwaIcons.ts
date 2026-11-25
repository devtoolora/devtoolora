import { parsePrintedCssColor } from '../color/cssColor';
import { context2d, createCanvas, decodeImage, encodeCanvas } from './canvas';
import type { ImageFile } from './types';

function faviconFileName(size: number): string {
  if (size === 180) return 'apple-touch-icon.png';
  if (size <= 48) return `favicon-${size}x${size}.png`;

  return `icon-${size}.png`;
}

export async function createPwaIconPack(options: {
  appName?: string;
  backgroundColor?: string;
  source?: ImageFile;
  textBackground?: string;
  textForeground?: string;
  textLabel?: string;
  textRadius?: number;
  themeColor?: string;
}): Promise<Array<{ bytes: Uint8Array; name: string }>> {
  const { backgroundColor, textBackground, textForeground, themeColor } = options;

  // A canvas ignores an invalid fillStyle, and the manifest would ship the bad value.
  for (const color of [backgroundColor, textBackground, textForeground, themeColor])
    if (color) parsePrintedCssColor(color);

  const assets: Array<{ bytes: Uint8Array; name: string }> = [];

  for (const size of [16, 32, 48, 180, 192, 512]) {
    const bytes = await renderIcon(
      options,
      size,
      size === 180 ? options.backgroundColor || '#ffffff' : undefined,
    );

    assets.push({
      name: faviconFileName(size),
      bytes,
    });
  }

  assets.push({
    name: 'icon-512-maskable.png',
    bytes: await renderIcon(options, 512, options.backgroundColor || '#ffffff', 64),
  });

  assets.push({
    name: 'favicon.ico',
    bytes: makeIco(
      assets.filter((asset) => asset.name.startsWith('favicon-')).map((asset) => asset.bytes),
    ),
  });

  const appName = options.appName || 'My App';
  const manifest = {
    name: appName,
    short_name: appName,
    theme_color: options.themeColor || '#ffffff',
    background_color: options.backgroundColor || '#ffffff',
    display: 'standalone',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };

  assets.push({
    name: 'site.webmanifest',
    bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
  });

  assets.push({
    name: 'README.md',
    bytes: new TextEncoder().encode(
      'Copy these files to your web root and link site.webmanifest from your HTML.\n',
    ),
  });

  return assets;
}

async function renderIcon(
  options: {
    source?: ImageFile;
    textBackground?: string;
    textForeground?: string;
    textLabel?: string;
    textRadius?: number;
  },
  size: number,
  background?: string,
  inset = 0,
): Promise<Uint8Array> {
  const canvas = createCanvas(size, size);
  const context = context2d(canvas);

  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, size, size);
  } else context.clearRect(0, 0, size, size);

  const inner = size - inset * 2;

  if (!options.source) {
    context.fillStyle = options.textBackground || '#2563eb';
    const radius = Math.min(inner / 2, (Math.max(0, options.textRadius ?? 0) * inner) / 512);

    if (radius > 0) {
      roundedSquarePath(context, inset, inset, inner, radius);
      context.fill();
    } else context.fillRect(inset, inset, inner, inner);

    context.fillStyle = options.textForeground || '#ffffff';
    context.font = `700 ${Math.round(size * 0.42)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText((options.textLabel || 'A').slice(0, 3), size / 2, size / 2);
  } else {
    const bitmap = await decodeImage(options.source.bytes, options.source.mimeType);
    const scale = Math.min(inner / bitmap.width, inner / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;

    context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  }

  return encodeCanvas(canvas, 'png', 1);
}

function roundedSquarePath(
  context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + size, y, x + size, y + size, radius);
  context.arcTo(x + size, y + size, x, y + size, radius);
  context.arcTo(x, y + size, x, y, radius);
  context.arcTo(x, y, x + size, y, radius);
  context.closePath();
}

function makeIco(pngs: Uint8Array[]): Uint8Array {
  const headerSize = 6 + pngs.length * 16;
  const output = new Uint8Array(headerSize + pngs.reduce((sum, png) => sum + png.length, 0));
  const view = new DataView(output.buffer);

  view.setUint16(2, 1, true);
  view.setUint16(4, pngs.length, true);
  let offset = headerSize;

  pngs.forEach((png, index) => {
    const entry = 6 + index * 16;

    output[entry] = [16, 32, 48][index] ?? 0;
    output[entry + 1] = [16, 32, 48][index] ?? 0;
    view.setUint16(entry + 4, 1, true);
    view.setUint16(entry + 6, 32, true);
    view.setUint32(entry + 8, png.length, true);
    view.setUint32(entry + 12, offset, true);
    output.set(png, offset);
    offset += png.length;
  });

  return output;
}
