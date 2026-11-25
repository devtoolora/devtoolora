import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { csvLimits, parseCsv } from '../src/format/csv';
import {
  convertCsvDelimiter,
  csvToSqlInsert,
  detectCsvDelimiter,
  diffCsv,
  transformCsvColumns,
  writeCsvRows,
} from '../src/format/csvTools';

describe('CSV delimiter conversion', () => {
  it('detects the separator and converts semicolon CSV to TSV', () => {
    assert.deepEqual(
      convertCsvDelimiter('a;b\n"x;y";2', { from: 'auto', quoteAll: false, to: '\t' }),
      {
        from: ';',
        rows: 2,
        text: 'a\tb\nx;y\t2\n',
      },
    );
  });

  it('quotes every field and doubles quotes with quoteAll', () => {
    assert.equal(
      convertCsvDelimiter('a,b\n"say ""hi""",2', { from: ',', quoteAll: true, to: ';' }).text,
      '"a";"b"\n"say ""hi""";"2"\n',
    );
  });

  it('quotes only fields that need it', () => {
    assert.equal(
      writeCsvRows([['tab\there', 'plain', ' padded', 'line\nbreak', 'q"uote', '']], {
        delimiter: '\t',
        lineEnding: '\n',
        quoteAll: false,
      }),
      '"tab\there"\tplain\t" padded"\t"line\nbreak"\t"q""uote"\t\n',
    );

    assert.equal(
      writeCsvRows([['a'], [''], ['b']], { delimiter: ',', lineEnding: '\r\n', quoteAll: false }),
      'a\r\n""\r\nb\r\n',
    );
  });

  it('reads BOM and CRLF input like LF', () => {
    assert.deepEqual(
      convertCsvDelimiter('\uFEFFname;city\r\nAda;"Lon\r\ndon"\r\n', {
        from: 'auto',
        quoteAll: false,
        to: '\t',
      }),
      { from: ';', rows: 2, text: 'name\tcity\nAda\t"Lon\r\ndon"\n' },
    );
  });

  it('keeps ragged rows and round trips through its own reader', () => {
    const source = 'a|b|c\n1|2\n"x|y"|"he said ""no"""|\n';
    const { text } = convertCsvDelimiter(source, { from: 'auto', quoteAll: false, to: ',' });

    assert.equal(text, 'a,b,c\n1,2\nx|y,"he said ""no""",\n');
    assert.deepEqual(parseCsv(text), parseCsv(source, { delimiter: '|' }));
  });

  it('detects the most consistent separator outside quotes', () => {
    assert.equal(detectCsvDelimiter('a\tb\tc\n1\t2\t3\n'), '\t');
    assert.equal(detectCsvDelimiter('a|b\n"1,2,3"|4\n5|6'), '|');
    assert.equal(detectCsvDelimiter('a;b,c\n1;2,3'), ',');
    assert.equal(detectCsvDelimiter('name\nAda\nGrace\n'), ',');
    assert.equal(detectCsvDelimiter('"a;b"\n"c;d"'), ',');

    assert.equal(
      detectCsvDelimiter(`${'a;b\n'.repeat(20)}${'1,2,3,4\n'.repeat(30)}`),
      ';',
      'only the first 20 records vote',
    );

    assert.equal(
      detectCsvDelimiter(`${'\n'.repeat(20)}a;b\n1;2\n`),
      ';',
      'blank lines do not vote',
    );
  });

  it('reports input errors', () => {
    assert.throws(() => convertCsvDelimiter(' \n', { from: 'auto', quoteAll: false, to: ',' }), {
      message: /CSV input is required\./,
    });

    assert.throws(() => convertCsvDelimiter('a,"b', { from: ',', quoteAll: false, to: ';' }), {
      message: /CSV line 1, column 5: Unterminated quoted field\./,
    });

    assert.throws(
      () =>
        writeCsvRows([['x'.repeat(csvLimits.characters)]], {
          delimiter: ',',
          lineEnding: '\n',
          quoteAll: false,
        }),
      { message: /CSV supports up to 5,000,000 characters/ },
    );

    assert.throws(
      () =>
        writeCsvRows([['a']], {
          delimiter: JSON.parse('":"'),
          lineEnding: '\n',
          quoteAll: false,
        }),
      { message: /Choose comma, semicolon, tab or pipe as the separator\./ },
    );
  });
});

