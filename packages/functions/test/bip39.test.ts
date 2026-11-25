import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  bip39Words,
  generateMnemonic,
  mnemonicFromEntropy,
  mnemonicToSeed,
  validateMnemonic,
} from '../src/crypto';

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const fill = (byte: number, length: number) => new Uint8Array(length).fill(byte);

describe('BIP39', () => {
  it('ships the English wordlist', () => {
    assert.equal(bip39Words.length, 2048);
    assert.equal(bip39Words[0], 'abandon');
    assert.equal(bip39Words[2047], 'zoo');
    assert.deepEqual([...bip39Words].sort(), [...bip39Words]);
    assert.equal(new Set(bip39Words.map((word) => word.slice(0, 4))).size, 2048);
  });

  it('matches the reference vectors', async () => {
    assert.equal(await mnemonicFromEntropy(fill(0, 16)), `${'abandon '.repeat(11)}about`);

    assert.equal(
      await mnemonicFromEntropy(fill(0x7f, 16)),
      'legal winner thank year wave sausage worth useful legal winner thank yellow',
    );

    assert.equal(await mnemonicFromEntropy(fill(0xff, 16)), `${'zoo '.repeat(11)}wrong`);
    assert.equal(await mnemonicFromEntropy(fill(0, 32)), `${'abandon '.repeat(23)}art`);

    assert.equal(
      hex(await mnemonicToSeed(`${'abandon '.repeat(11)}about`, 'TREZOR')),
      'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04',
    );
  });

  it('normalizes and reports without throwing', async () => {
    const clean = await validateMnemonic(`${'abandon '.repeat(11)}about`);
    const messy = await validateMnemonic(
      `\tAbandon  abandon abandon\nabandon abandon abandon abandon abandon abandon abandon abandon ABOUT \n`,
    );

    assert.deepEqual(clean, {
      checksumValid: true,
      entropyHex: '00'.repeat(16),
      unknownWords: [],
      wordCount: 12,
      wordCountValid: true,
    });

    assert.deepEqual(messy, clean);

    assert.deepEqual(await validateMnemonic('abandon '.repeat(12).trim()), {
      checksumValid: false,
      entropyHex: '00'.repeat(16),
      unknownWords: [],
      wordCount: 12,
      wordCountValid: true,
    });

    const typo = await validateMnemonic(`${'abandon '.repeat(10)}abouts about`);

    assert.deepEqual(
      [typo.checksumValid, typo.unknownWords, typo.entropyHex],
      [false, [{ position: 11, word: 'abouts' }], undefined],
    );

    assert.deepEqual((await validateMnemonic('abandon '.repeat(13).trim())).wordCountValid, false);
  });

  it('generates valid mnemonics and enforces its limits', async () => {
    for (const words of [12, 15, 18, 21, 24] as const) {
      const mnemonic = await generateMnemonic(words);

      assert.equal(mnemonic.split(' ').length, words);
      assert.equal((await validateMnemonic(mnemonic)).checksumValid, true);
    }

    await assert.rejects(validateMnemonic(''), /Mnemonic is required\./);
    await assert.rejects(validateMnemonic('a '.repeat(600)), /Mnemonic exceeds 1,024 characters\./);

    await assert.rejects(
      mnemonicToSeed(`${'abandon '.repeat(11)}about`, 'p'.repeat(1025)),
      /Passphrase exceeds 1,024 characters\./,
    );

    await assert.rejects(
      mnemonicFromEntropy(new Uint8Array(17)),
      /Entropy must be 16, 20, 24, 28 or 32 bytes\./,
    );
  });
});
