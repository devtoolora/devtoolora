import { zipSync } from 'fflate';
import { FunctionError } from '../errors';

export interface ZipEntry {
  bytes: Uint8Array;
  name: string;
}

export function createZip(files: ZipEntry[]): Uint8Array {
  if (files.length === 0) {
    throw new FunctionError('FILES_REQUIRED', 'At least one file is required.');
  }

  return zipSync(Object.fromEntries(files.map((file) => [file.name, file.bytes])));
}
