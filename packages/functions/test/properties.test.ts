import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  jsonDocumentToProperties,
  jsonToProperties,
  parseProperties,
  propertiesToJson,
  yamlDocumentToProperties,
} from '../src/format/properties';

const nested = { nested: true };
const flat = { nested: false };
const plain = { asciiOnly: false };

describe('parseProperties', () => {
  it('reads separators, continuations and unicode escapes', () => {
    assert.deepEqual(parseProperties('a=1\nb : 2\nc 3\nd=line\\\n   two\ne=\\u00e9'), [
      ['a', '1'],
      ['b', '2'],
      ['c', '3'],
      ['d', 'linetwo'],
      ['e', 'é'],
    ]);
  });

  it('skips comments and reads escaped separators in keys', () => {
    assert.deepEqual(parseProperties('! c\n# c\n  # indented\nkey\\=x=y\nk\\ s\\:p = \\ v'), [
      ['key=x', 'y'],
      ['k s:p', ' v'],
    ]);
  });

  it('follows java.util.Properties edge cases', () => {
    assert.deepEqual(
      parseProperties('empty\na=b=c\nx :=y\n# not\\\nz=1\\\\\nt=\\t\\n\\r\\f\\q\nq=a\\\n\\\n'),
      [
        ['empty', ''],
        ['a', 'b=c'],
        ['x', '=y'],
        ['z', '1\\'],
        ['t', '\t\n\r\fq'],
        ['q', 'a'],
      ],
    );
  });

  it('handles CRLF and a BOM like LF', () => {
    const input = `${String.fromCharCode(0xfeff)}a=1\r\nb=x\\\r\n  y\r\n`;

    assert.deepEqual(parseProperties(input), [
      ['a', '1'],
      ['b', 'xy'],
    ]);

    assert.deepEqual(
      parseProperties(input),
      parseProperties(input.slice(1).replace(/\r\n/g, '\n')),
    );
  });

  it('rejects malformed escapes with a line number and empty input', () => {
    assert.throws(() => parseProperties('\n\na=\\u00g1'), { message: /\\uXXXX.*line 3/ });
    assert.throws(() => parseProperties(' \n '), { message: /Properties input is required/ });
  });

  it('enforces the character and line limits', () => {
    assert.throws(() => parseProperties(`a=${'x'.repeat(5_000_000)}`), {
      message: /5,000,000 characters/,
    });

    assert.deepEqual(parseProperties(`${'# c\n'.repeat(99_999)}k=v\n`), [['k', 'v']]);
    assert.throws(() => parseProperties('# c\n'.repeat(100_001)), { message: /100,000 lines/ });
  });
});

describe('propertiesToJson', () => {
  it('nests dotted keys when asked and keeps them flat otherwise', () => {
    assert.deepEqual(propertiesToJson('a.b=1\na.c=2', nested), { a: { b: '1', c: '2' } });
    assert.deepEqual(propertiesToJson('a.b=1\na.c=2', flat), { 'a.b': '1', 'a.c': '2' });
  });

  it('rejects a key that is both a value and a parent', () => {
    assert.throws(() => propertiesToJson('a=1\na.b=2', nested), {
      message: /"a" is both a value and a parent/,
    });

    assert.throws(() => propertiesToJson('a.b=2\na=1', nested), {
      message: /"a" is both a value and a parent/,
    });

    assert.deepEqual(propertiesToJson('a=1\na.b=2', flat), { a: '1', 'a.b': '2' });
  });

  it('limits nested keys to 100 levels', () => {
    const key = (parts: number): string => Array.from({ length: parts }, () => 'k').join('.');

    assert.equal(JSON.stringify(propertiesToJson(`${key(100)}=1`, nested)).length, 603);

    assert.throws(() => propertiesToJson(`${key(101)}=1`, nested), {
      message: /^Nested keys are limited to 100 levels\.$/,
    });

    assert.throws(() => propertiesToJson(`${key(3_000)}=1`, nested), { message: /100 levels/ });

    assert.equal(
      Object.keys(propertiesToJson(`${key(3_000)}=1`, flat) as Record<string, unknown>).length,
      1,
    );
  });

  it('lets the last duplicate win and keeps __proto__ as data', () => {
    assert.deepEqual(propertiesToJson('a=1\na=2', nested), { a: '2' });

    const result = propertiesToJson('__proto__.x=1', nested) as Record<string, unknown>;

    assert.equal(Object.keys(result).includes('__proto__'), true);
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
  });
});

describe('jsonToProperties', () => {
  it('escapes non-ASCII only when asked and leading spaces always', () => {
    assert.equal(jsonToProperties({ k: 'é' }, { asciiOnly: true }), 'k=\\u00E9\n');
    assert.equal(jsonToProperties({ k: 'é' }, plain), 'k=é\n');
    assert.equal(jsonToProperties({ k: ' v' }, plain), 'k=\\ v\n');
  });

  it('flattens objects and writes numbers and booleans as JSON text', () => {
    assert.equal(
      jsonToProperties({ db: { port: 5432, tls: true }, n: 1.5 }, plain),
      'db.port=5432\ndb.tls=true\nn=1.5\n',
    );

    assert.equal(
      jsonDocumentToProperties('{"big":12345678901234567890,"f":1.50}', plain),
      'big=12345678901234567890\nf=1.50\n',
    );
  });

  it('rejects arrays and null by key, and non-object roots', () => {
    assert.throws(() => jsonToProperties({ a: { b: [1] } }, plain), { message: /"a\.b".*array/ });
    assert.throws(() => jsonToProperties({ a: null }, plain), { message: /"a".*null/ });
    assert.throws(() => jsonToProperties([1], plain), { message: /root object/ });
    assert.throws(() => jsonDocumentToProperties('"x"', plain), { message: /root object/ });
  });

  it('round-trips awkward keys and values through its own reader', () => {
    const value = {
      ' lead': ' \t\fpad',
      'a=b:c#d!e f': 'x=y:z#!',
      '#start': '!start',
      'back\\slash': 'line\nbreak\ttab\fform\rret\\',
      é: 'ü 😀',
    };

    for (const asciiOnly of [false, true]) {
      const text = jsonToProperties(value, { asciiOnly });

      assert.deepEqual(propertiesToJson(text, flat), value);
      if (asciiOnly) assert.match(text, /^[\x20-\x7e\n]*$/);
    }
  });

  it('writes an empty object as a comment that reads back empty', () => {
    const text = jsonToProperties({}, plain);

    assert.deepEqual(propertiesToJson(text, nested), {});
  });

  it('converts YAML and enforces input and output limits', () => {
    assert.equal(yamlDocumentToProperties('a:\n  b: 1\n', plain), 'a.b=1\n');
    assert.throws(() => yamlDocumentToProperties('a: [1]', plain), { message: /"a".*array/ });

    assert.throws(() => jsonDocumentToProperties(' ', plain), {
      message: /JSON input is required/,
    });

    const long = `{"a":"${'x'.repeat(1_500_000)}"}`;

    assert.equal(jsonDocumentToProperties(long, plain).length, 1_500_003);

    assert.throws(() => jsonDocumentToProperties(`"${'x'.repeat(5_000_000)}"`, plain), {
      message: /5,000,000 characters/,
    });

    const many = Object.fromEntries(
      Array.from({ length: 100_001 }, (_, index) => [`k${index}`, 1]),
    );

    assert.throws(() => jsonToProperties(many, plain), { message: /100,000 lines/ });
  });
});
