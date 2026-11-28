import { FunctionError } from '../errors';
import { boundedInteger } from '../validation';
import { splitSvgProlog } from './shared';

const maxSide = 10000;
// A name that is not followed by = fails the same way from any later letter of it, so the
// lookbehind tries each run of name characters once, from its first letter, not from every letter.
const attributePattern =
  /(?=[A-Za-z_:])(?<![A-Za-z_:][-A-Za-z0-9_:.]*?)([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;

export type SvgRenderReply = { bytes: Uint8Array } | { error: string };
export type SvgRenderRequest = {
  height: number;
  port: MessagePort;
  source: string;
  type: 'renderSvg';
  width: number;
};

export async function rasterizeSvg(
  sourceText: string,
  options: { maxHeight?: number; maxWidth?: number } = {},
): Promise<{ bytes: Uint8Array; height: number; width: number }> {
  const source = sourceText.trim();
  const body = splitSvgProlog(source)?.body;
  const tag = body?.match(/^<svg\b(?:"[^"]*"|'[^']*'|[^'">])*>/i)?.[0];

  if (!body || !tag)
    throw new FunctionError('INVALID_SVG', 'Paste valid SVG markup starting with <svg>.');

  const attrs = Object.fromEntries(
    [...tag.matchAll(attributePattern)].map((match) => [match[1], match[3] ?? match[4] ?? '']),
  );
  const viewBox = parseViewBox(attrs.viewBox);
  // Like a browser: width and height win, a missing one follows the viewBox ratio, and 300 × 150 is
  // the last resort.
  const attributeWidth = absoluteLength(attrs.width);
  const attributeHeight = absoluteLength(attrs.height);
  const sourceWidth = attributeWidth ?? viewBoxLength(viewBox, 2, attributeHeight, 300);
  const sourceHeight = attributeHeight ?? viewBoxLength(viewBox, 3, attributeWidth, 150);
  const maxWidth =
    options.maxWidth === undefined
      ? clampInteger(sourceWidth, 1, maxSide)
      : boundedInteger(options.maxWidth, 'Width', 1, maxSide);
  const maxHeight =
    options.maxHeight === undefined
      ? clampInteger(Math.round((sourceHeight * maxWidth) / sourceWidth), 1, maxSide)
      : boundedInteger(options.maxHeight, 'Height', 1, maxSide);
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const root = sizedRoot(tag, width, height, viewBox ?? [0, 0, sourceWidth, sourceHeight]);
  const bytes = await renderOnPage({
    height,
    source: `${source.slice(0, source.length - body.length)}${root}${body.slice(tag.length)}`,
    width,
  });

  return { bytes, height, width };
}

/**
 * Only an SVG image element renders SVG correctly, and it has to load as a standalone XML image: it
 * needs the namespace that inline markup may omit, and some browsers refuse a canvas draw without a
 * pixel size.
 */
function sizedRoot(tag: string, width: number, height: number, viewBox: number[]): string {
  const kept = tag
    .slice('<svg'.length)
    .replace(attributePattern, (attribute, name: string) =>
      name === 'width' || name === 'height' || name === 'viewBox' ? '' : attribute,
    );
  const namespace = /\sxmlns\s*=/.test(tag) ? '' : ' xmlns="http://www.w3.org/2000/svg"';

  return `<svg${namespace} width="${width}" height="${height}" viewBox="${viewBox.join(' ')}"${kept}`;
}

/** Tools run in a worker, which has no SVG engine, so the page that owns the worker draws. */
async function renderOnPage(render: {
  height: number;
  source: string;
  width: number;
}): Promise<Uint8Array> {
  if (!('WorkerGlobalScope' in globalThis))
    throw new FunctionError('SVG_RENDER_UNAVAILABLE', 'SVG rendering requires a browser page.');

  return new Promise((resolve, reject) => {
    const { port1, port2 } = new MessageChannel();

    port1.onmessage = ({ data }: MessageEvent<SvgRenderReply>) => {
      port1.close();

      if ('bytes' in data) resolve(data.bytes);
      else reject(new FunctionError('SVG_RENDER_FAILED', data.error));
    };

    const request: SvgRenderRequest = { ...render, port: port2, type: 'renderSvg' };

    (globalThis as unknown as Worker).postMessage(request, [port2]);
  });
}

function parseViewBox(attribute: string | undefined): number[] | undefined {
  const parsed = attribute
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);

  return parsed?.length === 4 && parsed[2]! > 0 && parsed[3]! > 0 ? parsed : undefined;
}

function viewBoxLength(
  viewBox: number[] | undefined,
  axis: 2 | 3,
  otherLength: number | undefined,
  fallback: number,
): number {
  const size = viewBox?.[axis];
  const otherSize = viewBox?.[axis === 2 ? 3 : 2];

  if (size === undefined || otherSize === undefined) return fallback;

  return otherLength ? (otherLength * size) / otherSize : size;
}

function absoluteLength(value: string | undefined): number | undefined {
  const match = /^\s*([+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(px|pt|pc|mm|cm|in)?\s*$/i.exec(
    value ?? '',
  );

  if (!match) return undefined;

  const scale = (
    { cm: 96 / 2.54, in: 96, mm: 96 / 25.4, pc: 16, pt: 4 / 3, px: 1 } as Record<string, number>
  )[(match[2] ?? 'px').toLowerCase()];

  if (scale === undefined) return undefined;

  const pixels = Number(match[1]) * scale;

  return pixels > 0 ? pixels : undefined;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.floor(value), min), max);
}
