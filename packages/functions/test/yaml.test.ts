import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { FunctionError } from '@devtoolora/functions/errors';
import { jsonDocumentToYaml, jsonToYaml, yamlToJson } from '@devtoolora/functions/format';
import type { JsonValue } from '@devtoolora/functions/format';

function hasCode(code: string): (error: unknown) => boolean {
  return (error: unknown): boolean => error instanceof FunctionError && error.code === code;
}

describe('JSON and YAML conversion', () => {
  it('round-trips root scalars, collections and nested arrays of objects', () => {
    const values: JsonValue[] = [
      null,
      true,
      false,
      0,
      -123,
      1.25,
      0.001,
      '',
      'hello',
      [],
      {},
      [1, { nested: [false, null, { empty: [], settings: {} }] }],
      {
        users: [
          { active: true, name: 'Ada', roles: ['admin'] },
          { active: false, name: 'Grace', roles: [] },
        ],
      },
    ];

    for (const value of values) {
      const output = jsonToYaml(value);

      assert.ok(output.endsWith('\n'));
      assert.deepEqual(yamlToJson(output), value);
    }
  });

  it('quotes strings that could become numbers, booleans, dates, null or YAML syntax', () => {
    const strings = [
      '123',
      '00123',
      '-1',
      '1.5',
      '1e3',
      '0xFF',
      'true',
      'False',
      'null',
      '~',
      'yes',
      'on',
      '2026-10-10',
      '.nan',
      '.inf',
      '# comment',
      'a: b',
      '[x]',
      '{x: y}',
      '---',
      '*alias',
      '&anchor',
      '!tag',
    ];
    const value = { strings };

    assert.deepEqual(yamlToJson(jsonToYaml(value)), value);
    assert.match(jsonToYaml({ code: '123', count: 123 }), /code: "123"\ncount: 123/);
  });

  it('preserves multiline strings, Unicode, whitespace and unusual keys', () => {
    const value = Object.fromEntries([
      ['', ''],
      ['true', 'true'],
      ['123', '123'],
      ['a: b', 'a: b'],
      ['<<', 'literal merge-looking key'],
      ['title', 'Příliš žluťoučký kůň 🐎'],
      ['body', '  first\nsecond  \n\n'],
      ['crlf', 'one\r\ntwo\r\n'],
      ['tabs', '\ttext\t'],
      ['spaces', '  leading and trailing  '],
      ['quotes', 'It\'s a "quote".'],
    ]);

    assert.deepEqual(yamlToJson(jsonToYaml(value)), value);
    assert.deepEqual(yamlToJson(jsonToYaml(value, 2)), value);
    assert.throws(() => jsonToYaml(value, -1), hasCode('INVALID_YAML_INDENT'));
  });

  it('parses flow collections, comments, block scalars and YAML 1.2 scalar types', () => {
    const source =
      "\"key: with colon\": 'it''s fine' # comment\nlist: [{name: Ada, roles: [admin, editor]}, null]\nmessage: |\n  First line.\n  Second line.\nfolded: >-\n  one\n  two\nyesValue: yes\nonValue: on\nnumber: 0x10\nboolean: TRUE\nempty:\n";

    assert.deepEqual(yamlToJson(source), {
      boolean: true,
      empty: null,
      folded: 'one two',
      'key: with colon': "it's fine",
      list: [{ name: 'Ada', roles: ['admin', 'editor'] }, null],
      message: 'First line.\nSecond line.\n',
      number: 16,
      onValue: 'on',
      yesValue: 'yes',
    });

    assert.equal(yamlToJson('---\nnull\n...'), null);
    assert.equal(yamlToJson('---'), null);
  });

  it('expands anchors, repeated aliases and merge overrides without generating aliases on output', () => {
    const source =
      'defaults: &d {port: 8080, retries: 3}\nserver: {<<: *d, host: localhost, retries: 5}\nsecond: *d\n';
    const expected = {
      defaults: { port: 8080, retries: 3 },
      second: { port: 8080, retries: 3 },
      server: { host: 'localhost', port: 8080, retries: 5 },
    };

    assert.deepEqual(yamlToJson(source), expected);
    const repeated = { port: 8080 };
    const output = jsonToYaml({ first: repeated, second: repeated });

    assert.doesNotMatch(output, /[&*]a\d/);
    assert.deepEqual(yamlToJson(output), { first: repeated, second: repeated });
  });

  it('preserves prototype-looking keys as own data properties without prototype pollution', () => {
    const value = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":"value","prototype":{}}',
    );
    const recovered = yamlToJson(jsonToYaml(value));

    assert.deepEqual(recovered, value);
    assert.ok(recovered !== null && typeof recovered === 'object');
    assert.equal(Object.getPrototypeOf(recovered), Object.prototype);
    assert.equal(Object.hasOwn(recovered, '__proto__'), true);
    assert.equal(Object.hasOwn({}, 'polluted'), false);
  });

  it('reports malformed syntax, duplicate and complex keys with source locations', () => {
    for (const source of [
      'value: [unterminated',
      'a: 1\na: 2',
      '"1": first\n1: second',
      'a:\n\tb: 1',
      '? [a, b]\n: value',
    ]) {
      assert.throws(
        () => yamlToJson(source),
        (error: unknown) =>
          error instanceof FunctionError &&
          error.code === 'INVALID_YAML' &&
          /line \d+, column \d+/.test(error.message),
      );
    }

    assert.throws(() => yamlToJson('value: *missing'), hasCode('INVALID_YAML'));
  });

  it('rejects empty input, multiple documents, legacy directives and unsupported tags', () => {
    for (const source of ['', ' \n ', '# only a comment\n'])
      assert.throws(() => yamlToJson(source), hasCode('EMPTY_YAML'));

    for (const source of [
      'a: 1\n---\nb: 2',
      '%YAML 1.1\n---\nyesValue: yes',
      '%YAML broken',
      '%TAG broken',
      '%BAD directive',
      'v: !custom true',
      'v: !!timestamp 2026-10-10',
      'v: !!binary /w==',
      'v: !!set {a: null}',
    ]) {
      assert.throws(() => yamlToJson(source), hasCode('INVALID_YAML'));
    }
  });

  it('rejects nonfinite values and unsafe integers instead of silently rounding or writing null', () => {
    assert.deepEqual(yamlToJson('min: -9007199254740991\nmax: 9007199254740991'), {
      max: Number.MAX_SAFE_INTEGER,
      min: Number.MIN_SAFE_INTEGER,
    });

    assert.deepEqual(yamlToJson('id: "9007199254740993"'), { id: '9007199254740993' });

    for (const source of [
      'n: 9007199254740993',
      'n: -9007199254740992',
      'n: 9007199254740993.0',
      'n: 1e20',
      'n: .inf',
      'n: -.Inf',
      'n: .NaN',
      'n: 1e400',
    ]) {
      assert.throws(() => yamlToJson(source), hasCode('YAML_NOT_JSON_COMPATIBLE'));
    }

    for (const number of [Infinity, -Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => jsonToYaml({ number }), hasCode('YAML_NOT_JSON_COMPATIBLE'));
    }
  });

  it('rejects cycles, excessive alias expansion and excessive nesting with controlled errors', () => {
    assert.throws(
      () => yamlToJson('value: &a [*a]'),
      (error: unknown) => error instanceof FunctionError && /Cyclic aliases/.test(error.message),
    );

    const source = [
      'a: &a [1, 2, 3]',
      'b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a, *a]',
      'c: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b, *b]',
      'd: [*c, *c, *c, *c, *c, *c, *c, *c, *c, *c]',
    ].join('\n');

    assert.throws(
      () => yamlToJson(source),
      (error: unknown) => error instanceof FunctionError && /alias count/.test(error.message),
    );

    assert.throws(
      () => yamlToJson(`${'['.repeat(101)}0${']'.repeat(101)}`),
      hasCode('YAML_NOT_JSON_COMPATIBLE'),
    );

    const cyclic: JsonValue[] = [];

    cyclic.push(cyclic);
    assert.throws(() => jsonToYaml(cyclic), hasCode('YAML_NOT_JSON_COMPATIBLE'));
  });

  it('converts JSON text without JSON.parse, keeping number spelling and key order and rejecting duplicate keys', () => {
    const output = jsonDocumentToYaml(
      '\ufeff{"price":1.00,"count":1e3,"2":"second","1":"first","id":9007199254740993,"ratio":0.12345678901234567890,"zero":-0,"code":"1.00","empty":{},"items":[2E5,{"x":1.50}]}',
    );

    assert.equal(
      output,
      'price: 1.00\ncount: 1e3\n"2": second\n"1": first\nid: 9007199254740993\nratio: 0.12345678901234567890\nzero: -0\ncode: "1.00"\nempty: {}\nitems:\n  - 2E5\n  - x: 1.50\n',
    );

    assert.deepEqual(yamlToJson(jsonDocumentToYaml('{"a":[1.5,true,null,"true"],"b":{"c":-2}}')), {
      a: [1.5, true, null, 'true'],
      b: { c: -2 },
    });

    assert.equal(jsonDocumentToYaml('1.00'), '1.00\n');
    assert.equal(jsonDocumentToYaml('{"value":"123"}'), jsonToYaml({ value: '123' }));

    assert.equal(jsonDocumentToYaml('{"role":"user","role":"admin"}'), 'role: admin\n');

    assert.throws(() => jsonDocumentToYaml('{"a":1,}'), /Invalid JSON at line 1, column 8/);

    assert.throws(
      () => jsonDocumentToYaml(`${'['.repeat(101)}0${']'.repeat(101)}`),
      /100 nested containers/,
    );
  });

  it('round-trips a larger configuration with arrays, multiline values and Unicode', () => {
    const value = {
      users: Array.from({ length: 1000 }, (_, index: number) => ({
        active: index % 2 === 0,
        code: String(index),
        message: `Řádek ${index}.\nDalší řádek 🐎.\n`,
        roles: ['viewer'],
      })),
    };

    assert.deepEqual(yamlToJson(jsonToYaml(value)), value);
  });

  it('escapes characters that YAML readers refuse or read as line breaks', () => {
    assert.equal(jsonDocumentToYaml('{"t":"a\\u007fb"}'), 't: "a\\x7fb"\n');
    assert.equal(jsonDocumentToYaml('{"t":"a\\u0085b"}'), 't: "a\\x85b"\n');
    assert.equal(jsonDocumentToYaml('{"t":"a\\u2028b"}'), 't: "a\\u2028b"\n');
    assert.equal(jsonDocumentToYaml('{"t":"a\\tb"}'), 't: "a\\tb"\n');
    assert.equal(jsonDocumentToYaml('{"a\\tb":"plain"}'), '"a\\tb": plain\n');
    assert.equal(jsonDocumentToYaml('{"t":"a\\nb"}'), 't: |-\n  a\n  b\n');
  });
});
