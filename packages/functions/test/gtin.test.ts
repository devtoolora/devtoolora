import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { gtinKindLabel, gtinKinds, validateGtins, type GtinKind } from '../src/data/gtin';

const one = (text: string, kind: GtinKind = 'auto') => {
  const row = validateGtins(text, kind)[0];

  assert.ok(row);

  return row;
};

describe('validateGtins', () => {
  it('validates EAN-13, UPC-A and EAN-8', () => {
    assert.deepEqual(one('4006381333931'), {
      checkDigit: '1',
      conversions: ['GTIN-14 04006381333931'],
      input: '4006381333931',
      type: 'EAN-13',
      valid: true,
    });

    assert.deepEqual(one('4006381333932'), {
      checkDigit: '1',
      conversions: [],
      input: '4006381333932',
      type: 'EAN-13',
      valid: false,
    });

    assert.deepEqual(one('036000291452').conversions, [
      'EAN-13 0036000291452',
      'GTIN-14 00036000291452',
    ]);

    assert.equal(one('73513537').type, 'EAN-8');
    assert.deepEqual(one('73513537').conversions, ['GTIN-14 00000073513537']);
  });

  it('validates ISBN-10 and ISBN-13 and converts between them', () => {
    assert.deepEqual(one('0306406152'), {
      checkDigit: '2',
      conversions: ['ISBN-13 9780306406157'],
      input: '0306406152',
      type: 'ISBN-10',
      valid: true,
    });

    assert.deepEqual(one('9780306406157').conversions, [
      'ISBN-10 0306406152',
      'GTIN-14 09780306406157',
    ]);

    assert.equal(one('9790000000001').type, 'ISBN-13');

    assert.deepEqual(
      one('9790000000001').conversions.filter((c) => c.startsWith('ISBN-10')),
      [],
    );

    assert.equal(one('0-8044-2957-X').valid, true);
    assert.equal(one('0-8044-2957-x').checkDigit, 'X');
  });

  it('validates ISSN and GTIN-14', () => {
    assert.deepEqual(one('0378-5955'), {
      checkDigit: '5',
      conversions: [],
      input: '0378-5955',
      type: 'ISSN',
      valid: true,
    });

    assert.equal(one('03785955').type, 'EAN-8');
    assert.equal(one('03785955', 'issn').type, 'ISSN');
    assert.equal(one('12345678901231').type, 'GTIN-14');
    assert.equal(one('12345678901231').valid, true);
  });

  it('never throws on malformed rows', () => {
    assert.equal(one('123').type, 'Unknown');

    assert.deepEqual(one('40063813339A1'), {
      checkDigit: '',
      conversions: [],
      input: '40063813339A1',
      type: 'Unknown',
      valid: false,
    });

    assert.equal(one('١٢٣٤٥٦٧٨').type, 'Unknown');
    assert.equal(one('4006381333931', 'upca').valid, false);
    assert.equal(one('4006381333931', 'upca').type, 'UPC-A');
    assert.equal(one('4006381333931', 'upca').checkDigit, '');
  });

  it('skips blank lines and labels kinds', () => {
    assert.equal(validateGtins('73513537\n\n  \n4006381333931', 'auto').length, 2);
    assert.equal(gtinKindLabel('upca'), 'UPC-A');
    assert.equal(gtinKinds.length, 8);
  });

  it('covers forced kinds, hyphenated codes and the isbn13 prefix rule', () => {
    assert.equal(one('2434-561X').valid, true);
    assert.equal(one('978-0-306-40615-7').type, 'ISBN-13');
    assert.equal(one('9780306406157', 'ean13').valid, true);
    assert.equal(one('9790000000001', 'isbn10').valid, false);

    assert.deepEqual(
      [one('4006381333931', 'isbn13').valid, one('4006381333931', 'isbn13').checkDigit],
      [false, '1'],
    );

    assert.deepEqual(one('9780306406157').conversions, [
      'ISBN-10 0306406152',
      'GTIN-14 09780306406157',
    ]);
  });

  it('enforces limits before parsing', () => {
    assert.throws(() => validateGtins('1'.repeat(33), 'auto'), /Line 1 exceeds 32 characters\./);
    assert.throws(() => validateGtins('1\n'.repeat(1001), 'auto'), /Input exceeds 1,000 lines\./);
    assert.equal(validateGtins(' '.repeat(40), 'auto').length, 0);
    assert.equal(validateGtins('1\n'.repeat(1000), 'auto').length, 1000);

    assert.throws(
      () => validateGtins('1\n'.repeat(20_001), 'auto'),
      /Input exceeds 40,000 characters\./,
    );
  });
});
