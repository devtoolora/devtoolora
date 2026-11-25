import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { jsonDocumentToToml, tomlDocumentToJson } from '@devtoolora/functions/format';

describe('real TOML conversion', () => {
  it('round-trips nested records, arrays of tables, mixed arrays and empty collections in both layouts', () => {
    const source =
      '{"server":{"port":3000,"tls":{"enabled":true}},"users":[{"name":"Ada","settings":{"theme":"dark"},"devices":[{"type":"phone"}]},{"name":"Grace","settings":{},"devices":[]}],"mixed":[1,"text",false,{"a":2},[3]],"empty":{},"items":[]}';

    for (const layout of ['tables', 'inline'] as const) {
      const output = jsonDocumentToToml(source, layout);

      assert.deepEqual(JSON.parse(tomlDocumentToJson(output).text), JSON.parse(source));
      assert.ok(output.endsWith('\n'));
    }

    assert.match(jsonDocumentToToml(source), /\[\[users\]\]/);
    assert.match(jsonDocumentToToml(source), /\[server.tls\]/);

    assert.equal(
      jsonDocumentToToml('{"e":{},"x":{"y":{},"z":[{}]}}', 'inline'),
      'e = {}\nx = { y = {}, z = [{}] }\n',
    );

    assert.equal(jsonDocumentToToml('{"e":{},"x":{"y":{}}}'), 'e = {}\n\n[x]\ny = {}\n');
    assert.equal(tomlDocumentToJson(jsonDocumentToToml('{}')).text, '{}');
    assert.equal(tomlDocumentToJson('').text, '{}');
    assert.equal(tomlDocumentToJson('# comments only\n').text, '{}');
  });

  it('keeps exact signed 64-bit integers, quoted keys, escapes, Unicode and prototype data', () => {
    const source =
      '{"id":9007199254740993,"minimum":-9223372036854775808,"maximum":9223372036854775807,"float":1.00,"a.b":{"":"Příliš žluťoučký 🐎","a/b~c":"line\\n\\u007f"},"__proto__":{"constructor":false}}';
    const toml = jsonDocumentToToml(source);

    assert.match(toml, /9007199254740993/);
    assert.match(toml, /float = 1.00/);
    const output = tomlDocumentToJson(toml);

    assert.equal(output.largeIntegers, 3);
    assert.match(output.text, /9007199254740993/);
    const strings = JSON.parse(tomlDocumentToJson(toml, 'strings').text);

    assert.equal(strings.id, '9007199254740993');
    assert.equal(strings.__proto__.constructor, false);
    assert.equal(Object.prototype.hasOwnProperty.call(strings, '__proto__'), true);

    assert.deepEqual(
      JSON.parse(tomlDocumentToJson('bin=0b101\noct=0o17\nhex=0xFF\nnumber=1_000').text),
      { bin: 5, oct: 15, hex: 255, number: 1000 },
    );
  });

  it('retains date types as exact authored strings without losing fractions or assigning a timezone', () => {
    const source =
      'day=2024-02-29\nlocal=2026-10-11 12:30:01.123456789\noffset=2026-10-11T12:30:01.123456789+02:00\ntime=12:30:01.123456789\nitems=[2024-02-29, {date=2026-10-11}]\nquoted="2020-02-30"\n# 2000-02-30\ntext="""2020-02-30\n2000-02-30"""';
    const output = tomlDocumentToJson(source);

    assert.equal(output.dates, 6);
    const parsed = JSON.parse(output.text);

    assert.equal(parsed.local, '2026-10-11 12:30:01.123456789');
    assert.equal(parsed.offset, '2026-10-11T12:30:01.123456789+02:00');
    assert.equal(parsed.time, '12:30:01.123456789');
    assert.equal(parsed.quoted, '2020-02-30');
    assert.equal(tomlDocumentToJson('2020-02-30 = 1\n[2000-02-30]\nvalue=2').dates, 0);
    assert.equal(tomlDocumentToJson('"quoted" = "x\\\" 2020-02-30"\nvalue=2024-02-29').dates, 1);

    assert.equal(
      tomlDocumentToJson(
        "literal='2020-02-30'\nmultiline='''\n2020-02-30\n'''\narray=[\n[2024-02-29]\n]",
      ).dates,
      1,
    );

    for (const date of [
      '2023-02-29',
      '2024-02-30',
      '2024-04-31',
      '2024-13-01',
      '25:00:00',
      '12:60:00',
      '12:30:60',
      '2024-02-29T12:00:00+24:00',
    ])
      assert.throws(() => tomlDocumentToJson(`value=${date}`), /date|time|value/i);
  });

  it('rejects silent data loss, ambiguous definitions, malformed syntax and excessive values', () => {
    for (const source of ['null', '[]', '1'])
      assert.throws(() => jsonDocumentToToml(source), /root object/);
    assert.throws(() => jsonDocumentToToml('{"nested":{"a/b~c":null}}'), /\/nested\/a~1b~0c/);
    assert.throws(() => jsonDocumentToToml('{"items":[null]}'), /\/items\/0/);

    assert.equal(jsonDocumentToToml('{"a":1,"b":3,"\\u0061":2}'), 'a = 2\nb = 3\n');
    assert.equal(jsonDocumentToToml('{"n":{"a":1,"a":2}}'), '[n]\na = 2\n');

    assert.throws(() => jsonDocumentToToml('{"id":9223372036854775808}'), /64-bit/);
    assert.throws(() => jsonDocumentToToml('{"float":1e400}'), /binary64/);
    assert.throws(() => jsonDocumentToToml('{"text":"\\ud800"}'), /surrogate/);
    assert.throws(() => tomlDocumentToJson('id=9223372036854775808'), /64-bit/);
    for (const value of ['inf', '-inf', '+inf', 'nan', '1e400'])
      assert.throws(() => tomlDocumentToJson(`value=${value}`), /nonfinite|finite|cannot/i);
    assert.throws(() => tomlDocumentToJson('a=1\na=2'), /TOML line 2, column/);
    assert.throws(() => tomlDocumentToJson('a="unfinished'), /TOML line/);
    assert.throws(() => tomlDocumentToJson('a=unquoted'), /TOML line/);
    assert.throws(() => tomlDocumentToJson('x'.repeat(1_000_001)), /1,000,000/);

    assert.throws(
      () => tomlDocumentToJson(`values=[${Array(5_000).fill('1').join(',')}]`),
      /5,000/,
    );

    assert.throws(
      () => jsonDocumentToToml(`{"values":[${Array(5_000).fill('1').join(',')}]}`),
      /5,000 values/,
    );

    assert.throws(() => jsonDocumentToToml(`"${'x'.repeat(1_000_000)}"`), /1,000,000 characters/);
  });
});
