import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { formatPhone, listPhoneRegions } from '@devtoolora/functions/data';
import { FunctionError } from '@devtoolora/functions/errors';
import { getCountries, getCountryCallingCode } from 'libphonenumber-js/max';

describe('phone number formatting', async () => {
  it('uses country-specific trunk rules instead of prepending a calling code', async () => {
    const us = await formatPhone('(415) 555-0134', 'US');

    assert.equal(us.e164, '+14155550134');
    assert.equal(us.national, '(415) 555-0134');
    assert.equal(us.international, '+1 415 555 0134');
    assert.equal(us.country, 'US');
    assert.equal(us.countryCode, '1');
    assert.equal(us.digits, '14155550134');
    assert.equal(us.nationalNumber, '4155550134');
    assert.equal((await formatPhone('020 7946 0018', 'GB')).e164, '+442079460018');
    assert.equal((await formatPhone('02 1234 5678', 'IT')).e164, '+390212345678');
    assert.equal((await formatPhone('601 123 456', 'CZ')).e164, '+420601123456');
  });

  it('honors explicit international codes, shared plans and numeric calling-code defaults', async () => {
    assert.equal((await formatPhone('+44 20 7946 0018', 'US')).country, 'GB');
    assert.equal((await formatPhone('(415) 555-0134', '1')).e164, '+14155550134');
    assert.equal((await formatPhone('020 7946 0018', '44')).e164, '+442079460018');
    assert.equal((await formatPhone('+1 416 555 0134', 'US')).country, 'CA');
    assert.equal((await formatPhone('0044 20 7946 0018', 'CZ')).e164, '+442079460018');
    assert.equal((await formatPhone('01144 20 7946 0018', 'US')).e164, '+442079460018');
    const nonGeographic = await formatPhone('+800 1234 5678', 'international');

    assert.equal(nonGeographic.country, null);
    assert.equal(nonGeographic.countryCode, '800');

    await assert.rejects(
      formatPhone('4155550134', 'international'),
      (error: unknown) => error instanceof FunctionError && error.code === 'COUNTRY_REQUIRED',
    );

    for (const region of ['ZZ', '999', '0', '+1', 'USjunk'])
      await assert.rejects(formatPhone('+14155550134', region), FunctionError);
  });

  it('preserves extension digits in reports and tel URIs, never in E.164', async () => {
    for (const suffix of [' ext. 00123', ' x00123', '#00123', ';ext=00123']) {
      const phone = await formatPhone('+1 415 555 0134' + suffix);

      assert.equal(phone.extension, '00123');
      assert.equal(phone.e164, '+14155550134');
      assert.equal(phone.uri, 'tel:+14155550134;ext=00123');
      assert.match(phone.national, /00123$/);
    }

    assert.equal((await formatPhone('tel:+14155550134;ext=123')).uri, 'tel:+14155550134;ext=123');
    assert.equal((await formatPhone('+14155550134')).extension, null);
    await assert.rejects(formatPhone('+14155550134 ext. ' + '1'.repeat(11)), FunctionError);
  });

  it('rejects prose, vanity letters, malformed syntax and multiple phone numbers', async () => {
    for (const number of [
      'hello123',
      'Call +14155550134 now',
      '1-800-FLOWERS',
      '+1+4155550134',
      '(415 555-0134',
      '415) 555-0134',
      '((415)) 555-0134',
      '+14155550134, +442079460018',
      'tel:+14155550134;foo=1',
      '+14155550134 ext. 12abc',
      '٤١٥٥٥٥٠١٣٤',
    ]) {
      await assert.rejects(formatPhone(number), FunctionError);
    }
  });

  it('distinguishes impossible length from a possible-length invalid digit pattern', async () => {
    await assert.rejects(
      formatPhone('+1 415'),
      (error: unknown) => error instanceof FunctionError && error.code === 'INVALID_PHONE_LENGTH',
    );

    await assert.rejects(
      formatPhone('+65 1234 5678'),
      (error: unknown) => error instanceof FunctionError && error.code === 'INVALID_PHONE_PATTERN',
    );

    await assert.rejects(formatPhone('911'), FunctionError);
    const valid = await formatPhone('+65 8465 5555');

    assert.equal(valid.type, 'MOBILE');
    assert.equal(valid.valid, true);
    assert.equal(valid.possible, true);
  });

  it('bounds raw input before whitespace trimming and retains outer whitespace tolerance', async () => {
    assert.equal((await formatPhone(' \n+14155550134\t ')).e164, '+14155550134');

    await assert.rejects(
      formatPhone(' '.repeat(129) + '+14155550134'),
      (error: unknown) => error instanceof FunctionError && error.code === 'INPUT_TOO_LARGE',
    );

    await assert.rejects(
      formatPhone(' '),
      (error: unknown) => error instanceof FunctionError && error.code === 'REQUIRED_INPUT',
    );
  });

  it('lists supported countries with distinct codes and meaningful calling-code labels', async () => {
    const countries = listPhoneRegions();

    assert.ok(countries.length > 200);
    assert.equal(new Set(countries.map((country) => country.code)).size, countries.length);

    assert.deepEqual(
      countries.find((country) => country.code === 'CZ'),
      { callingCode: '420', code: 'CZ', label: 'Czechia' },
    );

    assert.ok(
      countries.every((country) => country.label && /^[1-9]\d{0,2}$/.test(country.callingCode)),
    );

    // The static region list must match the bundled metadata, which loads only when a number is
    // checked.
    assert.deepEqual(
      Object.fromEntries(countries.map((country) => [country.code, country.callingCode])),
      Object.fromEntries(getCountries().map((code) => [code, getCountryCallingCode(code)])),
    );
  });
});
