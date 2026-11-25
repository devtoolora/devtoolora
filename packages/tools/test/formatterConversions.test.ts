import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { runBrowserWorkerTool } from '@devtoolora/browser-catalog';

async function result(id: string, text: string, fields: Record<string, string> = {}) {
  return runBrowserWorkerTool(id, { fields, text });
}

async function run(id: string, text: string, fields: Record<string, string> = {}): Promise<string> {
  return (await result(id, text, fields)).text;
}

describe('formatter and converter input handling', () => {
  it('keeps JSON key order and number spelling in YAML, XML and CSV and warn about duplicate keys', async () => {
    const source = '{"b":1.00,"2":1e3,"1":9007199254740993}';

    assert.equal(await run('json-to-yaml', source), 'b: 1.00\n"2": 1e3\n"1": 9007199254740993\n');
    assert.equal(await run('json-to-csv', `[${source}]`), 'b,2,1\n1.00,1e3,9007199254740993');

    assert.equal(
      await run('json-to-xml', '{"r":{"price":1.00,"id":9007199254740993}}', { layout: 'compact' }),
      '<r><price>1.00</price><id>9007199254740993</id></r>',
    );

    for (const [id, text, fields, expected] of [
      ['json-to-yaml', '{"a":1,\n"a":2}', {}, 'a: 2\n'],
      ['json-to-xml', '{"a":1,\n"a":2}', { layout: 'compact' }, '<a>2</a>'],
      ['json-to-csv', '[{"a":1,\n"a":2}]', {}, 'a\n2'],
      ['json-to-toml', '{"a":1,\n"a":2}', {}, 'a = 2\n'],
      ['ini-converter', '{"a":1,\n"a":2}', { mode: 'json-to-ini' }, 'a=2\n'],
      ['plist-converter', '{"a":1,\n"a":2}', { mode: 'json-to-plist' }, undefined],
      ['properties-converter', '{"a":1,\n"a":2}', { mode: 'json-to-properties' }, 'a=2\n'],
      ['table-generator', '[{"a":1,\n"a":2}]', { output: 'ascii' }, undefined],
    ] as const) {
      const output = await result(id, text, fields);

      if (expected !== undefined) assert.equal(output.text, expected, id);

      // The plist header has version 1.0, and only the first value of the key is a whole 1.
      assert.doesNotMatch(output.text?.replace(/1\.0/g, '') ?? '', /\b1\b/, id);

      assert.ok(
        output.summary?.endsWith('Duplicate key "a" at line 2; only its last value is kept.'),
        `${id}: ${output.summary}`,
      );
    }

    assert.doesNotMatch((await result('json-to-yaml', '{"a":1}')).summary ?? '', /Duplicate/);

    assert.doesNotMatch(
      (await result('table-generator', '[1,2]\n', { format: 'csv' })).summary ?? '',
      /Duplicate/,
    );
  });

  it('ignores a single leading byte order mark in the JSON tools and text converters', async () => {
    const bom = '﻿';

    assert.equal(await run('json-format', `${bom}{"a":1}`, { mode: 'minify' }), '{"a":1}');
    assert.match(await run('json-validate', `${bom}[1]`), /^Valid JSON/);
    assert.match(await run('json-tree', `${bom}{"a":1}`), /"a" \("\/a"\): number: 1/);
    assert.equal(await run('json-query', `${bom}{"a":{"b":1}}`, { path: '$.a.b' }), '1');
    assert.match(await run('json-table', `${bom}[{"a":1}]`), /\| 1 \| 1 \|/);

    assert.match(
      await run('json-diff', '', { left: `${bom}{"a":1}`, right: '{"a":2}' }),
      /Changed "\/a"/,
    );

    assert.equal(await run('json-to-yaml', `${bom}{"a":1}`), 'a: 1\n');
    assert.equal(await run('json-to-xml', `${bom}{"a":1}`, { layout: 'compact' }), '<a>1</a>');
    assert.equal(await run('json-to-csv', `${bom}[{"a":1}]`), 'a\n1');
    assert.equal(await run('json-to-toml', `${bom}{"a":1}`), 'a = 1\n');
    assert.equal(JSON.parse(await run('yaml-to-json', `${bom}a: 1`)).a, 1);
    assert.equal(JSON.parse(await run('xml-to-json', `${bom}<a>1</a>`)).a, '1');
    assert.equal(JSON.parse(await run('toml-to-json', `${bom}a = 1`)).a, 1);
    assert.equal(JSON.parse(await run('csv-to-json', `${bom}a\n1`))[0].a, '1');
    assert.equal(await run('xml-format', `${bom}<a>1</a>`), '<a>1</a>');
    assert.equal(await run('sql-format', `${bom}select 1`), 'SELECT\n  1');
    await assert.rejects(() => run('json-format', `${bom}${bom}{}`), /line 1, column 1/);
  });

  it('writes an empty JSON array as an empty CSV and an empty object as an inline TOML {}', async () => {
    const empty = await result('json-to-csv', '[]', { delimiter: 'tab' });

    assert.equal(empty.text, '');

    assert.equal(
      empty.summary,
      'Converted an empty JSON array to an empty TSV file · no header row or records.',
    );

    assert.equal(
      await run('json-to-toml', '{"e":{},"x":{"y":{}}}', { layout: 'inline' }),
      'e = {}\nx = { y = {} }\n',
    );
  });

  it('reports SQL parse errors in one line and round-trips MySQL DELIMITER blocks', async () => {
    await assert.rejects(
      () => run('sql-format', 'select from where (;'),
      (error: unknown) =>
        error instanceof Error &&
        error.message ===
          'Could not format SQL (sql) at line 1, column 20: unexpected ";". Check the selected dialect and the syntax near that position.',
    );

    const script = 'DELIMITER //\nCREATE PROCEDURE p() BEGIN SELECT 1; END //\nDELIMITER ;';
    const formatted = await run('sql-format', script, { dialect: 'mysql' });

    assert.equal(
      formatted,
      'DELIMITER //\nCREATE PROCEDURE p () BEGIN\nSELECT\n  1;\n\nEND //\n\nDELIMITER ;',
    );

    await assert.rejects(
      () => run('sql-format', script, { dialect: 'sql' }),
      /DELIMITER at line 1 is a MySQL client command/,
    );
  });
});
