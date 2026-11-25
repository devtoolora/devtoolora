import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { JsonNumberToken } from '../src/format/jsonDocument';
import { jsonDocumentToPlist, plistDocumentToJson, plistToJson } from '../src/format/plist';

const doctype =
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">';
const header = `<?xml version="1.0" encoding="UTF-8"?>\n${doctype}\n`;

function plist(body: string): string {
  return `${header}<plist version="1.0">\n${body}\n</plist>\n`;
}

const writerLimit =
  /^The plist written from this JSON is limited to 5,000,000 characters, 100 nested element levels and 100,000 XML nodes\.$/;

function nestedArrays(levels: number): string {
  return plist(`${'<array>'.repeat(levels)}${'</array>'.repeat(levels)}`);
}

describe('plistToJson', () => {
  it('reads every plist type', () => {
    const input = plist(
      '<dict><key>n</key><integer>3</integer><key>ok</key><true/><key>r</key><real>1.5</real><key>d</key><date>2024-01-02T03:04:05Z</date><key>b</key><data>AQI=</data><key>l</key><array><string>x</string></array></dict>',
    );

    assert.deepEqual(plistToJson(input), {
      b: 'AQI=',
      d: '2024-01-02T03:04:05Z',
      l: ['x'],
      n: 3,
      ok: true,
      r: 1.5,
    });
  });

  it('accepts the Apple DOCTYPE with other whitespace, a BOM and no declaration', () => {
    const input = `${String.fromCharCode(0xfeff)}<!DOCTYPE  plist\n  PUBLIC "-//Apple//DTD PLIST 1.0//EN"\r\n  "http://www.apple.com/DTDs/PropertyList-1.0.dtd" >\n<plist><false/></plist>`;

    assert.equal(plistToJson(input), false);
    assert.equal(plistToJson('<plist><string> a &amp; b </string></plist>'), ' a & b ');
  });

  it('rejects other DOCTYPEs, internal subsets and entities', () => {
    const other = '<!DOCTYPE plist SYSTEM "http://example.com/x.dtd">\n<plist><true/></plist>';
    const subset = `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd" [<!ENTITY x "y">]>\n<plist><string>&x;</string></plist>`;

    assert.throws(() => plistToJson(other), { message: /Only the Apple plist DOCTYPE/ });
    assert.throws(() => plistToJson(subset), { message: /Only the Apple plist DOCTYPE/ });

    assert.throws(() => plistToJson('<plist><string>&x;</string></plist>'), {
      message: /line 1, column/,
    });
  });

  it('rejects binary plists and empty input', () => {
    assert.throws(() => plistToJson('bplist00\x01binary'), {
      message: /Binary plists are not supported/,
    });

    assert.throws(() => plistToJson('  \n'), { message: /Plist input is required\./ });
  });

  it('reports structural errors with their line', () => {
    assert.throws(() => plistToJson(plist('<dict>\n<key>a</key>\n</dict>')), {
      message: /Key "a" has no value at line 5, column 1\./,
    });

    assert.throws(
      () => plistToJson(plist('<dict>\n<key>a</key><true/>\n<key>a</key><false/>\n</dict>')),
      { message: /Duplicate key "a" at line 6, column 1\./ },
    );

    assert.throws(() => plistToJson(plist('<array>\n  <set/>\n</array>')), {
      message: /Unknown plist element <set> at line 5, column 3\./,
    });

    assert.throws(() => plistToJson(plist('<dict><string>x</string></dict>')), {
      message: /Expected <key>/,
    });

    assert.throws(() => plistToJson('<root/>'), { message: /root element must be <plist>/ });

    assert.throws(() => plistToJson('<plist><true/><true/></plist>'), {
      message: /exactly one value/,
    });

    assert.throws(() => plistToJson('<plist><array>x</array></plist>'), {
      message: /Text is not allowed/,
    });
  });

  it('keeps big integers exact and rejects nan and inf', () => {
    assert.deepEqual(
      plistToJson('<plist><integer>+9007199254740993</integer></plist>'),
      new JsonNumberToken('9007199254740993'),
    );

    assert.equal(plistToJson('<plist><integer> -42 </integer></plist>'), -42);

    assert.equal(
      plistDocumentToJson(
        '<plist><dict><key>big</key><integer>-123456789012345678901</integer><key>e</key><array/></dict></plist>',
      ),
      '{\n  "big": -123456789012345678901,\n  "e": []\n}',
    );

    for (const text of ['nan', 'inf', '-infinity', 'NaN'])
      assert.throws(() => plistToJson(`<plist><real>${text}</real></plist>`), {
        message: /NaN and infinity/,
      });

    assert.throws(() => plistToJson('<plist><integer>1.5</integer></plist>'), {
      message: /Invalid <integer> value "1.5" at line 1/,
    });

    assert.throws(() => plistToJson('<plist><date>yesterday</date></plist>'), {
      message: /Invalid <date>/,
    });

    assert.throws(() => plistToJson('<plist>\n<date>2024-13-40T25:61:61Z</date></plist>'), {
      message: /Invalid <date> value "2024-13-40T25:61:61Z" at line 2, column 1\./,
    });

    assert.throws(() => plistToJson('<plist><date>2023-02-29T00:00:00Z</date></plist>'), {
      message: /Invalid <date>/,
    });

    assert.equal(
      plistToJson('<plist><date>2024-02-29T23:59:59Z</date></plist>'),
      '2024-02-29T23:59:59Z',
    );

    assert.throws(() => plistToJson('<plist><data>@@</data></plist>'), {
      message: /Invalid <data>/,
    });
  });

  it('keeps __proto__ as a plain key and strips whitespace from data', () => {
    const value = plistToJson(
      '<plist><dict><key>__proto__</key><string>x</string><key>b</key><data>\n  AQI=\n</data></dict></plist>',
    );

    assert.deepEqual(Object.keys(value as object), ['__proto__', 'b']);
    assert.equal((value as Record<string, string>).b, 'AQI=');
  });

  it('limits nesting to 100 levels and fails cleanly on deep input', () => {
    assert.ok(Array.isArray(plistToJson(nestedArrays(99))));

    for (const levels of [100, 3_000, 30_000]) {
      assert.throws(
        () => plistToJson(nestedArrays(levels)),
        (error: Error) => {
          assert.equal(error.name, 'FunctionError');
          assert.match(error.message, /100 nested element levels and 100,000 XML nodes\./);

          return true;
        },
      );
    }
  });

  it('limits input to 5,000,000 characters', () => {
    const big = plist(`<string>${'x'.repeat(4_900_000)}</string>`);

    assert.equal((plistToJson(big) as string).length, 4_900_000);

    assert.throws(() => plistToJson(plist(`<string>${'x'.repeat(5_000_000)}</string>`)), {
      message: /limited to 5,000,000 characters\./,
    });
  });
});

