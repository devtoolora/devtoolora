import { FunctionError } from '../errors';

export type RuntimeName = 'heic' | 'ocr';

export type RuntimeFileEntry = {
  bytes: number;
  kind: 'data' | 'script';
  language?: string;
  name: string;
  sha256: string;
  source: string;
};

export type RuntimeFileRecord = Omit<RuntimeFileEntry, 'source'>;

const store = new Map<string, Uint8Array>();

const key = (runtime: RuntimeName, name: string): string => `${runtime}/${name}`;

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');

/** Verifies files against `records`, not the compiled manifest, so a replaced library works. */
export async function addRuntimeFiles(
  runtime: RuntimeName,
  files: Record<string, ArrayBuffer>,
  records: RuntimeFileRecord[],
): Promise<void> {
  for (const [name, buffer] of Object.entries(files)) {
    const record = records.find((candidate) => candidate.name === name);

    if (!record) throw new FunctionError('RUNTIME_FILE', `Unknown runtime file ${name}.`);

    const digest = toHex(await crypto.subtle.digest('SHA-256', buffer));

    if (buffer.byteLength !== record.bytes || digest !== record.sha256) {
      throw new FunctionError(
        'RUNTIME_FILE',
        `Runtime file ${name} is corrupted (SHA-256 mismatch).`,
      );
    }

    store.set(key(runtime, name), new Uint8Array(buffer));
  }
}

export function runtimeFile(runtime: RuntimeName, name: string): Uint8Array {
  const bytes = store.get(key(runtime, name));

  if (!bytes) throw new FunctionError('RUNTIME_FILE', `Runtime file ${name} is not loaded.`);

  return bytes;
}
