import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'vitest';
import { generateLicense, licenseIds, licenseTexts, type LicenseId } from '../src/dev';

describe('license generator', () => {
  const hashes: Record<LicenseId, string> = {
    'apache-2.0': 'c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4',
    'bsd-2-clause': '8116e572e44a918ea5f1b589024fbc673ccddde7a53b3bf95b4eafab0fdcd41e',
    'bsd-3-clause': 'f24d1328dbfffe7bf66aa877957db75e60629358357d8c366ccab616fef487ab',
    'gpl-3.0': '3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986',
    isc: '4aca3373f1677ae2cba83e44f30b313992fbce6727ce2e172907d56ac43b0137',
    mit: '002c2696d92b5c8cf956c11072baa58eaf9f6ade995c031ea635c6a1ee342ad1',
    'mpl-2.0': '3f3d9e0024b1921b067d6f7f88deb4a60cbe7a78e76c64e3f1d7fc3b779b9d04',
    unlicense: '6b0382b16279f26ff69014300541967a356a666eb0b91b422f6862f6b7dad17e',
  };

  it('stores the pinned texts unchanged', () => {
    for (const id of licenseIds) {
      const text = licenseTexts.get(id) ?? '';

      assert.equal(createHash('sha256').update(text).digest('hex'), hashes[id], id);
      assert.doesNotMatch(text, /[\u00a0\u200b-\u200f\u2028\u2029\ufeff]/, id);
    }
  });

  it('fills year and holder', () => {
    const mit = generateLicense({ holder: 'Ada Lovelace', id: 'mit', year: '2026' });

    assert.equal(mit.name, 'MIT License');
    assert.match(mit.text, /^MIT License\n\nCopyright \(c\) 2026 Ada Lovelace\n/);
    assert.doesNotMatch(mit.text, /\[year\]|\[fullname\]/);

    assert.match(
      generateLicense({ holder: 'X', id: 'isc', year: '' }, new Date('2030-06-01T00:00:00Z')).text,
      /2030 X/,
    );

    assert.match(
      generateLicense({ holder: '', id: 'apache-2.0', year: '2026' }).text,
      /\[yyyy\] \[name of copyright owner\]/,
    );

    assert.match(
      generateLicense({ holder: '', id: 'gpl-3.0', year: '2026' }).text,
      /Version 3, 29 June 2007/,
    );

    assert.equal(
      generateLicense({ holder: 'Ada', id: 'unlicense', year: '2026' }).text,
      licenseTexts.get('unlicense'),
    );
  });

  it('keeps a holder that looks like a placeholder or a replacement pattern', () => {
    const text = generateLicense({ holder: '[year] $& $1', id: 'mit', year: '2026' }).text;

    assert.match(text, /Copyright \(c\) 2026 \[year\] \$& \$1\n/);
  });

  it('validates fields', () => {
    const fails = (options: { holder: string; id: string; year: string }, message: string) =>
      assert.throws(() => generateLicense(options), { message });

    fails({ holder: '', id: 'mit', year: '2026' }, 'Enter the copyright holder.');
    fails({ holder: 'a\nb', id: 'mit', year: '2026' }, 'Copyright holder must be one line.');

    fails(
      { holder: 'a'.repeat(201), id: 'mit', year: '2026' },
      'Copyright holder is limited to 200 characters.',
    );

    fails({ holder: 'a', id: 'mit', year: '26' }, 'Year must have 4 digits.');
    fails({ holder: 'a', id: '__proto__', year: '2026' }, 'Choose a license.');
  });
});
