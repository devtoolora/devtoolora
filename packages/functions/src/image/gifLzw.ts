const maxCodes = 4096;

export type LzwRowSink = (row: Uint8Array, length: number, streamRow: number) => void;

/** Reads variable-size codes LSB-first. */
class CodeReader {
  private accumulator = 0;
  private bits = 0;
  private position = 0;

  constructor(private readonly data: Uint8Array) {}

  read(size: number): number {
    while (this.bits < size && this.position < this.data.length) {
      this.accumulator |= (this.data[this.position] ?? 0) << this.bits;
      this.position += 1;
      this.bits += 8;
    }

    if (this.bits < size) return -1;

    const code = this.accumulator & ((1 << size) - 1);

    this.accumulator >>>= size;
    this.bits -= size;

    return code;
  }
}

class RowWriter {
  written = 0;
  private readonly row: Uint8Array;
  private x = 0;
  private y = 0;

  constructor(
    private readonly width: number,
    private readonly total: number,
    private readonly onRow: LzwRowSink,
  ) {
    this.row = new Uint8Array(width);
  }

  get full(): boolean {
    return this.written >= this.total;
  }

  write(stack: Uint8Array, depth: number): void {
    for (let index = depth - 1; index >= 0 && !this.full; index -= 1) {
      this.row[this.x++] = stack[index] ?? 0;
      this.written += 1;

      if (this.x === this.width) {
        this.onRow(this.row, this.width, this.y++);
        this.x = 0;
      }
    }
  }

  flush(): void {
    if (this.x > 0) this.onRow(this.row, this.x, this.y);
  }
}

class LzwTable {
  first = 0;
  next: number;
  size: number;
  readonly stack = new Uint8Array(maxCodes + 1);
  private readonly prefix = new Uint16Array(maxCodes);
  private readonly suffix = new Uint8Array(maxCodes);

  constructor(private readonly minCodeSize: number) {
    this.next = (1 << minCodeSize) + 2;
    this.size = minCodeSize + 1;
  }

  reset(): void {
    this.next = (1 << this.minCodeSize) + 2;
    this.size = this.minCodeSize + 1;
  }

  expand(code: number, previous: number): number {
    const clear = 1 << this.minCodeSize;
    let depth = 0;
    let current = code;

    if (code === this.next) {
      this.stack[depth++] = this.first;
      current = previous;
    }

    while (current > clear) {
      this.stack[depth++] = this.suffix[current] ?? 0;
      current = this.prefix[current] ?? 0;
    }

    this.stack[depth++] = current;
    this.first = current;

    return depth;
  }

  /** Adds previous + first; a full table keeps decoding at 12 bits, as browsers do. */
  add(previous: number): void {
    if (this.next >= maxCodes) return;

    this.prefix[this.next] = previous;
    this.suffix[this.next] = this.first;
    this.next += 1;
    if (this.next === 1 << this.size && this.size < 12) this.size += 1;
  }
}

export function decodeLzw(
  data: Uint8Array,
  minCodeSize: number,
  width: number,
  height: number,
  onRow: LzwRowSink,
): number {
  if (minCodeSize < 2 || minCodeSize > 8) return -1;

  const clear = 1 << minCodeSize;
  const reader = new CodeReader(data);
  const table = new LzwTable(minCodeSize);
  const writer = new RowWriter(width, width * height, onRow);
  let previous = -1;

  while (!writer.full) {
    const code = reader.read(table.size);

    if (code < 0 || code === clear + 1) break;

    if (code === clear) {
      table.reset();
      previous = -1;

      continue;
    }

    // Only a root may follow a clear code; otherwise a code may be at most the next free entry.
    if (previous < 0 ? code > clear : code > table.next) return -1;

    writer.write(table.stack, table.expand(code, previous));
    if (previous >= 0) table.add(previous);

    previous = code;
  }

  writer.flush();

  return writer.written;
}

export function interlaceOrder(height: number): Uint16Array {
  const order = new Uint16Array(height);
  let index = 0;

  for (const [start, step] of [
    [0, 8],
    [4, 8],
    [2, 4],
    [1, 2],
  ] as const) {
    for (let row = start; row < height; row += step) order[index++] = row;
  }

  return order;
}
