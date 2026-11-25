import { base64Decode } from '../binary';
import { FunctionError } from '../errors';

export const ecCurveNames: Record<string, string> = {
  '1.2.840.10045.3.1.7': 'P-256',
  '1.3.132.0.34': 'P-384',
  '1.3.132.0.35': 'P-521',
  '1.3.132.0.10': 'secp256k1',
  '1.3.36.3.3.2.8.1.1.7': 'brainpoolP256r1',
  '1.3.36.3.3.2.8.1.1.11': 'brainpoolP384r1',
  '1.3.36.3.3.2.8.1.1.13': 'brainpoolP512r1',
};

export type Asn1Node = {
  bytes: Uint8Array;
  children: Asn1Node[];
  end: number;
  headerEnd: number;
  start: number;
  tag: number;
  valueEnd: number;
  valueStart: number;
};

export function parseAsn1(bytes: Uint8Array, options: { ber?: boolean } = {}): Asn1Node {
  const [node] = parseNode(bytes, 0, 0, bytes.length, options.ber === true);

  return node;
}

function parseNode(
  bytes: Uint8Array,
  start: number,
  depth: number,
  limit: number,
  ber: boolean,
): [Asn1Node, number] {
  if (depth > 64 || start + 2 > limit)
    throw pemError('Truncated or excessively nested ASN.1 data.');

  const tag = bytes[start] ?? 0;
  let offset = start + 1;
  let length = bytes[offset++]!;

  if (ber && length === 0x80 && tag & 0x20) return parseIndefinite(bytes, start, depth, limit);

  if (length & 0x80) {
    const count = length & 0x7f;

    if (count === 0 || count > 4 || offset + count > limit)
      throw pemError('Invalid ASN.1 length header.');

    length = 0;

    for (let index = 0; index < count; index += 1) {
      length = length * 256 + bytes[offset++]!;
    }
  }

  const valueStart = offset;
  const valueEnd = valueStart + length;

  if (valueEnd > limit) {
    throw pemError('Invalid ASN.1 length.');
  }

  const children: Asn1Node[] = [];

  if (tag & 0x20) {
    while (offset < valueEnd) {
      const [child, next] = parseNode(bytes, offset, depth + 1, valueEnd, ber);

      children.push(child);
      offset = next;
    }
  }

  return [
    { tag, bytes, start, headerEnd: valueStart, valueStart, valueEnd, end: valueEnd, children },
    valueEnd,
  ];
}

function parseIndefinite(
  bytes: Uint8Array,
  start: number,
  depth: number,
  limit: number,
): [Asn1Node, number] {
  const valueStart = start + 2;
  const children: Asn1Node[] = [];
  let offset = valueStart;

  while (offset + 2 > limit || bytes[offset] !== 0 || bytes[offset + 1] !== 0) {
    const [child, next] = parseNode(bytes, offset, depth + 1, limit, true);

    children.push(child);
    offset = next;
  }

  const node = {
    tag: bytes[start] ?? 0,
    bytes,
    start,
    headerEnd: valueStart,
    valueStart,
    valueEnd: offset,
    end: offset + 2,
    children,
  };

  return [node, node.end];
}

export function pemBlocks(source: string): Array<{ bytes: Uint8Array; label: string }> {
  const blocks: Array<{ bytes: Uint8Array; label: string }> = [];
  const nextEnd = endMarkerIndex(source);
  let begin = source.indexOf('-----BEGIN ');

  while (begin !== -1) {
    const labelStart = begin + '-----BEGIN '.length;
    const labelEnd = source.indexOf('-----', labelStart);

    if (labelEnd === -1) break;

    const label = source.slice(labelStart, labelEnd);
    const bodyStart = labelEnd + '-----'.length;
    // Labels hold no dash and at least one character, as in `-----BEGIN ([^-]+)-----`.
    const end = labelEnd > labelStart && !label.includes('-') ? nextEnd(label, bodyStart) : -1;

    if (end > bodyStart) {
      blocks.push({ label: label.trim(), bytes: pemBody(source.slice(bodyStart, end)) });
      begin = source.indexOf('-----BEGIN ', end + `-----END ${label}-----`.length);
    } else begin = source.indexOf('-----BEGIN ', begin + 1);
  }

  return blocks;
}