describe('jsonDocumentToPlist', () => {
  it('writes integers, reals and nested containers like Apple', () => {
    assert.equal(
      jsonDocumentToPlist(
        '{"a":1,"b":1.5,"c":{"d":[true,false,"x<&>"]},"e":{},"f":[],"g":12345678901234567890}',
      ),
      `${header}<plist version="1.0">\n<dict>\n  <key>a</key>\n  <integer>1</integer>\n  <key>b</key>\n  <real>1.5</real>\n  <key>c</key>\n  <dict>\n    <key>d</key>\n    <array>\n      <true/>\n      <false/>\n      <string>x&lt;&amp;&gt;</string>\n    </array>\n  </dict>\n  <key>e</key>\n  <dict/>\n  <key>f</key>\n  <array/>\n  <key>g</key>\n  <integer>12345678901234567890</integer>\n</dict>\n</plist>\n`,
    );
  });

  it('rejects null, forbidden characters and infinite reals by JSON Pointer', () => {
    assert.throws(() => jsonDocumentToPlist('{"a":1,"b":1.5,"c":null}'), {
      message: /"\/c" is null; null has no plist type\./,
    });

    assert.throws(() => jsonDocumentToPlist('{"a":{"b":["\\u0001"]}}'), {
      message: /string at JSON Pointer "\/a\/b\/0" contains a character that XML 1\.0 forbids/,
    });

    assert.throws(() => jsonDocumentToPlist('{"k\\u0002":1}'), {
      message: /key at JSON Pointer "\/k\\u0002" contains a character that XML 1\.0 forbids/,
    });

    for (const text of ['\\ufffe', '\\uffff', '\\ud800', 'x\\udc00', '\\udbff\\ud800'])
      assert.throws(() => jsonDocumentToPlist(`{"a":[1,"${text}"]}`), {
        message: /string at JSON Pointer "\/a\/1" contains a character that XML 1\.0 forbids/,
      });

    assert.match(jsonDocumentToPlist('["\\ud83d\\ude00"]'), /<string>\u{1f600}<\/string>/u);

    assert.throws(() => jsonDocumentToPlist('[1e400]'), { message: /"\/0" is outside/ });
    assert.throws(() => jsonDocumentToPlist(' '), { message: /JSON input is required\./ });
  });

  it('round trips through its own reader', () => {
    const json =
      '{"__proto__":"p","s":"tab\\tline\\nCR\\r ]]> é 😀","n":-0.25,"big":-99999999999999999999,"l":[[],{}],"t":true}';
    const text = plistDocumentToJson(jsonDocumentToPlist(json));

    assert.match(text, /"big": -99999999999999999999,/);
    assert.deepEqual(JSON.parse(text), JSON.parse(json));
  });

  it('never writes output its reader rejects and fails cleanly on deep JSON', () => {
    assert.ok(jsonDocumentToPlist(`${'['.repeat(97)}1${']'.repeat(97)}`));

    for (const levels of [99, 101, 3_000]) {
      assert.throws(
        () => jsonDocumentToPlist(`${'['.repeat(levels)}1${']'.repeat(levels)}`),
        (error: Error) => {
          assert.equal(error.name, 'FunctionError');
          assert.match(error.message, levels === 99 ? writerLimit : /limited to 100 nested/);

          return true;
        },
      );
    }

    const many = `[${Array.from({ length: 40_000 }, () => '1').join(',')}]`;

    assert.throws(() => jsonDocumentToPlist(many), { message: writerLimit });

    assert.throws(() => jsonDocumentToPlist(`["${'&'.repeat(1_000_000)}"]`), {
      message: writerLimit,
    });
  });

  it('reads hexadecimal integers', () => {
    const integer = (value: string) => plist(`<integer>${value}</integer>`);

    assert.equal(plistDocumentToJson(integer('0x10')), '16');
    assert.equal(plistDocumentToJson(integer('-0xFF')), '-255');
    assert.equal(plistDocumentToJson(integer('0xFFFFFFFFFFFFFFFF')), '18446744073709551615');
    assert.throws(() => plistDocumentToJson(integer('0xZZ')), /Invalid <integer> value/);
  });
});
