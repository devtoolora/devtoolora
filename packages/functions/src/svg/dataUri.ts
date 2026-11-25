import { dataUriFromBytes } from '../binary/dataUri';
import { utf8Bytes } from '../binary/utf8';

const ESCAPED = new RegExp(
  `[%#<>{}\\\\^\`|${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}-\\u{10ffff}]`,
  'gu',
);

export function svgDataUri(svg: string, encoding: 'base64' | 'url'): string {
  if (encoding === 'base64') return dataUriFromBytes(utf8Bytes(svg), 'image/svg+xml');

  const encoded = svg.replace(ESCAPED, (char) => encodeURIComponent(char));
  const quoted = svg.includes("'") ? encoded.replaceAll('"', '%22') : encoded.replaceAll('"', "'");

  return `data:image/svg+xml,${quoted}`;
}

const attribute = (tag: string, name: string): string | undefined =>
  tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`))?.[1];

export function withIntrinsicSize(svg: string): string {
  const tag = svg.match(/<svg(?=[\s>/])[^>]*>/)?.[0] ?? '';
  const viewBox = (attribute(tag, 'viewBox') ?? '').split(/[\s,]+/).map(Number);
  const [boxWidth = NaN, boxHeight = NaN] = viewBox.slice(2);
  const rawWidth = attribute(tag, 'width');
  const rawHeight = attribute(tag, 'height');
  const plain = (value: string | undefined) =>
    value === undefined || /^\s*[\d.]+\s*(px)?\s*$/.test(value);
  const width = Number.parseFloat(rawWidth ?? '');
  const height = Number.parseFloat(rawHeight ?? '');

  if (!tag || !(boxWidth > 0 && boxHeight > 0) || !plain(rawWidth) || !plain(rawHeight)) return svg;
  if (rawWidth !== undefined && rawHeight !== undefined) return svg;

  let added = ` width="${boxWidth}" height="${boxHeight}"`;

  if (height > 0) added = ` width="${Number(((height * boxWidth) / boxHeight).toFixed(3))}"`;
  else if (width > 0) added = ` height="${Number(((width * boxHeight) / boxWidth).toFixed(3))}"`;

  return svg.replace(tag, () => tag.replace('<svg', () => `<svg${added}`));
}
