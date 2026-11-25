import { stripDiacriticsDetailed } from '../text';

export type SpriteLayoutKind = 'grid' | 'horizontal' | 'packed' | 'vertical';
export type SpriteSize = { height: number; name: string; width: number };
type SpriteFrame = SpriteSize & { x: number; y: number };
export type SpriteLayout = { frames: SpriteFrame[]; height: number; width: number };

function strip(sizes: SpriteSize[], padding: number, vertical: boolean): SpriteLayout {
  let offset = padding;
  const frames = sizes.map((size) => {
    const frame = vertical
      ? { ...size, x: padding, y: offset }
      : { ...size, x: offset, y: padding };

    offset += (vertical ? size.height : size.width) + padding;

    return frame;
  });
  const across = Math.max(0, ...sizes.map((size) => (vertical ? size.width : size.height)));

  return vertical
    ? { frames, height: offset, width: across + padding * 2 }
    : { frames, height: across + padding * 2, width: offset };
}

function grid(sizes: SpriteSize[], padding: number): SpriteLayout {
  const columns = Math.ceil(Math.sqrt(sizes.length));
  const rows = Math.ceil(sizes.length / columns);
  const cellWidth = Math.max(0, ...sizes.map((size) => size.width));
  const cellHeight = Math.max(0, ...sizes.map((size) => size.height));

  return {
    frames: sizes.map((size, index) => ({
      ...size,
      x: padding + (index % columns) * (cellWidth + padding),
      y: padding + Math.floor(index / columns) * (cellHeight + padding),
    })),
    height: padding + rows * (cellHeight + padding),
    width: padding + columns * (cellWidth + padding),
  };
}

function shelves(sizes: SpriteSize[], padding: number): SpriteLayout {
  const order = sizes
    .map((size, index) => ({ index, size }))
    .sort(
      (a, b) =>
        b.size.height - a.size.height ||
        b.size.width - a.size.width ||
        Number(a.size.name > b.size.name) - Number(a.size.name < b.size.name) ||
        a.index - b.index,
    );
  const area = sizes.reduce((sum, s) => sum + (s.width + padding) * (s.height + padding), 0);
  const target = Math.max(
    Math.max(0, ...sizes.map((size) => size.width)) + padding,
    Math.ceil(Math.sqrt(area)),
  );
  const frames: SpriteFrame[] = [];
  let x = padding;
  let y = padding;
  let shelfHeight = 0;
  let width = 0;

  for (const { index, size } of order) {
    if (shelfHeight > 0 && x + size.width + padding > target) {
      y += shelfHeight + padding;
      x = padding;
      shelfHeight = 0;
    }

    frames[index] = { ...size, x, y };
    x += size.width + padding;
    shelfHeight = Math.max(shelfHeight, size.height);
    width = Math.max(width, x);
  }

  return { frames, height: y + shelfHeight + padding, width };
}

export function packSprites(
  sizes: SpriteSize[],
  options: { layout: SpriteLayoutKind; padding: number },
): SpriteLayout {
  const { layout, padding } = options;

  if (layout === 'horizontal') return strip(sizes, padding, false);
  if (layout === 'vertical') return strip(sizes, padding, true);
  if (layout === 'grid') return grid(sizes, padding);

  return shelves(sizes, padding);
}

export function spriteClassNames(fileNames: string[], prefix: string): string[] {
  const used = new Set<string>();

  return fileNames.map((fileName, index) => {
    const base = fileName.replace(/\.[^./\\]*$/, '');
    const slug = stripDiacriticsDetailed(base)
      .text.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const root = slug === '' || /^[0-9]/.test(slug) ? `img-${index + 1}` : slug;
    let name = `${prefix}-${root}`;

    for (let copy = 2; used.has(name); copy += 1) name = `${prefix}-${root}-${copy}`;
    used.add(name);

    return name;
  });
}

export function spriteCss(
  layout: SpriteLayout,
  classNames: string[],
  options: { pixelRatio: 1 | 2; prefix: string },
): string {
  const scale = (value: number) => value / options.pixelRatio;
  const length = (value: number) => (value === 0 ? '0' : `${scale(value)}px`);
  const offset = (value: number) => (value === 0 ? '0' : `-${scale(value)}px`);
  const base = [
    `.${options.prefix} {`,
    "  background-image: url('sprite.png');",
    '  background-repeat: no-repeat;',
    ...(options.pixelRatio === 2
      ? [`  background-size: ${length(layout.width)} ${length(layout.height)};`]
      : []),
    '  display: inline-block;',
    '}',
  ].join('\n');
  const rules = layout.frames.map(
    (frame, index) =>
      `.${classNames[index]} {\n  width: ${length(frame.width)};\n  height: ${length(frame.height)};\n  background-position: ${offset(frame.x)} ${offset(frame.y)};\n}`,
  );

  return `${[base, ...rules].join('\n\n')}\n`;
}
