import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { csvToSqlInsertTool, csvToSqlTool } from '../src/catalog/formatters/csv-to-sql/tool';
import { contentOf } from './toolContent';

const fields = { batchSize: '100', dialect: 'postgres', emptyAsNull: 'true', table: 'users' };

describe('csv to sql tool', () => {
  it('writes INSERT statements with a summary and a .sql artifact', async () => {
    const result = await csvToSqlTool.run({ fields, text: "id,name\n1,O'Neil\n2," });
    const text =
      "INSERT INTO \"users\" (\"id\", \"name\") VALUES\n  ('1', 'O''Neil'),\n  ('2', NULL);\n";

    assert.equal(result.text, text);
    assert.equal(result.summary, '2 rows in 1 INSERT statement for PostgreSQL.');
    assert.equal(result.language, 'sql');
    assert.equal(result.artifact?.fileName, 'insert.sql');
    assert.equal(Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'), text);
    assert.deepEqual(csvToSqlTool.relatedToolIds, ['sql-format', 'json-to-csv', 'string-escaper']);
    assert.equal(contentOf(csvToSqlTool).faq?.length, 5);
  });

  it('reads dialect, batch size and empty cell fields', async () => {
    const result = await csvToSqlTool.run({
      fields: { batchSize: '1', dialect: 'sqlserver', emptyAsNull: 'false', table: 'dbo.t' },
      text: 'a\nZoë\n',
    });

    assert.equal(result.text, "INSERT INTO [dbo].[t] ([a]) VALUES\n  (N'Zoë');\n");
    assert.equal(result.summary, '1 row in 1 INSERT statement for SQL Server.');

    const split = await csvToSqlTool.run({
      fields: { ...fields, batchSize: '1' },
      text: 'a\n1\n2',
    });

    assert.equal(split.summary, '2 rows in 2 INSERT statements for PostgreSQL.');
  });

  it('says when there are no data rows', async () => {
    const result = await csvToSqlTool.run({ fields, text: 'id,name\n' });

    assert.equal(result.text, '');
    assert.equal(result.summary, 'No data rows to insert.');
  });

  it('reports field and input errors', () => {
    assert.throws(() => csvToSqlTool.run({ fields: { ...fields, dialect: 'oracle' }, text: 'a' }), {
      message: /Choose PostgreSQL, MySQL, SQLite or SQL Server\./,
    });

    assert.throws(
      () => csvToSqlTool.run({ fields: { ...fields, dialect: '__proto__' }, text: 'a' }),
      {
        message: /Choose PostgreSQL/,
      },
    );

    assert.throws(() => csvToSqlTool.run({ fields: { ...fields, batchSize: '' }, text: 'a\n1' }), {
      message: /1-1,000/,
    });

    assert.throws(
      () => csvToSqlTool.run({ fields: { ...fields, emptyAsNull: 'yes' }, text: 'a' }),
      {
        message: /Checkbox values must be true or false\./,
      },
    );

    assert.throws(() => csvToSqlTool.run({ fields: { ...fields, table: 'a b' }, text: 'a\n1' }), {
      message: /Table name must be /,
    });

    assert.throws(() => csvToSqlTool.run({ fields, text: ' ' }), {
      message: /CSV input is required\./,
    });
  });

  it('has an alias and samples that run', async () => {
    assert.equal(csvToSqlInsertTool.aliasOf, 'csv-to-sql');
    assert.equal(csvToSqlInsertTool.id, 'csv-to-sql-insert');
    assert.ok((csvToSqlTool.samples?.length ?? 0) >= 6);

    for (const sample of csvToSqlTool.samples ?? [])
      assert.ok(
        (await csvToSqlTool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' })).text,
      );
  });
});
