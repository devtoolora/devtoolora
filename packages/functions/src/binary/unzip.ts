import { Unzip, UnzipInflate } from 'fflate';
import { FunctionError } from '../errors';

export type ZipLimits = { maxEntries: number; maxEntryBytes: number; maxTotalBytes: number };

const zipLimits: ZipLimits = {
  maxEntries: 2_000,
  maxEntryBytes: 52_428_800,
  maxTotalBytes: 104_857_600,
};

// Small pushes cap the inflate overshoot past a limit at ~1032x (max deflate ratio) the chunk.
const chunkSize = 4_096;
const eocdSignature = [0x50, 0x4b, 0x05, 0x06];

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const lowest = Math.max(0, bytes.length - 22 - 65_535);

  for (let index = bytes.length - 22; index >= lowest; index -= 1) {
    if (eocdSignature.every((value, offset) => bytes[index + offset] === value)) return index;
  }

  return -1;
}

// The streaming API hides the general-purpose flags, so read them from the central directory.
function assertNotEncrypted(bytes: Uint8Array, eocd: number): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(eocd + 10, true);
  let position = view.getUint32(eocd + 16, true);

  for (let index = 0; index < count; index += 1) {
    if (position + 46 > bytes.length || view.getUint32(position, true) !== 0x02014b50)
      throw new FunctionError('INVALID_ZIP', 'The ZIP archive is corrupt.');

    if (view.getUint16(position + 8, true) & 1)
      throw new FunctionError('UNSUPPORTED_ZIP', 'Encrypted ZIP entries are not supported.');

    position +=
      46 +
      view.getUint16(position + 28, true) +
      view.getUint16(position + 30, true) +
      view.getUint16(position + 32, true);
  }
}

function corruptError(message: string): FunctionError {
  return new FunctionError(
    'INVALID_ZIP',
    `The ZIP archive is corrupt: ${message.replace(/\.+$/, '')}.`,
  );
}

function limitError(message: string): FunctionError {
  return new FunctionError('ZIP_LIMIT', `${message} Use a smaller archive.`);
}

function mibLabel(bytes: number): string {
  return `${(bytes / 1_048_576).toLocaleString('en-US')} MiB`;
}

// Counts bytes actually inflated (headers may lie) and throws before buffering past a limit.
export function readZip(
  bytes: Uint8Array,
  options: { include: (name: string) => boolean; limits?: ZipLimits },
): Map<string, Uint8Array> {
  const limits = options.limits ?? zipLimits;
  const eocd = findEndOfCentralDirectory(bytes);

  if (eocd < 0) throw new FunctionError('INVALID_ZIP', 'The file is not a valid ZIP archive.');

  assertNotEncrypted(bytes, eocd);

  const result = new Map<string, Uint8Array>();
  const seen = new Set<string>();
  let callerError: { error: unknown } | undefined;
  let failure: FunctionError | undefined;
  let total = 0;
  const unzip = new Unzip();

  unzip.register(UnzipInflate);

  unzip.onfile = (file) => {
    if (failure) return;

    const fail = (error: FunctionError): void => {
      failure = error;
      file.terminate();
    };

    const problem = entryProblem(file, seen, limits);

    if (problem) return fail(problem);

    const chunks: Uint8Array[] = [];
    let keep = false;

    try {
      keep = options.include(file.name);
    } catch (error) {
      callerError = { error };
      file.terminate();

      throw error;
    }

    let entryBytes = 0;

    file.ondata = (error, chunk, final) => {
      if (failure) return;

      if (error) return fail(corruptError(error.message));

      entryBytes += chunk.length;
      total += chunk.length;

      if (entryBytes > limits.maxEntryBytes)
        return fail(limitError(`An entry inflates past ${mibLabel(limits.maxEntryBytes)}.`));

      if (total > limits.maxTotalBytes)
        return fail(limitError(`The archive inflates past ${mibLabel(limits.maxTotalBytes)}.`));

      if (keep) chunks.push(chunk);

      if (final && keep) result.set(file.name, concat(chunks, entryBytes));
    };

    file.start();
  };

  try {
    for (let offset = 0; offset < bytes.length && !failure; offset += chunkSize) {
      unzip.push(bytes.subarray(offset, offset + chunkSize), offset + chunkSize >= bytes.length);
    }
  } catch (error) {
    if (callerError) throw callerError.error;
    if (failure) throw failure;

    throw corruptError(error instanceof Error ? error.message : String(error));
  }

  if (failure) throw failure;

  return result;
}

function entryProblem(
  file: { compression: number; name: string },
  seen: Set<string>,
  limits: ZipLimits,
): FunctionError | undefined {
  if (seen.size >= limits.maxEntries)
    return limitError(
      `The archive has more than ${limits.maxEntries.toLocaleString('en-US')} entries.`,
    );

  if (seen.has(file.name))
    return new FunctionError('UNSUPPORTED_ZIP', `The archive has a duplicate entry ${file.name}.`);

  seen.add(file.name);

  if (file.compression !== 0 && file.compression !== 8)
    return new FunctionError(
      'UNSUPPORTED_ZIP',
      `Entry ${file.name} uses an unsupported compression method.`,
    );

  return undefined;
}

function concat(chunks: Uint8Array[], length: number): Uint8Array {
  if (chunks.length === 1) return chunks[0] ?? new Uint8Array(0);

  const out = new Uint8Array(length);
  let position = 0;

  for (const chunk of chunks) {
    out.set(chunk, position);
    position += chunk.length;
  }

  return out;
}
