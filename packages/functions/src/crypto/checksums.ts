export type ChecksumAlgorithm =
  | 'adler32'
  | 'crc8'
  | 'crc16-arc'
  | 'crc16-ccitt-false'
  | 'crc16-modbus'
  | 'crc32'
  | 'crc32c'
  | 'fletcher16'
  | 'fletcher32';

interface CrcSpec {
  digits: number;
  init: number;
  label: string;
  poly: number;
  reflected: boolean;
  width: number;
  xorOut: number;
}

const crcSpecs: Partial<Record<ChecksumAlgorithm, CrcSpec>> = {
  crc32: {
    digits: 8,
    init: 0xffffffff,
    label: 'CRC-32',
    poly: 0xedb88320,
    reflected: true,
    width: 32,
    xorOut: 0xffffffff,
  },
  crc32c: {
    digits: 8,
    init: 0xffffffff,
    label: 'CRC-32C',
    poly: 0x82f63b78,
    reflected: true,
    width: 32,
    xorOut: 0xffffffff,
  },
  'crc16-arc': {
    digits: 4,
    init: 0,
    label: 'CRC-16/ARC',
    poly: 0xa001,
    reflected: true,
    width: 16,
    xorOut: 0,
  },
  'crc16-ccitt-false': {
    digits: 4,
    init: 0xffff,
    label: 'CRC-16/CCITT-FALSE',
    poly: 0x1021,
    reflected: false,
    width: 16,
    xorOut: 0,
  },
  'crc16-modbus': {
    digits: 4,
    init: 0xffff,
    label: 'CRC-16/MODBUS',
    poly: 0xa001,
    reflected: true,
    width: 16,
    xorOut: 0,
  },
  crc8: { digits: 2, init: 0, label: 'CRC-8', poly: 0x07, reflected: false, width: 8, xorOut: 0 },
};

const otherLabels = { adler32: 'Adler-32', fletcher16: 'Fletcher-16', fletcher32: 'Fletcher-32' };

export const checksumAlgorithms: readonly ChecksumAlgorithm[] = [
  'crc32',
  'crc32c',
  'crc16-arc',
  'crc16-ccitt-false',
  'crc16-modbus',
  'crc8',
  'adler32',
  'fletcher16',
  'fletcher32',
];

const tables = new Map<ChecksumAlgorithm, Uint32Array>();

export function checksumLabel(algorithm: ChecksumAlgorithm): string {
  return crcSpecs[algorithm]?.label ?? otherLabels[algorithm as keyof typeof otherLabels];
}

export function computeChecksum(
  bytes: Uint8Array,
  algorithm: ChecksumAlgorithm,
): { decimal: number; hex: string } {
  const spec = crcSpecs[algorithm];
  const value = spec ? crc(bytes, algorithm, spec) : simpleSum(bytes, algorithm);
  const digits = spec?.digits ?? (algorithm === 'fletcher16' ? 4 : 8);

  return { decimal: value, hex: value.toString(16).toUpperCase().padStart(digits, '0') };
}

function crcTable(algorithm: ChecksumAlgorithm, spec: CrcSpec): Uint32Array {
  const cached = tables.get(algorithm);

  if (cached) return cached;

  const table = new Uint32Array(256);
  const top = 2 ** (spec.width - 1);
  const mask = 2 ** spec.width - 1;

  for (let index = 0; index < 256; index += 1) {
    let value = spec.reflected ? index : (index << (spec.width - 8)) >>> 0;

    for (let bit = 0; bit < 8; bit += 1) {
      if (spec.reflected) value = value & 1 ? (value >>> 1) ^ spec.poly : value >>> 1;
      else value = (value & top ? (value << 1) ^ spec.poly : value << 1) & mask;
    }

    table[index] = value >>> 0;
  }

  tables.set(algorithm, table);

  return table;
}

function crc(bytes: Uint8Array, algorithm: ChecksumAlgorithm, spec: CrcSpec): number {
  const table = crcTable(algorithm, spec);
  const mask = 2 ** spec.width - 1;
  let value = spec.init;

  for (const byte of bytes) {
    value = spec.reflected
      ? ((table[(value ^ byte) & 0xff] ?? 0) ^ (value >>> 8)) >>> 0
      : ((table[((value >>> (spec.width - 8)) ^ byte) & 0xff] ?? 0) ^ (value << 8)) & mask;
  }

  return (value ^ spec.xorOut) >>> 0;
}

function simpleSum(bytes: Uint8Array, algorithm: ChecksumAlgorithm): number {
  if (algorithm === 'adler32') return adler32(bytes);
  if (algorithm === 'fletcher16') return fletcher(bytes, 1, 255, 8);

  return fletcher(bytes, 2, 65535, 16);
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;

  for (let start = 0; start < bytes.length; start += 5552) {
    for (const byte of bytes.subarray(start, start + 5552)) {
      a += byte;
      b += a;
    }

    a %= 65521;
    b %= 65521;
  }

  return ((b << 16) | a) >>> 0;
}

function fletcher(bytes: Uint8Array, step: number, modulus: number, shift: number): number {
  let sum1 = 0;
  let sum2 = 0;

  for (let index = 0; index < bytes.length; index += step) {
    const word = (bytes[index] ?? 0) + (step === 2 ? (bytes[index + 1] ?? 0) * 256 : 0);

    sum1 = (sum1 + word) % modulus;
    sum2 = (sum2 + sum1) % modulus;
  }

  return ((sum2 << shift) | sum1) >>> 0;
}
