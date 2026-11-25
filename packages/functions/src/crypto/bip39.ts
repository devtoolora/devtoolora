import { utf8Bytes } from '../binary';
import { FunctionError } from '../errors';
import { bip39Words } from './bip39Words';
import { subtle } from './jwtKeyEncoding';
import { randomBytes } from './primitives';

export type MnemonicLength = 12 | 15 | 18 | 21 | 24;

type MnemonicReport = {
  checksumValid: boolean;
  entropyHex?: string;
  unknownWords: Array<{ position: number; word: string }>;
  wordCount: number;
  wordCountValid: boolean;
};

const MAX_INPUT = 1024;
const wordIndex = new Map(bip39Words.map((word, index) => [word, index]));

export async function generateMnemonic(words: MnemonicLength): Promise<string> {
  return mnemonicFromEntropy(randomBytes((words * 4) / 3));
}

export async function mnemonicFromEntropy(entropy: Uint8Array): Promise<string> {
  if (![16, 20, 24, 28, 32].includes(entropy.length))
    throw bip39Error('Entropy must be 16, 20, 24, 28 or 32 bytes.');

  const checksumBits = entropy.length / 4;
  const bits = toBits(entropy) + toBits(await sha256(entropy)).slice(0, checksumBits);
  const words: string[] = [];

  for (let offset = 0; offset < bits.length; offset += 11)
    words.push(bip39Words[parseInt(bits.slice(offset, offset + 11), 2)] ?? '');

  return words.join(' ');
}

export async function validateMnemonic(mnemonic: string): Promise<MnemonicReport> {
  const words = splitMnemonic(mnemonic);
  const wordCountValid = words.length >= 12 && words.length <= 24 && words.length % 3 === 0;
  const unknownWords = words.flatMap((word, index) =>
    wordIndex.has(word) ? [] : [{ position: index + 1, word }],
  );
  const report: MnemonicReport = {
    checksumValid: false,
    unknownWords,
    wordCount: words.length,
    wordCountValid,
  };

  if (!wordCountValid || unknownWords.length > 0) return report;

  const bits = words
    .map((word) => (wordIndex.get(word) ?? 0).toString(2).padStart(11, '0'))
    .join('');
  const entropyLength = (bits.length * 32) / 33 / 8;
  const entropy = Uint8Array.from(
    Array.from({ length: entropyLength }, (_, index) =>
      parseInt(bits.slice(index * 8, index * 8 + 8), 2),
    ),
  );

  return {
    ...report,
    checksumValid: (await mnemonicFromEntropy(entropy)) === words.join(' '),
    entropyHex: toHex(entropy),
  };
}

export async function mnemonicToSeed(mnemonic: string, passphrase: string): Promise<Uint8Array> {
  if (passphrase.length > MAX_INPUT) throw bip39Error('Passphrase exceeds 1,024 characters.');

  const api = subtle();
  const material = await api.importKey(
    'raw',
    Uint8Array.from(utf8Bytes(splitMnemonic(mnemonic).join(' ').normalize('NFKD'))),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const salt = Uint8Array.from(utf8Bytes(`mnemonic${passphrase}`.normalize('NFKD')));
  const bits = await api.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-512', salt, iterations: 2048 },
    material,
    512,
  );

  return new Uint8Array(bits);
}

function splitMnemonic(mnemonic: string): string[] {
  if (mnemonic.length > MAX_INPUT) throw bip39Error('Mnemonic exceeds 1,024 characters.');

  const words = mnemonic.normalize('NFKD').toLowerCase().split(/\s+/).filter(Boolean);

  if (words.length === 0) throw bip39Error('Mnemonic is required.');

  return words;
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle().digest('SHA-256', Uint8Array.from(bytes)));
}

function toBits(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(2).padStart(8, '0')).join('');
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bip39Error(message: string): FunctionError {
  return new FunctionError('BIP39_ERROR', message);
}
