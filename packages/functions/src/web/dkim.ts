import { base64Decode, base64Encode } from '../binary/base64';
import { FunctionError } from '../errors';
import type { DmarcTag } from './dmarc';
import { sortFindings, type Finding } from './findings';
import { dnsNamePattern } from './spf';

export type DkimBuildOptions = {
  domain: string;
  keyType?: string;
  publicKey: string;
  selector: string;
  testing?: boolean;
};

const maxKeyLength = 16_384;
const base64Body = /^[A-Za-z0-9+/]+={0,2}$/;
const explanations: Record<string, string> = {
  g: 'Deprecated granularity of the key; receivers ignore it.',
  h: 'Hash algorithms the key accepts.',
  k: 'Key type: rsa or ed25519.',
  n: 'Free-text notes for humans.',
  p: 'Public key in base64; empty means the key is revoked.',
  s: 'Service types the key applies to; * or email.',
  t: 'Flags: y marks the domain as testing, s requires strict domain matching.',
  v: 'Protocol version; DKIM1.',
};

function readLength(bytes: Uint8Array, position: number): { length: number; next: number } {
  const first = bytes[position];

  if (first === undefined)
    throw new FunctionError('INVALID_DKIM', 'Key is truncated or not valid DER.');
  if (first < 0x80) return { length: first, next: position + 1 };

  const count = first & 0x7f;
  let length = 0;

  for (let index = 1; index <= count; index += 1)
    length = length * 256 + (bytes[position + index] ?? 0);

  return { length, next: position + 1 + count };
}

function rsaModulusBits(bytes: Uint8Array): number {
  let position = 0;

  const enter = (tag: number, skipBody: boolean) => {
    if (bytes[position] !== tag)
      throw new FunctionError('INVALID_DKIM', 'Key is not an RSA SPKI structure.');

    const { length, next } = readLength(bytes, position + 1);

    if (next + length > bytes.length)
      throw new FunctionError('INVALID_DKIM', 'Key is truncated or not valid DER.');

    position = skipBody ? next + length : next;

    return length;
  };

  enter(0x30, false);
  enter(0x30, true);
  enter(0x03, false);
  position += 1;
  enter(0x30, false);

  const length = enter(0x02, false);

  return (length - (bytes[position] === 0 ? 1 : 0)) * 8;
}

function keyBitsOf(keyType: string, body: string): number {
  const bytes = base64Decode(body);

  if (keyType === 'ed25519') {
    if (bytes.length !== 32) throw new FunctionError('INVALID_DKIM', 'Ed25519 keys are 32 bytes.');

    return 256;
  }

  return rsaModulusBits(bytes);
}

const stripFor = (name: string, value: string) =>
  name === 'p' ? value.replace(/\s+/g, '') : value.trim();

export function parseDkim(record: string): {
  findings: Finding[];
  keyBits?: number;
  keyType: string;
  tags: DmarcTag[];
} {
  const tags = record
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part): DmarcTag => {
      const index = part.indexOf('=');
      const name = (index < 0 ? part : part.slice(0, index)).trim().toLowerCase();

      return {
        explanation: explanations[name] ?? 'Unknown tag; receivers ignore it.',
        name,
        value: index < 0 ? '' : stripFor(name, part.slice(index + 1)),
      };
    });
  const value = (name: string) => tags.find((tag) => tag.name === name)?.value;
  const keyType = (value('k') ?? 'rsa').toLowerCase();
  const key = value('p');
  const findings: Finding[] = [];
  let keyBits: number | undefined;

  if (key === '')
    return {
      findings: [{ level: 'high', message: 'Empty p tag; the key is revoked.' }],
      keyType,
      tags,
    };

  if (key === undefined) findings.push({ level: 'high', message: 'Required p tag is missing.' });
  else if (!base64Body.test(key) || key.length % 4 !== 0)
    findings.push({ level: 'high', message: 'The p tag is not valid base64.' });
  else {
    try {
      keyBits = keyBitsOf(keyType, key);
    } catch (error) {
      findings.push({
        level: 'high',
        message: error instanceof Error ? error.message : 'The p tag is not a valid key.',
      });
    }
  }

  if (keyType === 'rsa' && keyBits !== undefined && keyBits < 2048)
    findings.push({
      level: 'medium',
      message: `RSA key is ${keyBits.toLocaleString('en-US')} bits; use at least 2,048.`,
    });
  if (value('t')?.split(':').includes('y'))
    findings.push({
      level: 'info',
      message: 'Testing mode (t=y); receivers should not treat failures as errors.',
    });
  if (value('g') !== undefined)
    findings.push({ level: 'low', message: 'The g tag is deprecated and ignored.' });

  return { findings: sortFindings(findings), keyBits, keyType, tags };
}

function normalizeKey(publicKey: string, keyType: string): string {
  const pem = /^-----BEGIN PUBLIC KEY-----([\s\S]*)-----END PUBLIC KEY-----$/.exec(
    publicKey.trim(),
  );
  const body = (pem?.[1] ?? publicKey).replace(/\s+/g, '');
  const invalid = new FunctionError(
    'INVALID_DKIM',
    'Public key must be an SPKI PEM block or its base64 body.',
  );

  if (!base64Body.test(body) || body.length % 4 !== 0) throw invalid;

  try {
    const bytes = base64Decode(body);

    // Ed25519 DKIM keys are the raw 32 bytes, the tail of a 44-byte SPKI.
    if (keyType === 'ed25519') return base64Encode(bytes.length === 44 ? bytes.slice(12) : bytes);

    rsaModulusBits(bytes);
  } catch {
    throw invalid;
  }

  return body;
}

export function buildDkim(options: DkimBuildOptions): {
  host: string;
  keyBits?: number;
  record: string;
  zone: string;
} {
  const keyType = options.keyType || 'rsa';
  const selector = options.selector.trim();
  const domain = options.domain.trim().replace(/\.$/, '');

  if (keyType !== 'rsa' && keyType !== 'ed25519')
    throw new FunctionError('INVALID_DKIM', 'Key type must be rsa or ed25519.');
  if (options.publicKey.length > maxKeyLength)
    throw new FunctionError('INPUT_TOO_LARGE', 'Public key exceeds 16,384 characters.');
  if (
    !selector
      .split('.')
      .every((part) => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(part))
  )
    throw new FunctionError('INVALID_DKIM', 'Selector must be a DNS label.');
  if (!dnsNamePattern.test(domain) || !domain.includes('.'))
    throw new FunctionError('INVALID_DKIM', 'Domain must be a valid DNS name such as example.com.');

  const key = normalizeKey(options.publicKey, keyType);
  const record = `v=DKIM1; k=${keyType};${options.testing ? ' t=y;' : ''} p=${key}`;
  const host = `${selector}._domainkey.${domain}`;
  const chunks = record.match(/.{1,255}/g) ?? [];

  return {
    host,
    keyBits: keyBitsOf(keyType, key),
    record,
    zone: `${host}. IN TXT ( ${chunks.map((chunk) => `"${chunk}"`).join(' ')} )`,
  };
}