describe('CSV columns', () => {
  const keep = { columns: '', rename: '', transpose: false };
  const input = 'id,name,age\n1,Ada,36';

  it('selects and reorders by name and 1-based number', () => {
    assert.deepEqual(transformCsvColumns(input, { ...keep, columns: 'name, 1' }), {
      columns: 2,
      rows: 2,
      text: 'name,id\nAda,1\n',
    });

    assert.equal(transformCsvColumns(input, { ...keep, columns: 'id,id' }).text, 'id,id\n1,1\n');
  });

  it('keeps all columns for an empty or token-less spec', () => {
    for (const columns of ['', '  ', ',', ' , ,'])
      assert.equal(
        transformCsvColumns(input, { ...keep, columns }).text,
        'id,name,age\n1,Ada,36\n',
      );
  });

  it('keeps the detected delimiter, ignores BOM and reads CRLF', () => {
    assert.equal(
      transformCsvColumns('\uFEFFa;b\r\n1;2\r\n', { ...keep, columns: 'b' }).text,
      'b\n2\n',
    );

    assert.equal(transformCsvColumns('a;b\n1;2', { ...keep, columns: 'b,a' }).text, 'b;a\n2;1\n');
  });

  it('renames after selecting and rejects unknown names', () => {
    assert.equal(
      transformCsvColumns(input, { ...keep, columns: 'name', rename: 'name=full_name' }).text,
      'full_name\nAda\n',
    );

    assert.equal(
      transformCsvColumns('a,b\n1,2', { ...keep, rename: 'a=b, b=a' }).text,
      'b,a\n1,2\n',
    );

    assert.equal(
      transformCsvColumns('a,b\n1,2', { ...keep, rename: 'a=x,b=x' }).text,
      'x,x\n1,2\n',
    );

    assert.throws(() => transformCsvColumns(input, { ...keep, rename: 'nope=x' }), {
      message: /Unknown column "nope"/,
    });

    assert.throws(() => transformCsvColumns(input, { ...keep, columns: 'id', rename: 'name=x' }), {
      message: /Unknown column "name"/,
    });

    assert.throws(() => transformCsvColumns(input, { ...keep, rename: 'id' }), {
      message: /Rename "id" must look like old=new\./,
    });
  });

  it('rejects unknown names and out-of-range numbers', () => {
    assert.throws(() => transformCsvColumns(input, { ...keep, columns: 'nope' }), {
      message: /Unknown column "nope"/,
    });

    assert.throws(() => transformCsvColumns(input, { ...keep, columns: '9' }), {
      message: /column 9.*3 columns/,
    });

    assert.throws(() => transformCsvColumns(input, { ...keep, columns: '0' }), {
      message: /column 0.*3 columns/,
    });

    assert.throws(() => transformCsvColumns(' ', keep), { message: /CSV input is required/ });
  });

  it('looks headers up exactly, including prototype names', () => {
    const text = 'toString,__proto__,Name\n1,2,3';

    assert.equal(
      transformCsvColumns(text, { ...keep, columns: '__proto__,toString' }).text,
      '__proto__,toString\n2,1\n',
    );

    assert.throws(() => transformCsvColumns(text, { ...keep, columns: 'name' }), {
      message: /Unknown column "name"/,
    });

    assert.throws(() => transformCsvColumns(text, { ...keep, columns: 'constructor' }), {
      message: /Unknown column "constructor"/,
    });
  });

  it('fills missing cells and drops cells beyond the header', () => {
    assert.equal(
      transformCsvColumns('a,b,c\n1\n2,3,4,5', { ...keep, columns: 'c,a' }).text,
      'c,a\n,1\n4,2\n',
    );

    assert.equal(transformCsvColumns('a,b\n1,2,3', keep).text, 'a,b\n1,2\n');
  });

  it('transposes after selecting and renaming', () => {
    assert.deepEqual(transformCsvColumns(input, { ...keep, transpose: true }), {
      columns: 2,
      rows: 3,
      text: 'id,1\nname,Ada\nage,36\n',
    });

    assert.equal(
      transformCsvColumns(input, { columns: 'age,id', rename: 'id=key', transpose: true }).text,
      'age,36\nkey,1\n',
    );

    assert.equal(transformCsvColumns('a', { ...keep, transpose: true }).text, 'a\n');
  });

  it('limits transposing to 10,000 rows', () => {
    const rows = (count: number) => Array.from({ length: count }, (_, i) => `${i}`).join('\n');

    assert.equal(transformCsvColumns(rows(10_000), { ...keep, transpose: true }).columns, 10_000);

    assert.throws(() => transformCsvColumns(rows(10_001), { ...keep, transpose: true }), {
      message: /Transposing supports up to 10,000 rows\./,
    });

    assert.equal(transformCsvColumns(rows(10_001), keep).rows, 10_001);
  });

  it('bounds a repeated selection before building rows', () => {
    const tall = `a\n${'1\n'.repeat(100_000)}`;

    assert.throws(() => transformCsvColumns(tall, { ...keep, columns: '1,'.repeat(10_000) }), {
      message: /CSV supports up to/,
    });

    assert.throws(() => transformCsvColumns(tall, { ...keep, columns: '1,'.repeat(11) }), {
      message: /CSV supports up to/,
    });

    assert.throws(() => transformCsvColumns(input, { ...keep, columns: '1,'.repeat(10_001) }), {
      message: /CSV supports up to/,
    });

    assert.equal(transformCsvColumns(tall, { ...keep, columns: '1,'.repeat(9) }).columns, 9);
  });
});

