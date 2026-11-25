import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { iniToJson, jsonDocumentToIni } from '../src/format/ini';

const plain = { typed: false };

describe('iniToJson', () => {
  it('nests dotted sections and keeps strings by default', () => {
    const input = 'top=1\n[db]\nhost = x\n[db.replica]\nport=5432';

    assert.deepEqual(iniToJson(input, plain), {
      db: { host: 'x', replica: { port: '5432' } },
      top: '1',
    });

    assert.deepEqual(iniToJson(input.replace('top=1', 'top=1\nok=true'), { typed: true }), {
      db: { host: 'x', replica: { port: 5432 } },
      ok: true,
      top: 1,
    });
  });

  it('types only plain booleans, integers and decimals', () => {
    const input = 'a=0012\nb=1e5\nc=-3\nd=1.50\ne=9007199254740993\nf=false\ng=.5\nh="7"\ni=-0';

    assert.deepEqual(iniToJson(input, { typed: true }), {
      a: '0012',
      b: '1e5',
      c: -3,
      d: 1.5,
      e: '9007199254740993',
      f: false,
      g: '.5',
      h: '7',
      i: '-0',
    });
  });

  it('ignores line-start comments only', () => {
    assert.deepEqual(iniToJson('; c\n# c\na = b ; not comment', plain), { a: 'b ; not comment' });
  });

  it('ignores a BOM and handles CRLF like LF', () => {
    const input = `${String.fromCharCode(0xfeff)}top=1\r\n[s]\r\nk = v\r\n`;

    assert.deepEqual(iniToJson(input, plain), { s: { k: 'v' }, top: '1' });
    assert.deepEqual(iniToJson(input, plain), iniToJson(input.replace(/\r\n/g, '\n'), plain));
  });

  it('reads quoted keys and values and keeps __proto__ as data', () => {
    const result = iniToJson('"a=b" = " x "\n__proto__=1', plain) as Record<string, unknown>;

    assert.equal(result['a=b'], ' x ');
    assert.equal(Object.keys(result).includes('__proto__'), true);
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
  });

  it('rejects duplicates, conflicts and malformed lines with a line number', () => {
    assert.throws(() => iniToJson('[db]\nhost=1\nhost=2', plain), {
      message: /Duplicate key "host" in section "db".*line 3/,
    });

    assert.throws(() => iniToJson('[unclosed\na=1', plain), { message: /section header.*line 1/ });
    assert.throws(() => iniToJson('a=1\nnovalue', plain), { message: /key=value.*line 2/ });
    assert.throws(() => iniToJson('a=1\n[a]\nb=2', plain), { message: /conflicts.*line 2/ });
    assert.throws(() => iniToJson('[a..b]', plain), { message: /section name.*line 1/ });
    assert.throws(() => iniToJson('  ', plain), { message: /INI input is required/ });
  });

  it('enforces the character and line limits', () => {
    assert.throws(() => iniToJson(`a=${'x'.repeat(5_000_000)}`, plain), {
      message: /5,000,000 characters/,
    });

    assert.deepEqual(
      Object.keys(iniToJson(`[s]\n${'; c\n'.repeat(99_999)}`, plain) as Record<string, unknown>),
      ['s'],
    );

    assert.throws(() => iniToJson('; c\n'.repeat(100_001), plain), { message: /100,000 lines/ });
  });
});

