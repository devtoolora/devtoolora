import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { FunctionError } from '../src/errors';
import { validateVatNumbers, vatCountries, vatCountryName } from '../src/data/vat';

const pairs: Array<[string, string]> = [
  ['ATU13585627', 'ATU13585628'],
  ['BE0403019261', 'BE0403019262'],
  ['CHE-123.456.788 MWST', 'CHE-123.456.789 MWST'],
  ['CZ25123891', 'CZ25123892'],
  ['DE136695976', 'DE136695977'],
  ['DK13585628', 'DK13585629'],
  ['EE100931558', 'EE100931559'],
  ['FI20774740', 'FI20774741'],
  ['FR40303265045', 'FR40303265046'],
  ['GB980780684', 'GB980780685'],
  ['HR33392005961', 'HR33392005962'],
  ['HU12892312', 'HU12892313'],
  ['IE6388047V', 'IE6388048V'],
  ['IT00743110157', 'IT00743110158'],
  ['LU26375245', 'LU26375246'],
  ['NL810433941B01', 'NL810433942B01'],
  ['NO977074010MVA', 'NO977074011MVA'],
  ['PL5260250995', 'PL5260250996'],
  ['PT502011378', 'PT502011379'],
  ['SE556043420001', 'SE556043421001'],
  ['SI15012557', 'SI15012558'],
  ['SK2020327276', 'SK2020327277'],
];

const one = (text: string, country = '') => {
  const row = validateVatNumbers(text, country)[0];

  assert.ok(row);

  return row;
};

describe('vat validator', () => {
  it('lists the 31 countries', () => {
    assert.equal(vatCountries.length, 31);
    assert.deepEqual([...vatCountries], [...vatCountries].sort());
    assert.equal(vatCountryName('EL'), 'Greece');
    assert.equal(vatCountryName('XI'), 'Northern Ireland');
  });

  for (const [valid, invalid] of pairs) {
    it(`checks ${valid}`, () => {
      const good = one(valid);

      assert.equal(good.valid, true, valid);
      assert.equal(good.checksum, 'pass', valid);

      const bad = one(invalid);

      assert.equal(bad.valid, false, invalid);
      assert.equal(bad.format, true, invalid);
      assert.equal(bad.checksum, 'fail', invalid);
    });
  }

  it('accepts format-only countries without a checksum', () => {
    assert.deepEqual(
      { ...one('ES B12345678'), input: '' },
      { checksum: 'not checked', country: 'ES', format: true, input: '', valid: true },
    );

    const greece = one('EL123456789');

    assert.equal(greece.country, 'EL');
    assert.equal(greece.checksum, 'not checked');

    const gd = one('GBGD001');

    assert.equal(gd.format, true);
    assert.equal(gd.checksum, 'not checked');
  });

  it('reports format failures and unknown prefixes as rows', () => {
    assert.equal(one('DE12345678').format, false);
    assert.equal(one('DE12345678').checksum, 'not checked');
    assert.equal(one('DEABCDEFGHI').format, false);
    assert.equal(one('DE13669597٦').format, false);

    const unknown = one('ZZ123');

    assert.equal(unknown.country, '??');
    assert.equal(unknown.format, false);
    assert.equal(unknown.valid, false);
  });

  it('normalizes case and separators and honors a forced country', () => {
    assert.equal(one('de 136 695 976').valid, true);
    assert.equal(one('de 136 695 976').country, 'DE');
    assert.equal(one('136695976', 'DE').valid, true);
    assert.equal(one('DE136695976', 'DE').valid, true);
    assert.equal(one('136695976').country, '??');
  });

  it('handles forced prefixes, the legacy IE form and spaced lowercase input', () => {
    assert.equal(one('FR123456789', 'FR').format, true);
    assert.equal(one('40303265045', 'FR').valid, true);
    assert.equal(one('XX12345678', 'DK').valid, false);
    assert.equal(one('IE6388047VW').valid, true);
    assert.equal(one('cz 2512 3891').valid, true);
    assert.equal(one('GB123456782000').valid, true);
    assert.equal(one('CZ640903926').format, true);
    assert.equal(one('NL123456782B01').valid, true);
  });

  it('rejects an unsupported forced country', () => {
    assert.throws(
      () => validateVatNumbers('x', 'QQ'),
      (error) =>
        error instanceof FunctionError && error.message === 'Choose a supported country code.',
    );
  });

  it('skips blank lines and enforces limits', () => {
    assert.equal(validateVatNumbers('DE136695976\n\n  \nDK13585628', '').length, 2);
    assert.equal(validateVatNumbers(' '.repeat(40), '').length, 0);

    assert.throws(
      () => validateVatNumbers(`DE136695976\n${'1'.repeat(33)}`, ''),
      (error) =>
        error instanceof FunctionError && error.message === 'Line 2 exceeds 32 characters.',
    );

    assert.throws(
      () => validateVatNumbers('1\n'.repeat(1_001), ''),
      (error) => error instanceof FunctionError && error.message === 'Input exceeds 1,000 lines.',
    );

    assert.throws(
      () => validateVatNumbers('1'.repeat(40_001), ''),
      (error) =>
        error instanceof FunctionError && error.message === 'Input exceeds 40,000 characters.',
    );
  });
});