describe('CSV diff', () => {
  const byId = { key: 'id' };
  const byRow = { key: '' };

  it('reports removed, changed and added rows by key', () => {
    assert.deepEqual(diffCsv('id,v\n1,a\n2,b', 'id,v\n2,c\n3,d', byId), {
      added: 1,
      addedColumns: [],
      changed: 1,
      removed: 1,
      removedColumns: [],
      rows: [
        { key: '1', kind: 'removed' },
        { cells: [{ after: 'c', before: 'b', column: 'v' }], key: '2', kind: 'changed' },
        { key: '3', kind: 'added' },
      ],
    });
  });

  it('compares row by row without a key', () => {
    const diff = diffCsv('a\n1\n2', 'a\n1\n3\n4', byRow);

    assert.deepEqual(diff.rows, [
      { cells: [{ after: '3', before: '2', column: 'a' }], key: '2', kind: 'changed' },
      { key: '3', kind: 'added' },
    ]);

    assert.deepEqual(diffCsv('a\n1\n2', 'a\n1', byRow).rows, [{ key: '2', kind: 'removed' }]);
  });

  it('rejects duplicate keys and missing key columns, naming the side', () => {
    assert.throws(() => diffCsv('id\n1\n2\n2', 'id\n1', byId), {
      message: /Duplicate key "2" in the first CSV/,
    });

    assert.throws(() => diffCsv('id\n1', 'id\n2\n2', byId), {
      message: /Duplicate key "2" in the second CSV/,
    });

    assert.throws(() => diffCsv('id\n1', 'v\n1', byId), {
      message: /^Key column "id" not found in the second CSV\.$/,
    });

    assert.throws(() => diffCsv('v\n1', 'id\n1', byId), {
      message: /Key column "id" not found in the first CSV\./,
    });
  });

  it('reports added and removed columns and compares only shared ones', () => {
    assert.deepEqual(diffCsv('id,a,b\n1,x,y', 'id,b,c\n1,y,z', byId), {
      added: 0,
      addedColumns: ['c'],
      changed: 0,
      removed: 0,
      removedColumns: ['a'],
      rows: [],
    });
  });

  it('treats CRLF like LF, a BOM as nothing and detects each separator', () => {
    assert.deepEqual(
      diffCsv(`${String.fromCharCode(0xfeff)}id,v\r\n1,a\r\n`, 'id;v\n1;a', byId).rows,
      [],
    );
  });

  it('fills ragged rows with empty cells and keeps empty keys', () => {
    assert.deepEqual(diffCsv('id,v\n1\n,a', 'id,v\n1,\n,b,extra', byId).rows, [
      { cells: [{ after: 'b', before: 'a', column: 'v' }], key: '', kind: 'changed' },
    ]);
  });

  it('compares values exactly', () => {
    assert.equal(diffCsv('id,v\n1,a\n2,1.0\n3,x', 'id,v\n1,A\n2,1\n3, x', byId).changed, 3);
  });

  it('rejects repeated and empty header names, naming the side', () => {
    assert.throws(() => diffCsv('id,a,a\n1,x,y', 'id,a,a\n1,x,z', byId), {
      message: /^Duplicate column name "a" in the first CSV; rename it so no change is missed\.$/,
    });

    assert.throws(() => diffCsv('id,a\n1,x', 'id,,\n1,,', byId), {
      message: /^Duplicate column name "" in the second CSV; rename it so no change is missed\.$/,
    });
  });

  it('accepts prototype names as keys and headers', () => {
    const diff = diffCsv('__proto__,toString\ntoString,1', '__proto__,toString\ntoString,2', {
      key: '__proto__',
    });

    assert.deepEqual(diff.rows, [
      {
        cells: [{ after: '2', before: '1', column: 'toString' }],
        key: 'toString',
        kind: 'changed',
      },
    ]);
  });

  it('caps reported changes at 10,000 and keeps exact counts', () => {
    const rows = (value: string) =>
      `id,v\n${Array.from({ length: 10_001 }, (_, index) => `${index},${value}`).join('\n')}`;
    const diff = diffCsv(rows('a'), rows('b'), byId);

    assert.equal(diff.changed, 10_001);
    assert.equal(diff.rows.length, 10_000);
  });

  it('stops reporting when the report reaches 10,000,000 characters', () => {
    const name = 'n'.repeat(2_000);
    const rows = (value: string) =>
      `id,${name}\n${Array.from({ length: 6_000 }, (_, index) => `${index},${value}`).join('\n')}`;
    const diff = diffCsv(rows('a'), rows('b'), byId);

    assert.equal(diff.changed, 6_000);
    assert.ok(diff.rows.length < 6_000);
  });

  it('requires both inputs and names the side of a parse error', () => {
    assert.throws(() => diffCsv(' ', 'a', byRow), { message: /First CSV input is required\./ });
    assert.throws(() => diffCsv('a', '\n', byRow), { message: /Second CSV input is required\./ });
    assert.throws(() => diffCsv('a', 'a\n"x', byRow), { message: /^Second CSV: / });
  });
});

