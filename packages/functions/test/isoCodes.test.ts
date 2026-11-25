import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';
import { lookupIsoCodes } from '../src/data/isoCodes';

const countries = lookupIsoCodes('', 'country');
const currencies = lookupIsoCodes('', 'currency');
const languages = lookupIsoCodes('', 'language');

function unique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

describe('iso code tables', () => {
  it('keeps the countries well-formed', () => {
    assert.equal(countries.length, 249);
    assert.ok(unique(countries.map((row) => row.alpha2)));
    assert.ok(countries.every((row) => /^[A-Z]{2}$/.test(row.alpha2)));
    assert.ok(countries.every((row) => /^[A-Z]{3}$/.test(row.alpha3)));
    assert.ok(countries.every((row) => /^\d{3}$/.test(row.numeric)));
  });

  it('keeps the currencies well-formed', () => {
    assert.ok(currencies.length >= 150);
    assert.ok(unique(currencies.map((row) => row.alpha3)));
    assert.ok(currencies.every((row) => /^[A-Z]{3}$/.test(row.alpha3)));
    assert.ok(currencies.every((row) => /^\d{3}$/.test(row.numeric)));
    assert.ok(currencies.every((row) => /^([0-4] minor units|no minor unit)$/.test(row.detail)));
  });

  it('keeps the languages well-formed', () => {
    assert.equal(languages.length, 184);
    assert.ok(unique(languages.map((row) => row.alpha2)));
    assert.ok(languages.every((row) => /^[a-z]{2}$/.test(row.alpha2)));
    assert.ok(languages.every((row) => /^[a-z]{3}$/.test(row.alpha3)));
  });

  it('spot checks known codes', () => {
    const pick = (query: string, kind: 'country' | 'currency' | 'language') =>
      lookupIsoCodes(query, kind)[0];

    assert.deepEqual(pick('CZ', 'country'), {
      alpha2: 'CZ',
      alpha3: 'CZE',
      detail: '',
      kind: 'country',
      name: 'Czechia',
      numeric: '203',
    });

    assert.equal(pick('US', 'country')?.numeric, '840');
    assert.equal(pick('DE', 'country')?.alpha3, 'DEU');
    assert.equal(pick('CZK', 'currency')?.detail, '2 minor units');
    assert.equal(pick('JPY', 'currency')?.detail, '0 minor units');
    assert.equal(pick('BHD', 'currency')?.numeric, '048');
    assert.equal(pick('BHD', 'currency')?.detail, '3 minor units');
    assert.equal(pick('EUR', 'currency')?.numeric, '978');

    assert.deepEqual(
      [pick('cs', 'language')?.alpha3, pick('cs', 'language')?.detail],
      ['ces', '639-2/B cze'],
    );

    assert.equal(pick('de', 'language')?.detail, '639-2/B ger');
    assert.equal(pick('en', 'language')?.alpha3, 'eng');
    assert.equal(pick('en', 'language')?.detail, '');
    assert.equal(pick('fr', 'language')?.detail, '639-2/B fre');
  });
});

describe('lookupIsoCodes', () => {
  it('puts an exact name first, then prefixes across kinds', () => {
    const rows = lookupIsoCodes('czech', 'all');

    assert.deepEqual(
      rows.map((row) => [row.kind, row.alpha3]),
      [
        ['language', 'ces'],
        ['country', 'CZE'],
        ['currency', 'CZK'],
      ],
    );
  });

  it('matches numeric and bibliographic codes exactly', () => {
    assert.deepEqual(
      lookupIsoCodes('203', 'all').map((row) => row.alpha3),
      ['CZE', 'CZK'],
    );

    assert.deepEqual(
      lookupIsoCodes('cze', 'all').map((row) => [row.kind, row.alpha3]),
      [
        ['country', 'CZE'],
        ['language', 'ces'], // exact 639-2/B code outranks the Czech koruna name match
        ['currency', 'CZK'],
      ],
    );
  });

  it('lists everything for an empty query', () => {
    assert.equal(lookupIsoCodes('', 'country').length, 249);

    assert.equal(
      lookupIsoCodes('', 'all').length,
      countries.length + currencies.length + languages.length,
    );
  });

  it('rejects unknown and oversized queries', () => {
    assert.throws(
      () => lookupIsoCodes('zzzzqqq', 'all'),
      /No country, currency or language matches "zzzzqqq"\./,
    );

    assert.throws(() => lookupIsoCodes('a'.repeat(257), 'all'), /Query exceeds 256 characters\./);

    assert.throws(
      () => lookupIsoCodes('q'.repeat(100), 'all'),
      (error) => error instanceof Error && error.message.includes(`"${'q'.repeat(64)}"`),
    );
  });

  it('falls back to the table name without display names', async () => {
    vi.resetModules();

    vi.stubGlobal(
      'Intl',
      Object.assign(Object.create(Intl), {
        DisplayNames: class {
          of(): undefined {
            return undefined;
          }
        },
      }),
    );

    try {
      const fresh = await import('../src/data/isoCodes');

      assert.equal(fresh.lookupIsoCodes('CZ', 'country')[0]?.name, 'Czechia');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('ranks exact codes before name prefixes before substrings', () => {
    const rows = lookupIsoCodes('US', 'all');
    const exact = rows.findIndex((row) => row.kind === 'country' && row.alpha2 === 'US');
    const usd = rows.findIndex((row) => row.alpha3 === 'USD');
    const austria = rows.findIndex((row) => row.name === 'Austria');

    assert.equal(exact, 0);
    assert.ok(usd < austria);
    assert.equal(lookupIsoCodes('united states', 'country')[0]?.alpha2, 'US');
    assert.equal(lookupIsoCodes('cze', 'language')[0]?.alpha2, 'cs');
    assert.equal(lookupIsoCodes('ger', 'all')[0]?.alpha3, 'deu');
    assert.ok(lookupIsoCodes('united', 'country')[0]?.name.toLowerCase().startsWith('united'));
  });

  it('searches the displayed English name as well as the table name', () => {
    const rows = lookupIsoCodes('emirates', 'country');

    assert.deepEqual(
      rows.map((row) => row.alpha2),
      ['AE'],
    );

    assert.equal(lookupIsoCodes('united arab', 'country')[0]?.alpha2, 'AE');
  });

  it('follows the current ISO 4217 list', () => {
    const codes = lookupIsoCodes('', 'currency').map((row) => row.alpha3);

    assert.ok(codes.includes('XCG') && codes.includes('XAD'));
    assert.ok(!['ANG', 'BGN', 'CUC'].some((code) => codes.includes(code)));
    assert.equal(codes.length, 178);
  });
});
