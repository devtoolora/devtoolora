import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { jsoncToJson } from '../src/format/jsonc';

const jsonc = (input: string) => jsoncToJson(input, { dialect: 'jsonc', indent: 2 });
const json5 = (input: string) => jsoncToJson(input, { dialect: 'json5', indent: 2 });

describe('jsoncToJson', () => {
  it('strips comments and trailing commas', () => {
    const result = jsonc('{\n // c\n "a": 1, /* d */\n "b": [1,2,],\n}');

    assert.equal(result.text, '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');
    assert.equal(result.comments, 2);
  });

  it('keeps comment and comma characters inside strings', () => {
    assert.deepEqual(JSON.parse(jsonc('{"u":"http://x","s":"a,]"}').text), {
      s: 'a,]',
      u: 'http://x',
    });
  });

  it('handles CRLF input with comments', () => {
    const result = jsonc('{\r\n  // c\r\n  "a": 1,\r\n}\r\n');

    assert.equal(result.text, '{\n  "a": 1\n}');
    assert.equal(result.comments, 1);
  });

  it('converts JSON5 syntax', () => {
    assert.equal(
      jsoncToJson("{a:'x', b:0x1F, c:.5, d:+1,}", { dialect: 'json5', indent: 'tab' }).text,
      '{\n\t"a": "x",\n\t"b": 31,\n\t"c": 0.5,\n\t"d": 1\n}',
    );

    assert.equal(json5('[5., -.5e1, -0x10]').text, '[\n  5.0,\n  -0.5e1,\n  -16\n]');
  });

  it('escapes JSON5 string forms', () => {
    assert.deepEqual(JSON.parse(json5("['a\\\nb', '\\x41', 'say \"hi\"', '\\'']").text), [
      'ab',
      'A',
      'say "hi"',
      "'",
    ]);
  });

  it('keeps big integers exact', () => {
    assert.equal(
      json5('{n: 12345678901234567890123}').text,
      '{\n  "n": 12345678901234567890123\n}',
    );
  });

  it('rejects values without a JSON equivalent', () => {
    assert.throws(() => json5('{a: Infinity}'), { message: /Infinity.*no JSON equivalent/ });
    assert.throws(() => json5('{a: -Infinity}'), { message: /-Infinity.*no JSON equivalent/ });
    assert.throws(() => json5('[NaN]'), { message: /NaN.*no JSON equivalent/ });
  });

  it('reports strict-JSON errors at their position in the JSON5 source', () => {
    assert.throws(() => json5('{\n  a: 1,\n  b: @\n}'), {
      message: /^Invalid JSON at line 3, column 6 \(offset 15\): /,
    });

    assert.throws(() => json5("{a: 'x\\u0041', b: @}"), {
      message: /line 1, column 19 \(offset 18\)/,
    });

    assert.throws(() => json5(`${String.fromCharCode(0xfeff)}{a: @}`), {
      message: /line 1, column 5 /,
    });

    assert.throws(() => json5('{a: 1'), { message: /line 1, column 6 \(offset 5\)/ });
  });

  it('reports positions for invalid input', () => {
    assert.throws(() => jsonc("{\n  'x': 1}"), { message: /line 2, column 3/ });

    assert.throws(() => jsonc('{"a": 1 /* open'), {
      message: /Unterminated comment at line 1, column 9\./,
    });

    assert.throws(() => jsonc('{"a": "open'), {
      message: /Unterminated string at line 1, column 7\./,
    });

    assert.throws(() => jsonc('  '), { message: /input is required/ });
  });

  it('accepts inputs above the strict JSON format limits', () => {
    const long = jsonc(`{"s": "${'x'.repeat(1_000_010)}"}`);
    const many = jsonc(`[${Array.from({ length: 150_000 }, () => '1').join(',')}]`);

    assert.equal(long.text.length, 1_000_023);
    assert.equal(JSON.parse(many.text).length, 150_000);
  });

  it('quotes identifiers only in key position', () => {
    assert.deepEqual(JSON.parse(json5('{Infinity: 1, NaNx: 2, null /* k */ : 3, a: null}').text), {
      Infinity: 1,
      NaNx: 2,
      a: null,
      null: 3,
    });

    assert.throws(() => json5('{a: foo}'), {
      message: /^Unquoted value "foo" is not valid JSON5 at line 1, column 5\.$/,
    });

    assert.throws(() => json5('{a: ture}'), { message: /Unquoted value "ture"/ });
  });

  it('rejects lone commas, a stray slash and octal escapes', () => {
    assert.throws(() => jsonc('[,]'), { message: /Invalid JSON/ });
    assert.throws(() => jsonc('{,}'), { message: /Invalid JSON/ });
    assert.throws(() => jsonc('[1,,]'), { message: /Invalid JSON/ });
    assert.throws(() => jsonc('{"a":1}/'), { message: /Invalid JSON/ });
    assert.throws(() => json5("['\\1']"), { message: /Octal escape.*line 1, column 3\./ });
    assert.throws(() => json5("['\\01']"), { message: /Octal escape/ });
    assert.deepEqual(JSON.parse(json5("['\\0']").text), ['\0']);
  });

  it('counts duplicate keys and positions errors after CR line breaks', () => {
    assert.equal(jsonc('{"a": 1, "a": 2}').duplicateKeys, 1);
    assert.throws(() => jsonc("{\r  'x': 1}"), { message: /line 2, column 3\./ });
  });

  it('reads JSON5 Unicode keys, escaped keys and white space', () => {
    const text = (input: string) => json5(input).text;

    assert.equal(text('{\u00E9:1}'), '{\n  "\u00E9": 1\n}');
    assert.equal(text('{\\u0061d:5}'), '{\n  "ad": 5\n}');
    assert.equal(text('{a\\u0062:5}'), '{\n  "ab": 5\n}');
    assert.equal(text('{\u{1D400}:1}'), '{\n  "\u{1D400}": 1\n}');

    for (const space of ['\u000B', '\u000C', '\u00A0', '\u2003', '\u2028', '\u2029', '\uFEFF'])
      assert.equal(text(`{a:${space}1,${space}b:2${space}}`), '{\n  "a": 1,\n  "b": 2\n}');

    assert.throws(() => json5('{\\u0020:1}'), /not a valid JSON5 identifier at line 1, column 2/);
    assert.throws(() => json5('{a:\u00E9}'), /Unquoted value "\u00E9"/);

    assert.throws(
      () => jsoncToJson('{"a":\u00A01}', { dialect: 'jsonc', indent: 2 }),
      /Invalid JSON/,
    );
  });
});
