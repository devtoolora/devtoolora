import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { escapeString, unescapeString, type EscapeLanguage } from '@devtoolora/functions/encoding';

describe('string escaping', () => {
  it('escapes per language', () => {
    assert.equal(escapeString('He said "hi"\n\tok', 'json'), 'He said \\"hi\\"\\n\\tok');
    assert.equal(escapeString('a\u0001\u2028', 'json'), 'a\\u0001\\u2028');
    assert.equal(escapeString('x', 'json', { quotes: true }), '"x"');
    assert.equal(escapeString("it's", 'javascript'), "it\\'s");
    assert.equal(escapeString("O'Reilly", 'sql'), "O''Reilly");
    assert.equal(escapeString('a.b*c?', 'regex'), 'a\\.b\\*c\\?');
    assert.equal(escapeString('<a & "b">', 'xml'), '&lt;a &amp; &quot;b&quot;&gt;');
    assert.equal(escapeString('a,"b"', 'csv'), '"a,""b"""');
    assert.equal(escapeString('plain', 'csv'), 'plain');
    assert.equal(escapeString("it's", 'shell'), "'it'\\''s'");
    assert.equal(escapeString('', 'shell'), "''");
  });

  it('unescapes per language', () => {
    assert.equal(unescapeString('\\u{1F600}\\x41\\0', 'javascript'), '\u{1F600}A\0');
    assert.equal(unescapeString('"quoted\\n"', 'json'), 'quoted\n');
    assert.equal(unescapeString('&#x41;&#66;&apos;', 'xml'), "AB'");
    assert.equal(unescapeString("'it'\\''s'", 'shell'), "it's");
  });

  it('reports invalid input with positions', () => {
    assert.throws(
      () => unescapeString("'it'\\''s' \"a\\\"b\"", 'shell'),
      /more than one shell word/,
    );

    assert.throws(() => unescapeString('"$HOME"', 'shell'), /does not expand \$ or backticks/);
    assert.throws(() => unescapeString('bad \\q', 'json'), /Invalid escape \\q at position 5\./);
    assert.throws(() => unescapeString('&nbsp;', 'xml'), /Unknown XML entity &nbsp; at position 1/);
    assert.throws(() => unescapeString("O'Reilly", 'sql'), /Unescaped ' at position 2/);
  });

  it('round trips every language', () => {
    const sample = 'P\u0159\u00edli\u0161 "\u017elu\u0165" \'x\' <a&b>, $x \\ \n\t\u{1F40E}';
    const languages: EscapeLanguage[] = [
      'csv',
      'java',
      'javascript',
      'json',
      'regex',
      'shell',
      'sql',
      'xml',
    ];

    for (const language of languages)
      assert.equal(unescapeString(escapeString(sample, language), language), sample, language);
  });

  it('limits input size', () => {
    assert.throws(() => escapeString('x'.repeat(1_000_001), 'json'), /1,000,000/);
    assert.throws(() => unescapeString('x'.repeat(1_000_001), 'json'), /1,000,000/);
  });

  it('round trips quote-heavy SQL and keeps escaped closing quotes', () => {
    for (const sample of ["'", "''", "'x'"])
      assert.equal(unescapeString(escapeString(sample, 'sql'), 'sql'), sample);

    assert.equal(unescapeString("'it''s'", 'sql'), "it's");
    assert.equal(unescapeString('"abc\\"', 'json'), '"abc"');
  });

  it('removes surrounding quotes when the pasted line ends in a newline', () => {
    assert.equal(unescapeString('"a\\nb"\n', 'json'), 'a\nb');
    assert.equal(unescapeString("'a'\r\n", 'javascript'), 'a');
    assert.equal(unescapeString('"a""b"\r\n', 'csv'), 'a"b');
    assert.equal(unescapeString("'x'\n", 'sql'), 'x');
    assert.equal(unescapeString('plain\n', 'json'), 'plain\n');
    assert.equal(unescapeString('plain\n', 'csv'), 'plain\n');
    assert.equal(unescapeString("it''s\n", 'sql'), "it's\n");
    assert.equal(unescapeString('"abc\\"\n', 'json'), '"abc"\n');
  });

  it('rejects XML entity names that are object prototype keys', () => {
    for (const entity of ['&constructor;', '&toString;', '&__proto__;'])
      assert.throws(() => unescapeString(entity, 'xml'), /Unknown XML entity/, entity);

    assert.equal(unescapeString('&amp;&lt;', 'xml'), '&<');
  });
});
