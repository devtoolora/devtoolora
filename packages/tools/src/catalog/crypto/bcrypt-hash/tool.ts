import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import { hashBcrypt, verifyBcrypt } from '@devtoolora/functions/crypto';
import { withToolErrorAsync } from '../../../adapters/errors';
import { browserSafeCapabilities } from '../shared';

const vector = '$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW';
const defaults = { cost: '10', hash: '', mode: 'hash', password: 'correct horse battery staple' };
const verifyDefaults = { ...defaults, hash: vector, mode: 'verify', password: 'U*U' };

export const bcryptHashTool: ToolDefinition = {
  autoRun: false,
  capabilities: browserSafeCapabilities,
  category: 'Crypto',
  description:
    'Hash a password with bcrypt ($2b$, cost 4-14) or verify a password against a $2a$, $2b$ or $2y$ hash, entirely in your browser.',
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
      defaultValue: '10',
      id: 'cost',
      label: 'Cost (4-14)',
      type: 'number',
      visibleWhen: { field: 'mode', is: ['hash'] },
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
  id: 'bcrypt-hash',
  inputKind: 'none',
  keywords: ['bcrypt', 'hash', 'verify', 'password', 'salt', 'cost', 'blowfish', '$2b$'],
  name: 'Bcrypt Hash & Verify',
  outputKind: 'text',
  relatedToolIds: ['pbkdf2', 'password-strength', 'hash', 'argon2-hash'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) => withToolErrorAsync(() => runBcrypt(fields)),
  samples: [
    { fields: defaults, label: 'Hash at cost 10' },
    { fields: { ...defaults, cost: '4' }, label: 'Fast hash at cost 4' },
    { fields: { ...defaults, cost: '12', password: 'S3cure!pass' }, label: 'Hash at cost 12' },
    { fields: verifyDefaults, label: 'Verify a known $2a$ hash' },
    { fields: { ...verifyDefaults, password: 'U*V' }, label: 'Wrong password' },
    { fields: { ...verifyDefaults, password: ' U*U' }, label: 'Leading space changes the result' },
  ],
  sensitiveInput: true,
  supportsSelection: false,
};

async function runBcrypt(fields: Record<string, string>): Promise<ToolResult> {
  const mode = fields.mode || 'hash';
  const password = fields.password ?? '';

  if (mode === 'verify') {
    const { match, prefix } = await verifyBcrypt(password, (fields.hash ?? '').trim());

    return {
      language: 'plaintext',
      summary: `${prefix} hash · ${match ? 'password matches' : 'password does not match'}`,
      text: match ? 'Match' : 'No match',
      verdict: match ? 'match' : 'mismatch',
    };
  }

  if (mode !== 'hash') throw new ToolError('Choose hash or verify mode.');

  const cost = Number(fields.cost?.trim() || '10');
  const { hash, ms } = await hashBcrypt(password, cost);

  return {
    language: 'plaintext',
    summary: `Cost ${cost} · 2^${cost} rounds · took ${ms} ms`,
    text: hash,
  };
}