/**
 * Indexes every `-----END label-----` once; a regex or indexOf per BEGIN rescans the rest of the
 * input. Callers ask with a growing position, so each label's cursor only moves forward.
 */
function endMarkerIndex(source: string): (label: string, after: number) => number {
  const positions = new Map<string, number[]>();
  const cursors = new Map<string, number>();
  let end = source.indexOf('-----END ');

  while (end !== -1) {
    const labelEnd = source.indexOf('-----', end + '-----END '.length);

    if (labelEnd === -1) break;

    const label = source.slice(end + '-----END '.length, labelEnd);

    const list = positions.get(label);

    if (list) list.push(end);
    else positions.set(label, [end]);

    end = source.indexOf('-----END ', end + 1);
  }

  return (label, after) => {
    const list = positions.get(label) ?? [];
    let cursor = cursors.get(label) ?? 0;

    while (cursor < list.length && list[cursor]! <= after) cursor += 1;
    cursors.set(label, cursor);

    return list[cursor] ?? -1;
  };
}

function pemBody(body: string): Uint8Array {
  return base64Bytes(
    body.replace(/^\s*(?:Proc-Type|DEK-Info):[^\r\n]*[\r\n]/gm, '').replace(/\s+/g, ''),
  );
}

/** `openssl ecparam -genkey` writes EC PARAMETERS before the key, which repeats the curve. */
export function keyPemBlocks(source: string): ReturnType<typeof pemBlocks> {
  const blocks = pemBlocks(source);
  const keys = blocks.filter((block) => block.label !== 'EC PARAMETERS');

  return keys.length > 0 ? keys : blocks;
}

export function pemBytes(source: string, label: string): Uint8Array {
  const block = pemBlocks(source).find((candidate) => candidate.label === label);

  if (!block) {
    throw pemError(`No PEM ${label.toLowerCase()} block was found.`);
  }

  return block.bytes;
}

export function valueBytes(node: Asn1Node | undefined): Uint8Array {
  if (!node) {
    return new Uint8Array();
  }

  return new Uint8Array(
    node.bytes.buffer,
    node.bytes.byteOffset + node.valueStart,
    node.valueEnd - node.valueStart,
  );
}

export function oid(node: Asn1Node | undefined): string {
  const arcs: bigint[] = [];
  let value = 0n;

  // Arcs are base-128 bigints; 2.25 UUID OIDs exceed 32 bits.
  for (const byte of valueBytes(node)) {
    value = value * 128n + BigInt(byte & 0x7f);

    if (!(byte & 0x80)) {
      arcs.push(value);
      value = 0n;
    }
  }

  const [first] = arcs;

  if (first === undefined) return '';

  // The first subidentifier packs two arcs; arc 2 takes every value from 80 up.
  const top = first < 80n ? first / 40n : 2n;

  return [top, first - top * 40n, ...arcs.slice(1)].join('.');
}

export function bitStringBytes(node: Asn1Node | undefined): Uint8Array {
  const bytes = valueBytes(node);

  return bytes.slice(1);
}

// BMPString is UTF-16BE; T61String reads as Latin-1, as OpenSSL does; other strings are UTF-8.
const stringEncodings: Record<number, string> = { 0x14: 'latin1', 0x1e: 'utf-16be' };

export function textValue(node: Asn1Node | undefined): string {
  return node ? new TextDecoder(stringEncodings[node.tag] ?? 'utf-8').decode(valueBytes(node)) : '';
}

export function rsaBitsFromBytes(bytes: Uint8Array): number {
  let index = 0;

  while (index < bytes.length - 1 && bytes[index] === 0) index += 1;

  const leading = bytes[index];

  return leading ? (bytes.length - index - 1) * 8 + Math.floor(Math.log2(leading)) + 1 : 0;
}

