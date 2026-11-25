import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import {
  hashArgon2,
  parseArgon2Salt,
  verifyArgon2,
  type Argon2Params,
  type Argon2Variant,
} from '@devtoolora/functions/crypto';
import { withToolErrorAsync } from '../../../adapters/errors';
import { rangeField } from '../../../adapters/fields';
import { browserSafeCapabilities } from '../shared';

const vector =
  '$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$CTFhFdXPJO1aFaMaO6Mm5c8y7cJHAph8ArZWb2GRPPc';
const defaults = {
  hash: '',
  hashLength: '32',
  iterations: '2',
  memory: '19456',
  mode: 'hash',
  parallelism: '1',
  password: 'correct horse battery staple',
  salt: '',
  variant: 'argon2id',
};
const verifyDefaults = { ...defaults, hash: vector, mode: 'verify', password: 'password' };
const hashOnly = { field: 'mode', is: ['hash'] };

export const argon2HashTool: ToolDefinition = {
  autoRun: false,
  capabilities: browserSafeCapabilities,
  category: 'Crypto',
  description:
    'Hash a password with Argon2id, Argon2i or Argon2d into a PHC string, or verify a password against one, entirely in your browser.',
  fields: [
    {
      defaultValue: 'hash',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Hash', value: 'hash' },
        { label: 'Verify', value: 'verify' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    { id: 'password', label: 'Password', required: true, type: 'password' },
    {
      defaultValue: 'argon2id',
      id: 'variant',
      label: 'Variant',
      options: [
        { label: 'Argon2id', value: 'argon2id' },
        { label: 'Argon2i', value: 'argon2i' },
        { label: 'Argon2d', value: 'argon2d' },
      ],
      type: 'select',
      visibleWhen: hashOnly,
    },
    rangeField({
      defaultValue: '19456',
      id: 'memory',
      label: 'Memory (KiB)',
      max: 65536,
      min: 1024,
      step: 1024,
      visibleWhen: hashOnly,
    }),
    rangeField({
      defaultValue: '2',
      id: 'iterations',
      label: 'Iterations',
      max: 10,
      min: 1,
      visibleWhen: hashOnly,
    }),
    rangeField({
      defaultValue: '1',
      id: 'parallelism',
      label: 'Parallelism',
      max: 4,
      min: 1,
      visibleWhen: hashOnly,
    }),
    rangeField({
      defaultValue: '32',
      id: 'hashLength',
      label: 'Hash length (bytes)',
      max: 64,
      min: 16,
      visibleWhen: hashOnly,
    }),
    {
      defaultValue: '',
      help: 'Leave blank for 16 random bytes. Otherwise hex or Base64 of 8-64 bytes.',
      id: 'salt',
      label: 'Salt',
      type: 'text',
      visibleWhen: hashOnly,
    },
    {
      defaultValue: '',
      id: 'hash',
      label: 'Hash',
      rows: 3,
      type: 'textarea',
      visibleWhen: { field: 'mode', is: ['verify'] },
    },
  ],
  freshResults: true,
  id: 'argon2-hash',
  inputKind: 'none',
  keywords: [
    'argon2',
    'argon2id',
    'argon2i',
    'argon2d',
    'hash',
    'verify',
    'password',
    'phc',
    'kdf',
  ],
  name: 'Argon2 Hash & Verify',
  outputKind: 'text',
  relatedToolIds: ['bcrypt-hash', 'pbkdf2', 'password-strength'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) => withToolErrorAsync(() => runArgon2(fields)),
  samples: [
    { fields: defaults, label: 'OWASP default (Argon2id, 19 MiB)' },
    { fields: { ...defaults, variant: 'argon2i' }, label: 'Argon2i' },
    { fields: { ...defaults, variant: 'argon2d' }, label: 'Argon2d' },
    {
      fields: { ...defaults, salt: '736f6d6573616c74' },
      label: 'Fixed salt (hex), same output every run',
    },
    { fields: verifyDefaults, label: 'Verify a known hash' },
    { fields: { ...verifyDefaults, password: 'Password' }, label: 'Wrong password' },
  ],
  sensitiveInput: true,
  supportsSelection: false,
};

async function runArgon2(fields: Record<string, string>): Promise<ToolResult> {
  const mode = fields.mode || 'hash';
  const password = fields.password ?? '';

  if (mode === 'verify') {
    const { match, params } = await verifyArgon2(password, fields.hash ?? '');

    return {
      language: 'plaintext',
      summary: `${describe(params)} · ${match ? 'password matches' : 'password does not match'}`,
      text: match ? 'Match' : 'No match',
      verdict: match ? 'match' : 'mismatch',
    };
  }

  if (mode !== 'hash') throw new ToolError('Choose hash or verify mode.');

  const variant = fields.variant || 'argon2id';

  if (!isVariant(variant)) throw new ToolError('Choose Argon2id, Argon2i or Argon2d.');

  const params: Argon2Params = {
    hashLength: numberField(fields.hashLength, 32),
    iterations: numberField(fields.iterations, 2),
    memory: numberField(fields.memory, 19456),
    parallelism: numberField(fields.parallelism, 1),
    variant,
  };
  const salt = fields.salt?.trim() ? parseArgon2Salt(fields.salt) : undefined;
  const { hash, ms } = await hashArgon2(password, params, salt);

  return {
    language: 'plaintext',
    summary: `${describe(params)} · took ${ms} ms.`,
    text: hash,
  };
}

function isVariant(value: string): value is Argon2Variant {
  return value === 'argon2id' || value === 'argon2i' || value === 'argon2d';
}

function numberField(value: string | undefined, fallback: number): number {
  return value?.trim() ? Number(value.trim()) : fallback;
}

function describe({ iterations, memory, variant }: Argon2Params): string {
  return `${variant} · ${Number((memory / 1024).toFixed(2))} MiB · ${iterations} ${iterations === 1 ? 'pass' : 'passes'}`;
}
