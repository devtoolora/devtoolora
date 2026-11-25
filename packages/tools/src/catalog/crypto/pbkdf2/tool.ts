import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import { base64Decode, utf8Bytes } from '@devtoolora/functions/binary';
import { derivePbkdf2, encodeBytes, type Pbkdf2Hash } from '@devtoolora/functions/crypto';
import { summarizeFindings } from '@devtoolora/functions/web';
import { withToolErrorAsync } from '../../../adapters/errors';
import { browserSafeCapabilities, cryptoTextResult } from '../shared';

const hashes: Pbkdf2Hash[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
const encodings = ['hex', 'base64', 'base64url'] as const;
const defaults = {
  encoding: 'hex',
  hash: 'SHA-256',
  iterations: '600000',
  length: '32',
  password: 'correct horse battery staple',
  salt: 'random-salt-1234',
  saltEncoding: 'utf8',
};

export const pbkdf2Tool: ToolDefinition = {
  autoRun: false,
  capabilities: browserSafeCapabilities,
  category: 'Crypto',
  description:
    'Derive a key from a password with PBKDF2 (HMAC-SHA-1/256/384/512): choose the salt, iterations and length, and get findings for weak settings.',
  fields: [
    { id: 'password', label: 'Password', required: true, type: 'password' },
    { id: 'salt', label: 'Salt', type: 'text' },
    {
      defaultValue: 'utf8',
      id: 'saltEncoding',
      label: 'Salt encoding',
      options: [
        { label: 'UTF-8', value: 'utf8' },
        { label: 'Hex', value: 'hex' },
        { label: 'Base64', value: 'base64' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'SHA-256',
      id: 'hash',
      label: 'Hash',
      options: hashes.map((hash) => ({ label: hash, value: hash })),
      type: 'select',
    },
    { defaultValue: '600000', id: 'iterations', label: 'Iterations', type: 'number' },
    { defaultValue: '32', id: 'length', label: 'Key length (bytes)', type: 'number' },
    {
      defaultValue: 'hex',
      id: 'encoding',
      label: 'Output',
      options: [
        { label: 'Hex', value: 'hex' },
        { label: 'Base64', value: 'base64' },
        { label: 'Base64URL', value: 'base64url' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'pbkdf2',
  inputKind: 'none',
  keywords: ['pbkdf2', 'key derivation', 'kdf', 'password', 'salt', 'iterations', 'rfc 2898'],
  name: 'PBKDF2 Key Derivation',
  outputKind: 'text',
  relatedToolIds: ['aes-encrypt', 'hmac', 'hash', 'bcrypt-hash', 'argon2-hash'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) => withToolErrorAsync(() => runPbkdf2(fields)),
  samples: [
    { fields: defaults, label: 'OWASP default (SHA-256, 600,000)' },
    {
      fields: {
        ...defaults,
        hash: 'SHA-1',
        iterations: '1',
        length: '20',
        password: 'password',
        salt: 'salt',
      },
      label: 'RFC 6070 vector 1',
    },
    {
      fields: {
        ...defaults,
        hash: 'SHA-1',
        iterations: '4096',
        length: '20',
        password: 'password',
        salt: 'salt',
      },
      label: 'RFC 6070 vector 4,096 iterations',
    },
    {
      fields: {
        ...defaults,
        encoding: 'base64',
        hash: 'SHA-512',
        iterations: '220000',
        length: '64',
      },
      label: 'SHA-512 with Base64 output',
    },
    {
      fields: { ...defaults, salt: '00112233445566778899aabbccddeeff', saltEncoding: 'hex' },
      label: 'Hex salt',
    },
    {
      fields: { ...defaults, hash: 'SHA-384', iterations: '220000', length: '64' },
      label: 'SHA-384 with a 64-byte key',
    },
  ],
  sensitiveInput: true,
  supportsSelection: false,
};

async function runPbkdf2(fields: Record<string, string>): Promise<ToolResult> {
  const hash = hashes.find((candidate) => candidate === (fields.hash || 'SHA-256'));
  const encoding = encodings.find((candidate) => candidate === (fields.encoding || 'hex'));

  if (!hash) throw new ToolError('Choose SHA-1, SHA-256, SHA-384 or SHA-512.');
  if (!encoding) throw new ToolError('Choose hex, Base64 or Base64URL output.');

  const iterations = Number(fields.iterations?.trim() || '600000');
  const { findings, key } = await derivePbkdf2({
    hash,
    iterations,
    keyLength: Number(fields.length?.trim() || '32'),
    password: fields.password ?? '',
    salt: saltBytes(fields.salt ?? '', fields.saltEncoding || 'utf8'),
  });
  const summary = `PBKDF2-${hash} · ${iterations.toLocaleString('en-US')} iterations · ${key.length} ${key.length === 1 ? 'byte' : 'bytes'} · ${encoding}`;

  return cryptoTextResult(
    'pbkdf2',
    encodeBytes(key, encoding),
    findings.length > 0
      ? `${summary} · ${summarizeFindings(findings)}: ${findings.map((finding) => finding.message).join(' ')}`
      : summary,
  );
}

function saltBytes(salt: string, encoding: string): Uint8Array {
  if (salt.length > 1_024) throw new ToolError('Salt exceeds 1,024 characters.');

  if (encoding === 'utf8') return utf8Bytes(salt);

  if (encoding === 'hex') {
    const digits = salt.replace(/\s+/g, '');

    if (!/^(?:[0-9a-fA-F]{2})*$/.test(digits)) throw new ToolError('Salt must be hex digits.');

    return Uint8Array.from(digits.match(/../g) ?? [], (pair) => parseInt(pair, 16));
  }

  if (encoding === 'base64') {
    try {
      return base64Decode(salt);
    } catch {
      throw new ToolError('Salt must be valid Base64.');
    }
  }

  throw new ToolError('Choose UTF-8, hex or Base64 salt encoding.');
}
