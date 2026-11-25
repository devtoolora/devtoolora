import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { convertCase, isTextCase, slugify } from '@devtoolora/functions/text';

describe('predictable text naming', () => {
  it('creates clean ASCII slugs, transliterates selected Latin letters and bounds separators', () => {
    assert.equal(slugify(' Crème brûlée #42!!! '), 'creme-brulee-42');
    assert.equal(slugify('Straße Æsir Łódź Øresund Œuvre'), 'strasse-aesir-lodz-oresund-oeuvre');
    assert.equal(slugify('Ħamrun ħobż Ŧest ŧa Işık Đakovo'), 'hamrun-hobz-test-ta-isik-dakovo');
    assert.equal(slugify('Ħamrun Ŧest', { lowercase: false }), 'Hamrun-Test');
    assert.equal(slugify('Ŋa ŋa'), 'a-a');

    assert.equal(
      slugify('Release 2026 / Build 42 — Alpha', {
        lowercase: false,
        preserveNumbers: false,
        separator: '_',
      }),
      'Release_Build_Alpha',
    );

    assert.equal(
      slugify('one---two / three', { separator: '.', trimDuplicates: false }),
      'one.two.three',
    );

    assert.equal(slugify(''), '');
    assert.equal(slugify('😀 / !!!'), '');
    assert.equal(slugify('你好 世界'), '');
    for (const separator of ['/', ' ', '--', '[', '', '?', '#'])
      assert.throws(() => slugify('text', { separator }), /separator must be/);
  });

  it('preserves Unicode scripts and their marks without pretending to transliterate them', () => {
    assert.equal(
      slugify('Příliš žluťoučký', { alphabet: 'unicode', removeAccents: false }),
      'příliš-žluťoučký',
    );

    assert.equal(slugify('Příliš žluťoučký', { removeAccents: false }), 'příliš-žluťoučký');

    assert.equal(
      slugify('你好 世界 नमस्ते दुनिया', { alphabet: 'unicode', removeAccents: true }),
      '你好-世界-नमस्ते-दुनिया',
    );

    assert.equal(slugify('Cafe\u0301', { alphabet: 'unicode', removeAccents: false }), 'café');

    assert.equal(
      slugify('Hello ٤٢ Ⅻ World', { alphabet: 'unicode', preserveNumbers: false }),
      'hello-world',
    );

    assert.equal(slugify('a\u200Db', { alphabet: 'unicode' }), 'a-b');
  });

  it('recognizes acronym boundaries and preserves identifier number parts and optional accents', () => {
    const source = 'XMLHttpRequest version2Value API_response-code';

    assert.equal(convertCase(source, 'snake'), 'xml_http_request_version2_value_api_response_code');
    assert.equal(convertCase('parseJSONPayloadResponse', 'kebab'), 'parse-json-payload-response');
    assert.equal(convertCase('API_response-code', 'camel'), 'apiResponseCode');
    assert.equal(convertCase('déjà vu 123!!!'), 'dejaVu123');

    assert.equal(
      convertCase('příliš žluťoučký नमस्ते दुनिया', 'camel', { removeAccents: false }),
      'přílišŽluťoučkýनमस्तेदुनिया',
    );

    assert.equal(convertCase('name value', 'pascal'), 'NameValue');
    assert.equal(convertCase('max retry', 'constant'), 'MAX_RETRY');
    assert.equal(convertCase('___ 😀 !!!', 'snake'), '');
  });

  it('preserves display punctuation, accents, layout and CRLF without identifier cleanup', () => {
    const source = 'Příliš žluťoučký, WORLD!\r\nNext LINE: Straße 42.';

    assert.equal(convertCase(source, 'lower'), 'příliš žluťoučký, world!\r\nnext line: straße 42.');

    assert.equal(
      convertCase(source, 'upper'),
      'PŘÍLIŠ ŽLUŤOUČKÝ, WORLD!\r\nNEXT LINE: STRASSE 42.',
    );

    assert.equal(
      convertCase("DON’T PANIC — this ISN'T A STYLE GUIDE.\nhello-world", 'title'),
      "Don’t Panic — This Isn't A Style Guide.\nHello-World",
    );

    assert.equal(
      convertCase('  HELLO, WORLD! next WORD.\r\nTHIRD LINE? yes.', 'sentence'),
      '  Hello, world! Next word.\r\nThird line? Yes.',
    );

    assert.equal(convertCase('ab 42 😀 cd', 'alternating'), 'aB 42 😀 cD');
    assert.equal(convertCase('a\u0301b cd', 'alternating'), 'a\u0301B cD');

    for (const target of ['lower', 'upper', 'title', 'sentence', 'alternating'] as const) {
      assert.equal(convertCase('😀 !\r\n 42', target), '😀 !\r\n 42');
      assert.equal(convertCase('', target), '');
    }
  });

  it('uses explicit locale casing and rejects malformed Unicode or oversized inputs', () => {
    assert.equal(convertCase('İSTANBUL I', 'lower', { locale: 'tr' }), 'istanbul ı');
    assert.equal(convertCase('istanbul ı', 'upper', { locale: 'tr' }), 'İSTANBUL I');
    assert.equal(convertCase('I', 'lower', { locale: 'az' }), 'ı');
    assert.equal(convertCase('I\u0301', 'lower', { locale: 'lt' }), 'i\u0307\u0301');
    assert.equal(isTextCase('unknown'), false);
    assert.equal(isTextCase('snake'), true);

    for (const transform of [slugify, convertCase]) {
      assert.throws(() => transform('x'.repeat(100_001)), /100,000/);
      assert.throws(() => transform('\uD800'), /unpaired Unicode surrogate/);
    }
  });

  it('does not capitalize a letter directly after a digit in sentence case', () => {
    assert.equal(convertCase('2nd place winner. 3rd one', 'sentence'), '2nd place winner. 3rd one');

    assert.equal(
      convertCase('1) first item. "quoted" end', 'sentence'),
      '1) First item. "Quoted" end',
    );
  });

  it('keeps final sigma and titlecases expanding letters in title case', () => {
    assert.equal(convertCase('\u0391\u03A3 \u03A9\u03A3', 'title'), '\u0391\u03C2 \u03A9\u03C2');
    assert.equal(convertCase('\uFB01nance', 'title'), 'Finance');
    assert.equal(convertCase('\u00DFeta', 'title'), 'Sseta');
    assert.equal(convertCase('\u0130stanbul', 'title'), '\u0130stanbul');
    assert.equal(convertCase('istanbul', 'title', { locale: 'tr' }), '\u0130stanbul');
  });

  it('does not split a slug word at invisible format characters', () => {
    assert.equal(slugify('inter\u00ADnational'), 'international');
    assert.equal(slugify('zero\u200Bwidth'), 'zerowidth');
    assert.equal(slugify('word\u2060joiner', { alphabet: 'unicode' }), 'wordjoiner');
    assert.equal(slugify('a\u200B b'), 'a-b');
  });
});