describe('CSV to SQL INSERT', () => {
  const postgres = {
    batchSize: 100,
    dialect: 'postgres',
    emptyAsNull: true,
    table: 'users',
  } as const;
  const nul = String.fromCharCode(0);

  it('writes one multi-row INSERT with doubled quotes and NULL for empty cells', () => {
    assert.deepEqual(csvToSqlInsert("id,name\n1,O'Neil\n2,", postgres), {
      rows: 2,
      statements: 1,
      text: "INSERT INTO \"users\" (\"id\", \"name\") VALUES\n  ('1', 'O''Neil'),\n  ('2', NULL);\n",
    });
  });

  it('quotes identifiers per dialect and doubles the closing quote', () => {
    const csv = 'na]me,a`b,"c""d"\n1,2,3';
    const text = (dialect: 'mysql' | 'postgres' | 'sqlite' | 'sqlserver') =>
      csvToSqlInsert(csv, { ...postgres, dialect, table: 'app.users' }).text.split('\n')[0];

    assert.equal(text('postgres'), 'INSERT INTO "app"."users" ("na]me", "a`b", "c""d") VALUES');
    assert.equal(text('sqlite'), 'INSERT INTO "app"."users" ("na]me", "a`b", "c""d") VALUES');
    assert.equal(text('mysql'), 'INSERT INTO `app`.`users` (`na]me`, `a``b`, `c"d`) VALUES');
    assert.equal(text('sqlserver'), 'INSERT INTO [app].[users] ([na]]me], [a`b], [c"d]) VALUES');
  });

  it('escapes backslashes for MySQL only', () => {
    const csv = "v\na\\'b";

    assert.equal(
      csvToSqlInsert(csv, { ...postgres, dialect: 'mysql' }).text,
      "INSERT INTO `users` (`v`) VALUES\n  ('a\\\\''b');\n",
    );

    assert.equal(
      csvToSqlInsert(csv, postgres).text,
      'INSERT INTO "users" ("v") VALUES\n  (\'a\\\'\'b\');\n',
    );
  });

  it('prefixes SQL Server literals with non-ASCII characters with N', () => {
    assert.equal(
      csvToSqlInsert('v\nZoë\nAda\n日本', { ...postgres, dialect: 'sqlserver' }).text,
      "INSERT INTO [users] ([v]) VALUES\n  (N'Zoë'),\n  ('Ada'),\n  (N'日本');\n",
    );

    assert.match(csvToSqlInsert('v\nZoë', postgres).text, /\('Zoë'\)/);
  });

  it('splits rows into batches and validates the batch size', () => {
    const result = csvToSqlInsert('a\n1\n2', { ...postgres, batchSize: 1 });

    assert.equal(result.statements, 2);

    assert.equal(
      result.text,
      'INSERT INTO "users" ("a") VALUES\n  (\'1\');\nINSERT INTO "users" ("a") VALUES\n  (\'2\');\n',
    );

    for (const batchSize of [0, 1_001, 1.5, Number.NaN])
      assert.throws(() => csvToSqlInsert('a\n1', { ...postgres, batchSize }), {
        message: /1-1,000/,
      });
  });

  it('validates the table name', () => {
    for (const table of ['a b', '', '1users', 'a.b.c', 'a.', 'users;drop', '"users"'])
      assert.throws(() => csvToSqlInsert('a\n1', { ...postgres, table }), {
        message: /^Table name must be /,
      });

    assert.match(
      csvToSqlInsert('a\n1', { ...postgres, table: 'public.my_$table' }).text,
      /^INSERT INTO "public"."my_\$table" /,
    );
  });

  it('rejects empty, repeated and NUL header names', () => {
    assert.throws(() => csvToSqlInsert('a,,b\n1,2,3', postgres), {
      message: /Column 2 has an empty header name/,
    });

    assert.throws(() => csvToSqlInsert('a,b,a\n1,2,3', postgres), {
      message: /Duplicate column name "a"/,
    });

    assert.throws(() => csvToSqlInsert(`a,b${nul}\n1,2`, postgres), {
      message: /Column 2 header contains a NUL character/,
    });
  });

  it('rejects NUL values, naming the row and column', () => {
    assert.throws(() => csvToSqlInsert(`a,b\n1,2\n3,x${nul}`, postgres), {
      message: /^Data row 2, column 2 \("b"\) contains a NUL character/,
    });
  });

  it('rejects SQL Server backslash line continuations, naming the row and column', () => {
    const sqlserver = { ...postgres, dialect: 'sqlserver' } as const;

    for (const lineBreak of ['\n', '\r\n', '\r'])
      assert.throws(() => csvToSqlInsert(`a,b\n1,"C:\\dir\\${lineBreak}next"`, sqlserver), {
        message:
          /^Data row 1, column 2 \("b"\) .*SQL Server would drop a backslash followed by a line break.* import/,
      });

    assert.equal(
      csvToSqlInsert('a\n"C:\\dir\\ \nnext"\nend\\', sqlserver).text,
      "INSERT INTO [users] ([a]) VALUES\n  ('C:\\dir\\ \nnext'),\n  ('end\\');\n",
    );

    for (const dialect of ['mysql', 'postgres', 'sqlite'] as const)
      assert.match(
        csvToSqlInsert('a\n"C:\\dir\\\r\nnext"', { ...postgres, dialect }).text,
        /dir\\+\r\nnext/,
      );
  });

  it('rejects long rows and pads short rows', () => {
    assert.throws(() => csvToSqlInsert('a,b\n1,2\n1,2,3', postgres), {
      message: /^Data row 2 has 3 cells; the header has 2 columns\./,
    });

    assert.match(csvToSqlInsert('a,b,c\n1', postgres).text, /\('1', NULL, NULL\);/);

    assert.match(
      csvToSqlInsert('a,b,c\n1,', { ...postgres, emptyAsNull: false }).text,
      /\('1', '', ''\);/,
    );
  });

  it('writes nothing for a header-only CSV', () => {
    assert.deepEqual(csvToSqlInsert('id,name\n', postgres), { rows: 0, statements: 0, text: '' });
  });

  it('handles CRLF, a byte order mark, other separators and prototype names', () => {
    assert.equal(
      csvToSqlInsert(`${String.fromCharCode(0xfeff)}__proto__;toString\r\n1;"x\r\ny"\r\n`, postgres)
        .text,
      'INSERT INTO "users" ("__proto__", "toString") VALUES\n  (\'1\', \'x\r\ny\');\n',
    );
  });

  it('caps the output at 20,000,000 characters before building it', () => {
    const csv = `${'n'.repeat(200_000)}\n${Array.from({ length: 100 }, () => '1').join('\n')}`;

    assert.throws(() => csvToSqlInsert(csv, { ...postgres, batchSize: 1 }), {
      message: /SQL output supports up to 20,000,000 characters/,
    });

    assert.equal(csvToSqlInsert(csv, postgres).statements, 1);
  });

  it('requires input', () => {
    assert.throws(() => csvToSqlInsert(' \n', postgres), { message: /CSV input is required\./ });
  });
});