export function timeString(node: Asn1Node | undefined): string {
  const value = textValue(node);
  const match = value.match(/^(\d{2}|\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/);

  if (!match) throw pemError('Certificate time must be UTC with seconds.');

  const year =
    match[1]!.length === 2
      ? Number(match[1]) + (Number(match[1]) >= 50 ? 1900 : 2000)
      : Number(match[1]);
  const date = new Date(0);

  date.setUTCFullYear(year, Number(match[2]) - 1, Number(match[3]));
  date.setUTCHours(Number(match[4]), Number(match[5]), Number(match[6]), 0);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== Number(match[2]) ||
    date.getUTCDate() !== Number(match[3]) ||
    date.getUTCHours() !== Number(match[4]) ||
    date.getUTCMinutes() !== Number(match[5]) ||
    date.getUTCSeconds() !== Number(match[6])
  )
    throw pemError('Invalid certificate calendar date.');

  return date.toUTCString();
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Reads `timeString` output back; Date.parse would map years below 100 to 19xx or 20xx. */
export function utcStringTime(utc: string): number {
  const match = /(\d+) (\w{3}) (\d{4}) (\d\d):(\d\d):(\d\d)/.exec(utc);

  if (!match) return Number.NaN;

  const date = new Date(0);

  date.setUTCFullYear(Number(match[3]), months.indexOf(match[2]!), Number(match[1]));
  date.setUTCHours(Number(match[4]), Number(match[5]), Number(match[6]), 0);

  return date.getTime();
}

export function oidName(value: string): string {
  return (
    (
      {
        '2.5.4.3': 'CN',
        '2.5.4.5': 'serialNumber',
        '2.5.4.6': 'C',
        '2.5.4.7': 'L',
        '2.5.4.8': 'ST',
        '2.5.4.9': 'street',
        '2.5.4.10': 'O',
        '2.5.4.11': 'OU',
        '2.5.4.17': 'postalCode',
        '1.2.840.113549.1.9.1': 'emailAddress',
        '0.9.2342.19200300.100.1.25': 'DC',
      } as Record<string, string>
    )[value] ?? value
  );
}

export function signatureAlgorithmName(value: string): string {
  return (
    (
      {
        '1.2.840.113549.1.1.1': 'rsaEncryption',
        '1.2.840.113549.1.1.5': 'sha1WithRSAEncryption',
        '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption',
        '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
        '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption',
        '1.2.840.113549.1.1.10': 'RSASSA-PSS',
        '1.3.101.112': 'Ed25519',
        '1.2.840.10045.4.1': 'ecdsa-with-SHA1',
        '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256',
        '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384',
        '1.2.840.10045.4.3.4': 'ecdsa-with-SHA512',
      } as Record<string, string>
    )[value] ?? value
  );
}

export function webCryptoSignatureHash(value: string): string | undefined {
  return (
    {
      '1.2.840.113549.1.1.5': 'SHA-1',
      '1.2.840.113549.1.1.11': 'SHA-256',
      '1.2.840.113549.1.1.12': 'SHA-384',
      '1.2.840.113549.1.1.13': 'SHA-512',
      '1.2.840.10045.4.1': 'SHA-1',
      '1.2.840.10045.4.3.2': 'SHA-256',
      '1.2.840.10045.4.3.3': 'SHA-384',
      '1.2.840.10045.4.3.4': 'SHA-512',
    } as Record<string, string>
  )[value];
}

function webCryptoHashName(algorithm: string): string {
  if (algorithm === 'sha1') return 'SHA-1';
  if (algorithm === 'sha512') return 'SHA-512';

  return 'SHA-256';
}

export async function fingerprint(
  bytes: Uint8Array,
  algorithm: 'sha1' | 'sha256' | 'sha512',
): Promise<string> {
  const digest = await globalThis.crypto?.subtle?.digest(
    webCryptoHashName(algorithm),
    toArrayBuffer(bytes),
  );

  if (!digest) {
    throw pemError('Web Crypto is unavailable in this runtime.');
  }

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
}

function base64Bytes(value: string): Uint8Array {
  return base64Decode(value.replace(/\s+/g, ''));
}

export function ascii(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

export function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function requiredPem(value: string, label: string): string {
  const input = value.trim();

  if (!input) throw pemError(`${label} input is required.`);
  if (input.length > 1024 * 1024) throw pemError('PEM text must be no larger than 1 MiB.');

  return input;
}

export function pemError(message: string): FunctionError {
  return new FunctionError('INVALID_PEM', message);
}