describe('jsonDocumentToIni', () => {
  it('writes top-level keys, then sections', () => {
    assert.equal(jsonDocumentToIni('{"a":1,"s":{"k":"v"}}'), 'a=1\n\n[s]\nk=v\n');

    assert.equal(
      jsonDocumentToIni('{"s":{"k":true},"a":null}'.replace('null', '"n"')),
      'a=n\n\n[s]\nk=true\n',
    );
  });

  it('keeps big integers and number spelling exact', () => {
    assert.equal(
      jsonDocumentToIni('{"id":12345678901234567890123,"x":1.50,"e":1e5}'),
      'id=12345678901234567890123\nx=1.50\ne=1e5\n',
    );
  });

  it('round-trips awkward strings', () => {
    const values = {
      '': 'v',
      ' lead': ' x ',
      'a=b': 'v=1;#',
      c: '"q"',
      e: '',
      'sp ace': 'tab\there',
      ';k': '[v]',
    };
    const ini = jsonDocumentToIni(JSON.stringify({ s: values, ...values }));

    assert.deepEqual(iniToJson(ini, plain), { ...values, s: values });
  });

  it('rejects deeper nesting, arrays, null and newlines', () => {
    assert.throws(() => jsonDocumentToIni('{"a":{"b":{"c":1}}}'), { message: /two object levels/ });
    assert.throws(() => jsonDocumentToIni('{"a":[1]}'), { message: /Arrays/ });
    assert.throws(() => jsonDocumentToIni('[1]'), { message: /Arrays/ });
    assert.throws(() => jsonDocumentToIni('{"a":null}'), { message: /"a".*null/ });

    assert.throws(() => jsonDocumentToIni('{"s":{"note":"a\\nb"}}'), {
      message: /"s\.note".*newline/,
    });

    assert.throws(() => jsonDocumentToIni('{"a.b":{"k":1}}'), { message: /"a\.b"/ });
    assert.throws(() => jsonDocumentToIni('1'), { message: /root object/ });
    assert.equal(jsonDocumentToIni('{"a":1,"a":2}'), 'a=2\n');
  });

  it('accepts input above the shared 1,000,000 character JSON cap and enforces its own', () => {
    const big = `{"a":"${'x'.repeat(1_500_000)}"}`;

    assert.equal(jsonDocumentToIni(big).length, 1_500_003);

    assert.throws(() => jsonDocumentToIni(`{"a":"${'x'.repeat(5_000_000)}"}`), {
      message: /5,000,000 characters/,
    });

    const rows = Array.from({ length: 100_001 }, (_, index) => `"k${index}":1`).join(',');

    assert.throws(() => jsonDocumentToIni(`{${rows}}`), { message: /100,000 lines/ });
  });
});

describe('ini fixes', () => {
  it('reports line numbers after leading blank lines', () => {
    assert.throws(() => iniToJson('\n\n[open', plain), { message: /line 3/ });
    assert.throws(() => jsonDocumentToIni('\n\n{"a":}'), { message: /line 3/ });
  });

  it('does not count a trailing newline as a line', () => {
    assert.deepEqual(iniToJson(`${'; c\n'.repeat(99_999)}a=1\n`, plain), { a: '1' });
  });

  it('reads an explicitly quoted empty key but rejects a plain one', () => {
    assert.deepEqual(iniToJson('""=v', plain), { '': 'v' });
    assert.throws(() => iniToJson('=v', plain), { message: /key=value.*line 1/ });
  });

  it('keeps strings that look typed as strings in typed mode', () => {
    const ini = jsonDocumentToIni('{"port":"5432","on":"true","f":"1.5","n":5432}');

    assert.deepEqual(iniToJson(ini, { typed: true }), {
      f: '1.5',
      n: 5432,
      on: 'true',
      port: '5432',
    });
  });

  it('types integers only inside the safe range', () => {
    assert.deepEqual(iniToJson('a=9007199254740992\nb=9007199254740991', { typed: true }), {
      a: '9007199254740992',
      b: 9007199254740991,
    });
  });

  it('limits section nesting to 100 levels', () => {
    const header = (depth: number): string =>
      `[${Array.from({ length: depth }, () => 'a').join('.')}]\nk=v\n`;

    assert.doesNotThrow(() => iniToJson(header(100), plain));

    assert.throws(() => iniToJson(`x=1\n${header(101)}`, plain), {
      message: /^Section nesting is limited to 100 levels at line 2\.$/,
    });

    assert.throws(() => iniToJson(header(20_000), plain), { message: /100 levels/ });
  });
});
