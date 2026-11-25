import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { csvToSqlInsert, type CsvSqlDialect } from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities } from '../shared';

const dialects = new Map<string, CsvSqlDialect>([
  ['mysql', 'mysql'],
  ['postgres', 'postgres'],
  ['sqlite', 'sqlite'],
  ['sqlserver', 'sqlserver'],
]);

const dialectNames: Record<CsvSqlDialect, string> = {
  mysql: 'MySQL',
  postgres: 'PostgreSQL',
  sqlite: 'SQLite',
  sqlserver: 'SQL Server',
};

function count(value: number, noun: string): string {
  return `${value.toLocaleString('en-US')} ${noun}${value === 1 ? '' : 's'}`;
}

function dialectField(value: string | undefined): CsvSqlDialect {
  const dialect = dialects.get(value ?? 'postgres');

  if (!dialect) throw new ToolError('Choose PostgreSQL, MySQL, SQLite or SQL Server.');

  return dialect;
}

function emptyAsNullField(value: string | undefined): boolean {
  if (value === undefined || value === 'true') return true;
  if (value === 'false') return false;

  throw new ToolError('Checkbox values must be true or false.');
}

function convert(fields: Record<string, string>, text: string) {
  const dialect = dialectField(fields.dialect);
  const result = csvToSqlInsert(text, {
    batchSize: Number(fields.batchSize ?? '100'),
    dialect,
    emptyAsNull: emptyAsNullField(fields.emptyAsNull),
    table: fields.table ?? 'my_table',
  });

  return {
    artifact: {
      base64: encodeBase64Text(result.text),
      fileName: 'insert.sql',
      mimeType: 'text/plain;charset=utf-8',
    },
    language: 'sql',
    summary: result.rows
      ? `${count(result.rows, 'row')} in ${count(result.statements, 'INSERT statement')} for ${dialectNames[dialect]}.`
      : 'No data rows to insert.',
    text: result.text,
  };
}

export const csvToSqlTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  description:
    'Turn CSV into SQL INSERT statements locally for PostgreSQL, MySQL, SQLite or SQL Server, with dialect-correct quoting, NULL for empty cells and batched rows.',
  fields: [
    {
      defaultValue: '100',
      help: 'Rows in each INSERT statement, 1-1,000. SQL Server accepts at most 1,000 rows per VALUES list.',
      id: 'batchSize',
      label: 'Rows per INSERT',
      type: 'number',
    },
    {
      defaultValue: 'postgres',
      help: 'Sets identifier quoting and string escaping.',
      id: 'dialect',
      label: 'SQL dialect',
      options: [
        { label: 'PostgreSQL', value: 'postgres' },
        { label: 'MySQL', value: 'mysql' },
        { label: 'SQLite', value: 'sqlite' },
        { label: 'SQL Server', value: 'sqlserver' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'true',
      help: "Off writes empty and missing cells as '' instead of NULL.",
      id: 'emptyAsNull',
      label: 'Empty cells as NULL',
      type: 'checkbox',
    },
    {
      defaultValue: 'my_table',
      help: 'A name or schema.name of letters, digits, _ and $, each part starting with a letter or _.',
      id: 'table',
      label: 'Table name',
      placeholder: 'public.users',
      type: 'text',
    },
  ],
  id: 'csv-to-sql',
  inputKind: 'text',
  keywords: [
    'csv',
    'sql',
    'insert',
    'csv to sql',
    'insert statements',
    'postgresql',
    'mysql',
    'sqlite',
    'sql server',
    'seed data',
    'import',
  ],
  name: 'CSV to SQL',
  outputKind: 'text',
  relatedToolIds: ['sql-format', 'json-to-csv', 'string-escaper'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) => withToolError(() => convert(fields, text)),
  samples: [
    {
      fields: { batchSize: '100', dialect: 'postgres', emptyAsNull: 'true', table: 'users' },
      label: 'PostgreSQL users',
      text: "id,name,email\n1,Ada Lovelace,ada@example.com\n2,Grace O'Brien,\n",
    },
    {
      fields: { batchSize: '100', dialect: 'mysql', emptyAsNull: 'true', table: 'shop.products' },
      label: 'MySQL with schema',
      text: 'sku,title,path\nA1,"Cable, 2 m",C:\\temp\\a.txt\nB2,Adapter,\n',
    },
    {
      fields: { batchSize: '100', dialect: 'sqlite', emptyAsNull: 'false', table: 'notes' },
      label: 'SQLite, empty as text',
      text: 'id,body,tag\n1,"Line one\nLine two",\n2,Plain,todo\n',
    },
    {
      fields: { batchSize: '100', dialect: 'sqlserver', emptyAsNull: 'true', table: 'dbo.cities' },
      label: 'SQL Server Unicode',
      text: 'name,country\nZürich,CH\nPrague,CZ\n東京,JP\n',
    },
    {
      fields: { batchSize: '2', dialect: 'postgres', emptyAsNull: 'true', table: 'events' },
      label: 'Batches of 2 rows',
      text: 'id,kind\n1,open\n2,click\n3,close\n4,open\n5,click\n',
    },
    {
      fields: { batchSize: '100', dialect: 'postgres', emptyAsNull: 'true', table: 'orders' },
      label: 'Semicolon CSV, short rows',
      text: 'id;status;note\n1;new\n2;paid;"say ""hi"""\n',
    },
  ],
  supportsSelection: true,
};

export const csvToSqlInsertTool: ToolDefinition = {
  ...csvToSqlTool,
  aliasOf: 'csv-to-sql',
  id: 'csv-to-sql-insert',
  name: 'CSV to SQL INSERT',
};
