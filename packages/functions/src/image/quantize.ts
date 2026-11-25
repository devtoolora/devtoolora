export type QuantizedFrame = {
  indices: Uint8Array;
  palette: Uint8Array;
  transparentIndex: number | null;
};

type Dither = 'floyd-steinberg' | 'none';

type Cell = {
  b: number;
  count: number;
  g: number;
  key: readonly [number, number, number];
  r: number;
};
type Box = { cells: Cell[]; channel: 0 | 1 | 2; spread: number };

const alphaCutoff = 128;
const binCount = 1 << 15;

function binOf(r: number, g: number, b: number): number {
  return ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
}

function makeBox(cells: Cell[]): Box {
  const low = [255, 255, 255];
  const high = [0, 0, 0];

  for (const cell of cells) {
    for (const channel of [0, 1, 2] as const) {
      const value = cell.key[channel];

      if (value < (low[channel] ?? 255)) low[channel] = value;
      if (value > (high[channel] ?? 0)) high[channel] = value;
    }
  }

  const spreads = [0, 1, 2].map((c) => (high[c] ?? 0) - (low[c] ?? 0));
  let channel: 0 | 1 | 2 = 0;

  if ((spreads[1] ?? 0) > (spreads[channel] ?? 0)) channel = 1;
  if ((spreads[2] ?? 0) > (spreads[channel] ?? 0)) channel = 2;

  return { cells, channel, spread: spreads[channel] ?? 0 };
}

function splitBox(box: Box): [Box, Box] {
  const { channel } = box;
  const sorted = [...box.cells].sort((a, b) => a.key[channel] - b.key[channel]);
  let total = 0;

  for (const cell of sorted) total += cell.count;

  let seen = 0;
  let cut = 1;

  for (let i = 0; i < sorted.length - 1; i += 1) {
    seen += sorted[i]?.count ?? 0;
    cut = i + 1;
    if (seen >= total / 2) break;
  }

  return [makeBox(sorted.slice(0, cut)), makeBox(sorted.slice(cut))];
}

function medianCut(cells: Cell[], limit: number): Uint8Array {
  const boxes = [makeBox(cells)];

  while (boxes.length < limit) {
    let pick = -1;
    let best = 0;

    boxes.forEach((box, index) => {
      if (box.cells.length > 1 && box.spread > best) {
        best = box.spread;
        pick = index;
      }
    });

    const box = boxes[pick];

    if (!box) break;

    const [left, right] = splitBox(box);

    boxes[pick] = left;
    boxes.push(right);
  }

  const palette = new Uint8Array(boxes.length * 3);

  boxes.forEach((box, index) => {
    let count = 0;
    let r = 0;
    let g = 0;
    let b = 0;

    for (const cell of box.cells) {
      count += cell.count;
      r += cell.r;
      g += cell.g;
      b += cell.b;
    }

    palette.set([Math.round(r / count), Math.round(g / count), Math.round(b / count)], index * 3);
  });

  return palette;
}

class NearestCache {
  private readonly bins = new Int16Array(binCount).fill(-1);
  private readonly colors = new Map<number, number>();

  constructor(
    private readonly palette: Uint8Array,
    private readonly count: number,
    private readonly exact: boolean,
  ) {}

  lookup(r: number, g: number, b: number): number {
    if (this.exact) {
      const key = (r << 16) | (g << 8) | b;
      const cached = this.colors.get(key);

      if (cached !== undefined) return cached;

      const index = this.search(r, g, b);

      this.colors.set(key, index);

      return index;
    }

    const bin = binOf(r, g, b);
    const cached = this.bins[bin] ?? -1;

    if (cached >= 0) return cached;

    const index = this.search(((r >> 3) << 3) | 4, ((g >> 3) << 3) | 4, ((b >> 3) << 3) | 4);

    this.bins[bin] = index;

    return index;
  }

  private search(r: number, g: number, b: number): number {
    let best = 0;
    let bestDistance = Infinity;

    for (let i = 0; i < this.count; i += 1) {
      const dr = r - (this.palette[i * 3] ?? 0);
      const dg = g - (this.palette[i * 3 + 1] ?? 0);
      const db = b - (this.palette[i * 3 + 2] ?? 0);
      const distance = dr * dr + dg * dg + db * db;

      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }

    return best;
  }
}

function clamp(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function addError(row: Float32Array, x: number, errors: number[], weight: number): void {
  for (let c = 0; c < 3; c += 1) {
    row[(x + 1) * 3 + c] = (row[(x + 1) * 3 + c] ?? 0) + (errors[c] ?? 0) * weight;
  }
}

function dither(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Uint8Array,
  nearest: NearestCache,
  indices: Uint8Array,
  transparentIndex: number,
): void {
  let current = new Float32Array((width + 2) * 3);
  let following = new Float32Array((width + 2) * 3);
  const errors = [0, 0, 0];
  const opaque = (x: number, y: number): boolean =>
    x >= 0 && x < width && y < height && (rgba[(y * width + x) * 4 + 3] ?? 0) >= alphaCutoff;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = y * width + x;

      if ((rgba[at * 4 + 3] ?? 0) < alphaCutoff) {
        indices[at] = transparentIndex;

        continue;
      }

      const r = clamp((rgba[at * 4] ?? 0) + (current[(x + 1) * 3] ?? 0));
      const g = clamp((rgba[at * 4 + 1] ?? 0) + (current[(x + 1) * 3 + 1] ?? 0));
      const b = clamp((rgba[at * 4 + 2] ?? 0) + (current[(x + 1) * 3 + 2] ?? 0));
      const index = nearest.lookup(r, g, b);

      errors[0] = r - (palette[index * 3] ?? 0);
      errors[1] = g - (palette[index * 3 + 1] ?? 0);
      errors[2] = b - (palette[index * 3 + 2] ?? 0);
      indices[at] = index;

      if (opaque(x + 1, y)) addError(current, x + 1, errors, 7 / 16);
      if (opaque(x - 1, y + 1)) addError(following, x - 1, errors, 3 / 16);
      if (opaque(x, y + 1)) addError(following, x, errors, 5 / 16);
      if (opaque(x + 1, y + 1)) addError(following, x + 1, errors, 1 / 16);
    }

    [current, following] = [following, current];
    following.fill(0);
  }
}

