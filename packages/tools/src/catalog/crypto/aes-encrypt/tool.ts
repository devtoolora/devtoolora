import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import { decryptAesGcm, encryptAesGcm } from '@devtoolora/functions/crypto';
import { base64Encode, parseDataUri, utf8Bytes } from '@devtoolora/functions/binary';
import { withToolErrorAsync } from '../../../adapters/errors';
import { browserSafeCapabilities, cryptoTextResult } from '../shared';

const MAX_TEXT = 1_048_576;
const DEFAULT_ITERATIONS = 600_000;
const sampleEnvelope =
  'AQAAJxDgXDH3y+RhjjICwNjb6pimdCdVgaqm5gReMYTccbKssevSqIGnkviZJg4Zq/JQrGk8ZzFN7I2pIfE=';
const sampleDefaults = {
  fileName: 'decrypted.bin',
  iterations: '10000',
  mode: 'encrypt',
  output: 'text',
  passphrase: 'correct horse battery staple',
};

export const aesEncryptTool: ToolDefinition = {
  autoRun: false,
  capabilities: browserSafeCapabilities,
  category: 'Crypto',
  description:
    'Encrypt and decrypt text or a local file with AES-256-GCM and a passphrase: PBKDF2-SHA-256 key derivation, a random salt and IV, and a self-describing envelope.',
  fields: [
    {
      defaultValue: 'encrypt',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Encrypt', value: 'encrypt' },
        { label: 'Decrypt', value: 'decrypt' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      id: 'passphrase',
      label: 'Passphrase',
      placeholder: 'local passphrase',
      required: true,
      type: 'password',
    },
    {
      defaultValue: String(DEFAULT_ITERATIONS),
      help: 'PBKDF2-SHA-256 iterations, 1,000 to 10,000,000. The count is stored in the envelope, so decryption needs no setting.',
      id: 'iterations',
      label: 'PBKDF2 iterations',
      type: 'number',
      visibleWhen: { field: 'mode', is: ['encrypt'] },
    },
    {
      id: 'file',
      label: 'Local file (encrypt; takes precedence over text)',
      maxBytes: 5 * 1024 * 1024,
      type: 'file',
      visibleWhen: { field: 'mode', is: ['encrypt'] },
    },
    {
      defaultValue: 'text',
      id: 'output',
      label: 'Decrypt output',
      options: [
        { label: 'Text', value: 'text' },
        { label: 'File', value: 'file' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'mode', is: ['decrypt'] },
    },
    {
      defaultValue: 'decrypted.bin',
      id: 'fileName',
      label: 'Download filename',
      type: 'text',
      visibleWhen: [
        { field: 'mode', is: ['decrypt'] },
        { field: 'output', is: ['file'] },
      ],
    },
  ],
  freshResults: true,
  id: 'aes-encrypt',
  inputKind: 'optionalText',
  inputPresentation: {
    byMode: {
      decrypt: { label: 'Encrypted envelope', placeholder: 'Paste the Base64 envelope' },
    },
    label: 'Text to encrypt',
    placeholder: 'Text to encrypt, or choose a file',
  },
  keywords: ['aes', 'aes-gcm', 'aes-256', 'encrypt', 'decrypt', 'cipher', 'pbkdf2', 'passphrase'],
  name: 'AES Encrypt & Decrypt',
  outputKind: 'text',
  relatedToolIds: ['hash', 'hmac', 'random-token'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => withToolErrorAsync(() => runAes(text, fields)),
  samples: [
    {
      fields: sampleDefaults,
      label: 'Encrypt a greeting',
      text: 'Hello, world!',
    },
    {
      fields: sampleDefaults,
      label: 'Encrypt JSON',
      text: '{"user":"ada","scopes":["read","write"]}',
    },
    {
      fields: sampleDefaults,
      label: 'Encrypt Unicode text',
      text: 'Příliš žluťoučký kůň 🐎',
    },
    {
      fields: { ...sampleDefaults, mode: 'decrypt' },
      label: 'Decrypt a pinned envelope',
      text: sampleEnvelope,
    },
    {
      fields: { ...sampleDefaults, mode: 'decrypt', output: 'file' },
      label: 'Decrypt to a file',
      text: sampleEnvelope,
    },
    {
      fields: { ...sampleDefaults, iterations: String(DEFAULT_ITERATIONS) },
      label: 'Encrypt with the default 600,000 iterations',
      text: 'Hello, world!',
    },
  ],
  sensitiveInput: true,
  supportsSelection: true,
};

export const aesDecryptTool: ToolDefinition = {
  ...aesEncryptTool,
  aliasOf: 'aes-encrypt',
  description: 'Decrypt an AES-256-GCM Base64 envelope with its passphrase, as text or a file.',
  fields: aesEncryptTool.fields?.map((field) =>
    field.id === 'mode' ? { ...field, defaultValue: 'decrypt' } : field,
  ),
  id: 'aes-decrypt',
  name: 'AES Decrypt',
};

async function runAes(text: string, fields: Record<string, string>): Promise<ToolResult> {
  const mode = fields.mode || 'encrypt';
  const passphrase = fields.passphrase ?? '';

  if (mode !== 'encrypt' && mode !== 'decrypt') throw new ToolError('Choose Encrypt or Decrypt.');

  if (mode === 'decrypt') return decryptResult(text, passphrase, fields);

  const bytes = fields.file ? parseDataUri(fields.file).bytes : textBytes(text);
  const iterations = fields.iterations?.trim() ? Number(fields.iterations) : DEFAULT_ITERATIONS;
  const envelope = await encryptAesGcm(bytes, passphrase, { iterations });

  return cryptoTextResult(
    'encrypted',
    envelope,
    `AES-256-GCM · ${counted(iterations, 'PBKDF2 iteration')} · ${counted(bytes.length, 'plaintext byte')} · ${counted(envelope.length, 'envelope character')}`,
  );
}

async function decryptResult(
  text: string,
  passphrase: string,
  fields: Record<string, string>,
): Promise<ToolResult> {
  const output = fields.output || 'text';

  if (output !== 'text' && output !== 'file') throw new ToolError('Choose Text or File output.');

  const { bytes, iterations } = await decryptAesGcm(text, passphrase);
  const head = `AES-256-GCM · ${counted(iterations, 'PBKDF2 iteration')} · ${counted(bytes.length, 'decrypted byte')}`;

  if (output === 'file') {
    const fileName = fields.fileName?.trim() || 'decrypted.bin';

    return {
      artifact: { base64: base64Encode(bytes), fileName, mimeType: 'application/octet-stream' },
      language: 'plaintext',
      summary: head,
      text: `Decrypted ${counted(bytes.length, 'byte')} · saved as ${fileName}`,
    };
  }

  return cryptoTextResult('decrypted', strictUtf8(bytes), head);
}

function textBytes(text: string): Uint8Array {
  if (text.length > MAX_TEXT) throw new ToolError('Text exceeds 1,048,576 characters.');

  return utf8Bytes(text);
}

function strictUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new ToolError('Decrypted bytes are not UTF-8 text; choose File output.');
  }
}

function counted(count: number, singular: string): string {
  return `${count.toLocaleString('en-US')} ${singular}${count === 1 ? '' : 's'}`;
}
