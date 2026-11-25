import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { validateIban } from '@devtoolora/functions/data';
import { FunctionError } from '@devtoolora/functions/errors';
import { ibanRegistry } from '../src/data/ibanRegistry';

const countries = Object.entries(ibanRegistry).map(([code, spec]) => ({
  code,
  example: spec.example,
  length: spec.length,
  structure: `${code}2!n${spec.bbanStructure}`,
}));

function withCheckDigits(country: string, bban: string): string {
  const numeric = (bban + country + '00').replace(/[A-Z]/g, (character: string) =>
    String(character.charCodeAt(0) - 55),
  );
  const check = 98 - Number(BigInt(numeric) % 97n);

  return country + String(check).padStart(2, '0') + bban;
}

describe('IBAN validation', () => {
  it('checks all 89 registered format examples against independent exact checksum arithmetic', () => {
    assert.equal(countries.length, 89);
    assert.equal(new Set(countries.map((country) => country.code)).size, 89);

    for (const country of countries) {
      assert.match(country.structure, /^[A-Z]{2}(?:\d+![nac])+$/);
      const structureLength = [...country.structure.matchAll(/(\d+)![nac]/g)].reduce(
        (total, match) => total + Number(match[1]),
        2,
      );

      assert.equal(structureLength, country.length, country.code + ' structure length');
      const report = validateIban(country.example);

      assert.equal(report.valid, true, country.code + ': ' + JSON.stringify(report.issues));

      assert.equal(
        country.example,
        withCheckDigits(country.code, country.example.slice(4)),
        country.code,
      );

      assert.equal(report.length, country.length);
      assert.equal(report.expectedLength, country.length);
      assert.equal(report.structure, country.structure);
      assert.equal(report.remainder, 1);
      assert.ok(Object.values(report.checks).every((status) => status === 'pass'));
      assert.match(report.registry, /103.*September 2026/);
    }
  });

  it('preserves significant zeroes while normalizing lowercase and print whitespace', () => {
    const report = validateIban(' \ngb82\twest 1234\u00a05698 7654 32 ');

    assert.equal(report.iban, 'GB82WEST12345698765432');
    assert.equal(report.printFormat, 'GB82 WEST 1234 5698 7654 32');
    assert.equal(report.country, 'GB');
    assert.equal(report.checkDigits, '82');
    assert.equal(report.bban, 'WEST12345698765432');
    assert.equal(validateIban('CZ65 0800 0000 1920 0014 5399').bban, '08000000192000145399');
  });

  it('supports new registry formats rather than stale library patterns or missing countries', () => {
    for (const country of ['BI', 'DJ', 'FK', 'HN', 'YE']) {
      const example = countries.find((spec) => spec.code === country);

      assert.ok(example);
      assert.equal(validateIban(example.example).valid, true);
    }

    const brazil = validateIban('BR6699999A03000010009795493C1');

    assert.equal(brazil.valid, true);
    assert.equal(brazil.structure, 'BR2!n8!c5!n10!n1!c1!c');
    assert.equal(brazil.length, 29);
  });

  it('rejects wrong country length and BBAN structure even with passing check digits', () => {
    const wrongLength = validateIban(withCheckDigits('GB', 'WEST123456987654320'));

    assert.equal(wrongLength.checks.checksum, 'pass');
    assert.equal(wrongLength.checks.length, 'fail');
    assert.equal(wrongLength.checks.structure, 'not-checked');
    assert.equal(wrongLength.valid, false);
    assert.ok(wrongLength.issues.some((issue) => issue.code === 'INVALID_LENGTH'));
    const wrongStructure = validateIban(withCheckDigits('CZ', 'A8000000192000145399'));

    assert.equal(wrongStructure.checks.checksum, 'pass');
    assert.equal(wrongStructure.checks.length, 'pass');
    assert.equal(wrongStructure.checks.structure, 'fail');
    assert.equal(wrongStructure.valid, false);
  });

  it('does not accept unknown or territory prefixes merely because a checksum passes', () => {
    for (const country of ['ZZ', 'US', 'AX', 'GP']) {
      const report = validateIban(withCheckDigits(country, '123456789012345678'));

      assert.equal(report.checks.checksum, 'pass');
      assert.equal(report.checks.country, 'fail');
      assert.equal(report.expectedLength, null);
      assert.equal(report.valid, false);
      assert.ok(report.issues.some((issue) => issue.code === 'UNSUPPORTED_COUNTRY'));
    }
  });

  it('rejects reserved check digits even when MOD 97 alone yields one', () => {
    const replacements: Record<string, string> = { '02': '99', '97': '00', '98': '01' };
    const found = new Set<string>();

    for (let index = 0; index < 1000 && found.size < 3; index += 1) {
      const canonical = withCheckDigits('GB', 'WEST' + String(index).padStart(14, '0'));
      const replacement = replacements[canonical.slice(2, 4)];

      if (!replacement) continue;

      const report = validateIban('GB' + replacement + canonical.slice(4));

      assert.equal(report.remainder, 1);
      assert.equal(report.checks.checkDigits, 'fail');
      assert.equal(report.checks.checksum, 'fail');
      assert.equal(report.valid, false);
      found.add(replacement);
    }

    assert.equal(found.size, 3);
  });

  it('returns actionable failures without silently removing punctuation or Unicode lookalikes', () => {
    for (const value of [
      'IBAN: GB82WEST12345698765432',
      'GB82-WEST12345698765432',
      'GB８２WEST12345698765432',
      'GB82WΕST12345698765432',
      'GB82WEß12345698765432',
      'GB82WEST12345698765432,FR1420041010050500013M02606',
    ]) {
      const report = validateIban(value);

      assert.equal(report.valid, false);
      assert.equal(report.checks.syntax, 'fail');
      assert.equal(report.checks.checksum, 'not-checked');
      assert.ok(report.issues.some((issue) => issue.code === 'INVALID_SYNTAX'));
    }

    const wrongChecksum = validateIban('GB83WEST12345698765432');

    assert.equal(wrongChecksum.checks.structure, 'pass');
    assert.equal(wrongChecksum.checks.checksum, 'fail');
    assert.equal(wrongChecksum.checkDigits, '83');
    assert.equal(wrongChecksum.valid, false);
  });

  it('bounds raw input and distinguishes missing input from an invalid identifier', () => {
    assert.throws(
      () => validateIban(' '.repeat(129) + 'GB82WEST12345698765432'),
      (error: unknown) => error instanceof FunctionError && error.code === 'INPUT_TOO_LARGE',
    );

    assert.throws(
      () => validateIban(' \n'),
      (error: unknown) => error instanceof FunctionError && error.code === 'REQUIRED_INPUT',
    );

    assert.equal(validateIban('GB').valid, false);
    const tooLong = validateIban('GB82' + '1'.repeat(31));

    assert.equal(tooLong.checks.length, 'fail');
    assert.equal(tooLong.checks.checksum, 'not-checked');
  });
});