function binCells(rgba: Uint8ClampedArray, pixels: number): Cell[] {
  const count = new Float64Array(binCount);
  const sums = new Float64Array(binCount * 3);
  const bins: number[] = [];

  for (let i = 0; i < pixels; i += 1) {
    if ((rgba[i * 4 + 3] ?? 0) < alphaCutoff) continue;

    const r = rgba[i * 4] ?? 0;
    const g = rgba[i * 4 + 1] ?? 0;
    const b = rgba[i * 4 + 2] ?? 0;
    const bin = binOf(r, g, b);

    if ((count[bin] ?? 0) === 0) bins.push(bin);

    count[bin] = (count[bin] ?? 0) + 1;
    sums[bin * 3] = (sums[bin * 3] ?? 0) + r;
    sums[bin * 3 + 1] = (sums[bin * 3 + 1] ?? 0) + g;
    sums[bin * 3 + 2] = (sums[bin * 3 + 2] ?? 0) + b;
  }

  return bins.map((bin) => ({
    b: sums[bin * 3 + 2] ?? 0,
    count: count[bin] ?? 0,
    g: sums[bin * 3 + 1] ?? 0,
    key: [bin >> 10, (bin >> 5) & 31, bin & 31],
    r: sums[bin * 3] ?? 0,
  }));
}

function colorCells(rgba: Uint8ClampedArray, pixels: number): Cell[] {
  const cells = new Map<number, Cell>();

  for (let i = 0; i < pixels; i += 1) {
    if ((rgba[i * 4 + 3] ?? 0) < alphaCutoff) continue;

    const r = rgba[i * 4] ?? 0;
    const g = rgba[i * 4 + 1] ?? 0;
    const b = rgba[i * 4 + 2] ?? 0;
    const key = (r << 16) | (g << 8) | b;
    const cell = cells.get(key);

    if (cell) {
      cell.count += 1;
      cell.r += r;
      cell.g += g;
      cell.b += b;
    } else {
      cells.set(key, { b, count: 1, g, key: [r, g, b], r });
    }
  }

  return [...cells.values()];
}

function exactColors(rgba: Uint8ClampedArray, pixels: number, slots: number): number[] | null {
  const seen = new Set<number>();

  for (let i = 0; i < pixels; i += 1) {
    if ((rgba[i * 4 + 3] ?? 0) < alphaCutoff) continue;

    seen.add(((rgba[i * 4] ?? 0) << 16) | ((rgba[i * 4 + 1] ?? 0) << 8) | (rgba[i * 4 + 2] ?? 0));
    if (seen.size > slots) return null;
  }

  return [...seen];
}

function mapPixels(
  rgba: Uint8ClampedArray,
  pixels: number,
  lookup: (r: number, g: number, b: number) => number,
  transparentIndex: number,
): Uint8Array {
  const indices = new Uint8Array(pixels);

  for (let i = 0; i < pixels; i += 1) {
    indices[i] =
      (rgba[i * 4 + 3] ?? 0) < alphaCutoff
        ? transparentIndex
        : lookup(rgba[i * 4] ?? 0, rgba[i * 4 + 1] ?? 0, rgba[i * 4 + 2] ?? 0);
  }

  return indices;
}

export function quantizeFrame(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  ditherMode: Dither,
): QuantizedFrame {
  const pixels = width * height;
  let hasTransparent = false;

  for (let i = 0; i < pixels && !hasTransparent; i += 1)
    hasTransparent = (rgba[i * 4 + 3] ?? 0) < alphaCutoff;

  const slots = hasTransparent ? 255 : 256;
  const exact = exactColors(rgba, pixels, slots);
  const bins = exact ? [] : binCells(rgba, pixels);
  const fine = bins.length < slots;
  const opaquePalette = exact
    ? Uint8Array.from(exact.flatMap((key) => [key >> 16, (key >> 8) & 255, key & 255]))
    : medianCut(fine ? colorCells(rgba, pixels) : bins, slots);
  const opaqueCount = opaquePalette.length / 3;
  const transparentIndex = hasTransparent ? opaqueCount : null;
  const palette = new Uint8Array(opaquePalette.length + (hasTransparent ? 3 : 0));
  const unused = transparentIndex ?? 0;

  palette.set(opaquePalette);

  if (exact) {
    const lookup = new Map(exact.map((key, index) => [key, index]));
    const indices = mapPixels(
      rgba,
      pixels,
      (r, g, b) => lookup.get((r << 16) | (g << 8) | b) ?? 0,
      unused,
    );

    return { indices, palette, transparentIndex };
  }

  const nearest = new NearestCache(opaquePalette, opaqueCount, fine);
  const indices = new Uint8Array(pixels);

  if (ditherMode === 'floyd-steinberg') {
    dither(rgba, width, height, opaquePalette, nearest, indices, unused);
  } else {
    indices.set(mapPixels(rgba, pixels, (r, g, b) => nearest.lookup(r, g, b), unused));
  }

  return { indices, palette, transparentIndex };
}
