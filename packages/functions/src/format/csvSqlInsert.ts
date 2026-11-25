import { parseCsv } from './csv';
import { FunctionError } from '../errors';
import { detectCsvDelimiter } from './csvTools';
import { requiredText } from './shared';

export type CsvSqlDialect = 'mysql' | 'postgres' | 'sqlite' | 'sqlserver';

export interface CsvSqlInsertOptions {
  batchSize: number;
  dialect: CsvSqlDialect;
  emptyAsNull: boolean;
  table: string;
}

export interface CsvSqlInsert {
  rows: number;
  statements: number;
  text: string;
}

interface SqlSyntax {
  identifier: (name: string) => string;
  invalidValue?: (value: string) => string | undefined;
  literal: (value: string) => string;
}

const csvSqlLimits = { batchSize: 1_000, characters: 20_000_000 };
const sqlTableName = /^[A-Za-z_][A-Za-z0-9_$]*(\.[A-Za-z_][A-Za-z0-9_$]*)?$/;
const nonAscii = /[^\x00-\x7f]/;

function standardLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function doubleQuoted(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

const sqlSyntaxes = new Map<string, SqlSyntax>([
  [
    'mysql',
    {
      identifier: (name) => `\`${name.replaceAll('`', '``')}\``,
      // MySQL reads backslash escapes in literals unless NO_BACKSLASH_ESCAPES is set.
      literal: (value) => standardLiteral(value.replaceAll('\\', '\\\\')),
    },
  ],
  ['postgres', { identifier: doubleQuoted, literal: standardLiteral }],
  ['sqlite', { identifier: doubleQuoted, literal: standardLiteral }],
  [
    'sqlserver',
    {
      identifier: (name) => `[${name.replaceAll(']', ']]')}]`,
      // T-SQL treats a backslash before a line break in a literal as a line continuation.
      invalidValue: (value) =>
        /\\[\r\n]/.test(value)
          ? 'contains a backslash before a line break; SQL Server would drop a backslash followed by a line break and the line break with it. Use another import path, such as BULK INSERT, bcp or bound parameters.'
          : undefined,
      // Without N, SQL Server converts the literal to the database code page.
      literal: (value) => `${nonAscii.test(value) ? 'N' : ''}${standardLiteral(value)}`,
    },
  ],
]);

export function csvToSqlInsert(input: string, options: CsvSqlInsertOptions): CsvSqlInsert {
  requiredText(input, 'CSV');

  const syntax = csvSqlSyntax(options);
  const [header = [], ...records] = parseCsv(input, { delimiter: detectCsvDelimiter(input) });
  const table = options.table.split('.').map(syntax.identifier).join('.');
  const prefix = `INSERT INTO ${table} (${sqlColumns(header, syntax)}) VALUES\n`;
  const tuples = records.map((row: string[], index: number) =>
    sqlTuple(row, index + 1, header, syntax, options.emptyAsNull),
  );
  const statements = Math.ceil(tuples.length / options.batchSize);
  const characters = tuples.reduce(
    (sum: number, tuple: string) => sum + tuple.length + 4,
    statements * prefix.length,
  );

  if (characters > csvSqlLimits.characters)
    throw csvSqlError(
      'SQL output supports up to 20,000,000 characters; use a larger batch size or fewer rows.',
    );

  let text = '';

  for (let start = 0; start < tuples.length; start += options.batchSize)
    text += `${prefix}${tuples
      .slice(start, start + options.batchSize)
      .map((tuple: string) => `  ${tuple}`)
      .join(',\n')};\n`;

  return { rows: tuples.length, statements, text };
}

function csvSqlSyntax(options: CsvSqlInsertOptions): SqlSyntax {
  const syntax = sqlSyntaxes.get(options.dialect);
  const { batchSize } = options;

  if (!syntax) throw csvSqlError('SQL dialect must be mysql, postgres, sqlite or sqlserver.');
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > csvSqlLimits.batchSize)
    throw csvSqlError('Batch size must be a whole number of 1-1,000 rows per INSERT.');
  if (!sqlTableName.test(options.table))
    throw csvSqlError(
      'Table name must be a name or schema.name made of letters, digits, _ and $, each part starting with a letter or _.',
    );

  return syntax;
}

function sqlColumns(header: string[], syntax: SqlSyntax): string {
  const seen = new Set<string>();

  for (const [index, name] of header.entries()) {
    if (!name)
      throw csvSqlError(
        `Column ${index + 1} has an empty header name; every SQL column needs one.`,
      );
    if (name.includes('\0'))
      throw csvSqlError(
        `Column ${index + 1} header contains a NUL character, which cannot be quoted safely.`,
      );
    if (seen.has(name))
      throw csvSqlError(`Duplicate column name "${name}"; an INSERT can list a column only once.`);

    seen.add(name);
  }

  return header.map(syntax.identifier).join(', ');
}

function sqlTuple(
  row: string[],
  rowNumber: number,
  header: string[],
  syntax: SqlSyntax,
  emptyAsNull: boolean,
): string {
  if (row.length > header.length)
    throw csvSqlError(
      `Data row ${rowNumber} has ${row.length} cells; the header has ${header.length} ${header.length === 1 ? 'column' : 'columns'}.`,
    );

  const values = header.map((name: string, at: number) => {
    const value = row[at] ?? '';

    if (value.includes('\0'))
      throw csvSqlError(
        `Data row ${rowNumber}, column ${at + 1} ("${name}") contains a NUL character, which cannot be written safely as an SQL literal.`,
      );

    const invalid = syntax.invalidValue?.(value);

    if (invalid)
      throw csvSqlError(`Data row ${rowNumber}, column ${at + 1} ("${name}") ${invalid}`);

    return !value && emptyAsNull ? 'NULL' : syntax.literal(value);
  });

  return `(${values.join(', ')})`;
}

function csvSqlError(message: string): FunctionError {
  return new FunctionError('INVALID_CSV_SQL', message);
}
