import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { csvLimits, csvToJson, jsonDocumentToCsv, parseCsv, parseCsvTable } from '../src/format';
import type { CsvWriteOptions, JsonValue } from '../src/format';
import { profileCsv } from '../src/schema';

const toCsv = (value: JsonValue, options?: CsvWriteOptions): string =>
  jsonDocumentToCsv(JSON.stringify(value), options);

describe('CSV parsing, conversion and profiling', () => {
  it('quotes headers and preserves quoted separators, quotes, Unicode and all newline forms', () => {
    const records: JsonValue = [
      {
        'last,name': 'Příliš žluťoučký kůň 🐎.',
        'quote"name': 'He said "yes".',
        note: ' first\r\nsecond\nthird\rlast ',
      },
    ];
    const source = toCsv(records);

    assert.ok(source.startsWith('"last,name","quote""name",note\n'));
    assert.deepEqual(csvToJson(source), records);
    assert.deepEqual(csvToJson('a,b\r\n"x\r\ny",z\r\n'), [{ a: 'x\r\ny', b: 'z' }]);
    assert.deepEqual(csvToJson('a,b\rx,y\r'), [{ a: 'x', b: 'y' }]);
  });

  it('never trims raw headers, values or the final cell and removes only a leading BOM', () => {
    assert.deepEqual(csvToJson('\uFEFF name ,note \n Ada ,  value  '), [
      { ' name ': ' Ada ', 'note ': '  value  ' },
    ]);

    assert.deepEqual(csvToJson('name\n\uFEFFAda'), [{ name: '\uFEFFAda' }]);

    assert.deepEqual(parseCsv('a,b\n1,'), [
      ['a', 'b'],
      ['1', ''],
    ]);

    assert.deepEqual(parseCsv('"a\nb",c\n"value",end'), [
      ['a\nb', 'c'],
      ['value', 'end'],
    ]);
  });

  it('retains separator-only, quoted-empty and whitespace-only records and makes blank lines explicit', () => {
    assert.deepEqual(csvToJson('a,b\n,\n"",""\n \t, \n\n1,2'), [
      { a: '', b: '' },
      { a: '', b: '' },
      { a: ' \t', b: ' ' },
      { a: '1', b: '2' },
    ]);

    assert.deepEqual(csvToJson('a\nfirst\n\n""\nlast'), [{ a: 'first' }, { a: '' }, { a: 'last' }]);

    assert.deepEqual(csvToJson('a\nfirst\n\n""\nlast', { skipEmptyLines: false }), [
      { a: 'first' },
      { a: '' },
      { a: '' },
      { a: 'last' },
    ]);

    assert.throws(
      () => csvToJson('a,b\n\n1,2', { skipEmptyLines: false }),
      /record 2 has 1 cells; expected 2/,
    );

    assert.deepEqual(csvToJson(toCsv([{ a: '' }, { a: null }, {}])), [
      { a: '' },
      { a: '' },
      { a: '' },
    ]);

    assert.deepEqual(csvToJson('a,b\n'), []);
    assert.deepEqual(parseCsv(''), []);
  });

  it('rejects malformed quotes with an actual source line and column', () => {
    for (const source of [
      'a,b\n"unterminated,2',
      'a,b\nbar"baz,2',
      'a,b\n"ok"oops,2',
      'a,b\n "quoted",2',
      'a,b\n"ok" ,2',
    ]) {
      assert.throws(() => csvToJson(source), /CSV line \d+, column \d+:/);
      assert.throws(() => profileCsv(source), /CSV line \d+, column \d+:/);
    }

    assert.throws(() => parseCsv('a,b\r\n"first\r\nsecond"oops,2'), /line 3, column 8:/);
    assert.deepEqual(parseCsv('a\n"quote""inside"'), [['a'], ['quote"inside']]);
  });

  it('requires non-blank unique headers and rejects both extra and missing cells consistently', () => {
    for (const source of ['', '\n\n', ',b\n1,2', 'a, \n1,2', 'a,a\n1,2', 'a,b\n1', 'a,b\n1,2,3']) {
      assert.throws(() => csvToJson(source), /CSV/);
      assert.throws(() => profileCsv(source), /CSV/);
    }

    assert.deepEqual(parseCsvTable('a, a\n1,2'), { headers: ['a', ' a'], records: [['1', '2']] });
    assert.throws(() => toCsv([{ ' ': 'value' }]), /named columns/);
    assert.throws(() => profileCsv('a,b'), /at least one data row/);
  });

  it('preserves first-seen column order, heterogeneous rows and own prototype-looking names', () => {
    const records: JsonValue = JSON.parse(
      '[{"__proto__":"own","constructor":"value"},{"name":"Ada"}]',
    );

    assert.equal(toCsv(records), '__proto__,constructor,name\nown,value,""\n"","",Ada');
    const recovered = csvToJson(toCsv(records));

    assert.deepEqual(
      recovered,
      JSON.parse(
        '[{"__proto__":"own","constructor":"value","name":""},{"__proto__":"","constructor":"","name":"Ada"}]',
      ),
    );

    assert.equal(Object.getPrototypeOf(recovered[0]), Object.prototype);
    assert.equal(toCsv([{ b: 1 }, { a: 2, b: 3 }]), 'b,a\n1,""\n3,2');
  });

  it('serializes nested JSON as text rather than silently losing its contents or guessing types', () => {
    const source = toCsv([
      { array: ['a', 2], object: { active: true }, flag: false, number: 12.5, empty: null },
    ]);

    assert.deepEqual(csvToJson(source), [
      { array: '["a",2]', object: '{"active":true}', flag: 'false', number: '12.5', empty: '' },
    ]);

    assert.deepEqual(csvToJson('id,active,large\n00123,true,9007199254740993'), [
      { active: 'true', id: '00123', large: '9007199254740993' },
    ]);

    for (const value of [null, {}, [1], [null], [{}]])
      assert.throws(() => toCsv(value), /objects|named columns/);
    assert.equal(toCsv([]), '');
  });

  it('converts JSON text with source column order and exact number spelling, and rejects duplicate keys', () => {
    assert.equal(
      jsonDocumentToCsv(
        '\ufeff[{"b":1.00,"2":"two","1":9007199254740993,"nested":{"z":1.0,"10":[2E3,null]}},{"1":-0,"x":1e400}]',
      ),
      'b,2,1,nested,x\n1.00,two,9007199254740993,"{""z"":1.0,""10"":[2E3,null]}",""\n"","",-0,"",1e400',
    );

    assert.equal(
      jsonDocumentToCsv('[{"note":"=1+1","amount":-5}]', { escapeFormulas: true }),
      'note,amount\n"\'=1+1",-5',
    );

    assert.equal(jsonDocumentToCsv('[]', { delimiter: '\t' }), '');

    assert.equal(jsonDocumentToCsv('[{"a":"x"}]', { lineEnding: '\r\n' }), 'a\r\nx');

    assert.equal(jsonDocumentToCsv('[{"id":1},{"id":2,"id":3}]'), 'id\n1\n3');

    for (const source of ['{}', '[1]', '[[]]', 'null'])
      assert.throws(() => jsonDocumentToCsv(source), /array of objects/);
    assert.throws(() => jsonDocumentToCsv('[{}]'), /named columns/);

    assert.throws(
      () => jsonDocumentToCsv('[{"a":1}]', JSON.parse('{"delimiter":":"}')),
      /separator/,
    );

    assert.throws(
      () =>
        jsonDocumentToCsv(
          `[${Array(csvLimits.rows + 1)
            .fill('{"a":1}')
            .join(',')}]`,
        ),
      /CSV supports up to/,
    );
  });

  it('reads and writes semicolon CSV and TSV while controlling only record line endings', () => {
    const records: JsonValue = [
      { id: '001', note: 'one; two\tthree\nfour' },
      { id: '002', note: '' },
    ];

    for (const delimiter of [',', ';', '\t'] as const) {
      const source = toCsv(records, { delimiter, lineEnding: '\r\n' });

      assert.ok(source.startsWith(`id${delimiter}note\r\n`));
      assert.deepEqual(csvToJson(source, { delimiter }), records);
    }

    assert.throws(() => parseCsv('a,b\n1,2', JSON.parse('{"delimiter":":"}')), /separator/);
    assert.throws(() => parseCsv('a\n1', JSON.parse('{"skipEmptyLines":"false"}')), /boolean/);

    assert.throws(
      () => toCsv([{ a: 1 }], JSON.parse('{"lineEnding":"carriage-return"}')),
      /LF or CRLF/,
    );

    assert.throws(() => toCsv([{ a: 1 }], JSON.parse('{"escapeFormulas":"true"}')), /boolean/);
  });

  it('keeps formulas literal by default and only prefixes formula-like strings and headers when requested', () => {
    const records: JsonValue = [
      {
        '=header': '=1+1',
        negative: -5,
        string: '-5',
        full: '＝SUM(A1)',
        spaced: '  @SUM(A1)',
        tab: '\ttext',
        ordinary: 'note',
      },
    ];
    const raw = csvToJson(toCsv(records));

    assert.deepEqual(raw, [
      {
        '=header': '=1+1',
        full: '＝SUM(A1)',
        negative: '-5',
        ordinary: 'note',
        spaced: '  @SUM(A1)',
        string: '-5',
        tab: '\ttext',
      },
    ]);

    const protectedValues = csvToJson(toCsv(records, { escapeFormulas: true }));

    assert.deepEqual(protectedValues, [
      {
        "'=header": "'=1+1",
        full: "'＝SUM(A1)",
        negative: '-5',
        ordinary: 'note',
        spaced: "'  @SUM(A1)",
        string: "'-5",
        tab: "'\ttext",
      },
    ]);
  });

  it('profiles real dates, missing values, leading-zero identifiers and exact large-integer ranges', () => {
    const report = profileCsv(
      'id,total,date,decimal,blank\n001,9007199254740993,2024-02-29,1.5,\n002,9007199254740995,2026-02-30,2e2," "\n,,,,',
    );

    assert.match(report, /Rows: 3\nColumns: 5/);
    assert.match(report, /## id\nType: string\nMissing: 1\nUnique: 2/);

    assert.match(
      report,
      /## total\nType: integer\nMissing: 1\nUnique: 2\nMin: 9007199254740993\nMax: 9007199254740995/,
    );

    assert.match(report, /## date\nType: string/);
    assert.match(report, /## decimal\nType: number\nMissing: 1\nUnique: 2\nMin: 1.5\nMax: 200/);
    assert.match(report, /## blank\nType: empty\nMissing: 3\nUnique: 0/);

    assert.match(
      profileCsv('date\n2024-02-29\n2026-01-01'),
      /Type: date\nMissing: 0\nUnique: 2\nMin: 2024-02-29\nMax: 2026-01-01/,
    );

    assert.match(profileCsv('value\n1e999'), /Type: string/);
    assert.match(profileCsv('"multi\nline"\n"first\nsecond"'), /## multi\\nline/);
    assert.match(profileCsv('note\n"first\nsecond"'), /Samples: "first\\nsecond"/);
  });

  it('enforces bounded input, record, column and cell counts without truncation', () => {
    assert.throws(() => parseCsv('x'.repeat(csvLimits.characters + 1)), /CSV supports up to/);
    assert.throws(() => toCsv([{ a: 'x'.repeat(csvLimits.characters) }]), /CSV supports up to/);

    assert.throws(
      () =>
        parseCsv(
          Array.from(
            { length: csvLimits.columns + 1 },
            (_value: unknown, index: number) => `c${index}`,
          ).join(','),
        ),
      /CSV supports up to/,
    );

    assert.throws(() => parseCsv('a\n' + '1\n'.repeat(csvLimits.rows + 1)), /CSV supports up to/);

    assert.throws(
      () => toCsv(Array.from({ length: csvLimits.rows + 1 }, () => ({ a: 1 }))),
      /CSV supports up to/,
    );

    assert.throws(() => parseCsv(('a,'.repeat(99) + 'a\n').repeat(10_001)), /CSV supports up to/);
    const report = profileCsv(
      'value\n' +
        Array.from({ length: 50_000 }, (_value: unknown, index: number) => String(index)).join(
          '\n',
        ),
    );

    assert.match(report, /Min: 0\nMax: 49999/);
  });

  it('round-trips a deterministic set of text cells with quotes, delimiters and mixed whitespace', () => {
    const cells = [
      '',
      'plain',
      '  padded  ',
      'a,b',
      'a;b',
      'a\tb',
      'a"b',
      'a\nb',
      'a\rb',
      'a\r\nb',
      '🧪 č',
      '=1+1',
      '\uFEFFinside',
    ];
    const records: JsonValue = Array.from({ length: 100 }, (_value: unknown, index: number) =>
      Object.fromEntries(
        Array.from({ length: 5 }, (_entry: unknown, column: number) => [
          `c,${column}`,
          cells[(index * 7 + column) % cells.length]!,
        ]),
      ),
    );

    for (const delimiter of [',', ';', '\t'] as const)
      assert.deepEqual(csvToJson(toCsv(records, { delimiter }), { delimiter }), records);
  });
});
