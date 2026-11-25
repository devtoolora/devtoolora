import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import {
  generateMnemonic,
  mnemonicToSeed,
  validateMnemonic,
  type MnemonicLength,
} from '@devtoolora/functions/crypto';
import { withToolErrorAsync } from '../../../adapters/errors';
import { browserSafeCapabilities, countLabel, cryptoTextResult } from '../shared';

const wordCounts: MnemonicLength[] = [12, 15, 18, 21, 24];
const abandon12 = 'abandon '.repeat(12).trim();
const referenceMnemonic = `${'abandon '.repeat(11)}about`;
const sampleDefaults = {
  count: '1',
  mode: 'validate',
  passphrase: '',
  showSeed: 'false',
  words: '12',
};

export const bip39Tool: ToolDefinition = {
  autoRun: false,
  capabilities: browserSafeCapabilities,
  category: 'Crypto',
  description:
    'Generate BIP39 mnemonic phrases or validate one: normalization, word list and checksum checks, the underlying entropy, and the PBKDF2 seed with an optional passphrase.',
  fields: [
    {
      defaultValue: 'validate',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Validate', value: 'validate' },
        { label: 'Generate', value: 'generate' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '12',
      id: 'words',
      label: 'Words',
      options: wordCounts.map((count) => ({ label: String(count), value: String(count) })),
      type: 'select',
      visibleWhen: { field: 'mode', is: ['generate'] },
    },
    {
      defaultValue: '1',
      id: 'count',
      label: 'Count',
      type: 'number',
      visibleWhen: { field: 'mode', is: ['generate'] },
    },
    {
      defaultValue: '',
      id: 'passphrase',
      label: 'Passphrase (optional)',
      type: 'password',
    },
    { defaultValue: 'false', id: 'showSeed', label: 'Show seed', type: 'checkbox' },
  ],
  freshResults: true,
  id: 'bip39',
  inputKind: 'optionalText',
  inputPresentation: {
    label: 'Mnemonic',
    placeholder: 'Twelve to twenty-four BIP39 words',
  },
  inputVisibleWhen: { field: 'mode', is: ['validate'] },
  keywords: ['bip39', 'mnemonic', 'seed phrase', 'recovery phrase', 'wallet', 'entropy', 'bitcoin'],
  name: 'BIP39 Mnemonic Generator & Validator',
  outputKind: 'text',
  relatedToolIds: ['password-generator', 'random-token', 'pbkdf2'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolErrorAsync(() =>
      fields.mode === 'generate' ? runGenerate(fields) : runValidate(text, fields),
    ),
  samples: [
    {
      fields: { ...sampleDefaults, passphrase: 'TREZOR', showSeed: 'true' },
      label: 'Validate the reference mnemonic with its seed',
      text: referenceMnemonic,
    },
    {
      fields: sampleDefaults,
      label: 'Validate a 12-word mnemonic',
      text: 'legal winner thank year wave sausage worth useful legal winner thank yellow',
    },
    { fields: sampleDefaults, label: 'Validate a bad checksum', text: abandon12 },
    {
      fields: sampleDefaults,
      label: 'Validate with a typo',
      text: `${'abandon '.repeat(10)}abouts about`,
    },
    { fields: { ...sampleDefaults, mode: 'generate' }, label: 'Generate 12 words' },
    {
      fields: { ...sampleDefaults, count: '3', mode: 'generate', words: '24' },
      label: 'Generate three 24-word mnemonics',
    },
  ],
  sensitiveInput: true,
  supportsSelection: false,
};

async function runValidate(text: string, fields: Record<string, string>): Promise<ToolResult> {
  const report = await validateMnemonic(text);
  const { checksumValid, entropyHex, unknownWords, wordCount, wordCountValid } = report;
  const lines = [
    `Words: ${wordCount} (${wordCountValid ? 'valid' : 'invalid'} count)`,
    `Checksum: ${checksumValid ? 'valid' : 'invalid'}`,
    ...(entropyHex ? [`Entropy: ${entropyHex}`] : []),
    `Unknown words: ${unknownWords.length ? unknownWords.map((item) => `${item.word} (word ${item.position})`).join(', ') : 'none'}`,
  ];

  if (fields.showSeed === 'true')
    lines.push(`Seed: ${hex(await mnemonicToSeed(text, fields.passphrase ?? ''))}`);

  const parts = [countLabel(wordCount, 'word')];

  if (entropyHex && checksumValid) parts.push(`${entropyHex.length * 4}-bit entropy`);
  if (!checksumValid) parts.push('checksum invalid');
  if (!wordCountValid) parts.push('invalid word count');
  if (unknownWords.length) parts.push(countLabel(unknownWords.length, 'unknown word'));
  if (checksumValid) parts.push('checksum valid');

  return cryptoTextResult('bip39', lines.join('\n'), parts.join(' · '));
}

async function runGenerate(fields: Record<string, string>): Promise<ToolResult> {
  const words = Number(fields.words || '12');
  const countText = fields.count?.trim() || '1';
  const count = Number(countText);

  if (!wordCounts.some((item) => item === words))
    throw new ToolError('Words must be 12, 15, 18, 21 or 24.');
  if (!/^[0-9]+$/.test(countText) || count < 1 || count > 10)
    throw new ToolError('Count must be an integer between 1 and 10.');

  const lines: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const mnemonic = await generateMnemonic(words as MnemonicLength);

    lines.push(mnemonic);
    if (fields.showSeed === 'true')
      lines.push(`Seed: ${hex(await mnemonicToSeed(mnemonic, fields.passphrase ?? ''))}`);
  }

  return cryptoTextResult(
    'bip39',
    lines.join('\n'),
    `${countLabel(count, 'mnemonic')} · ${words} words`,
  );
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
