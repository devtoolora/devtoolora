import type { DialectOptions, FormatOptionsWithDialect } from 'sql-formatter';
import { FunctionError } from '../errors';
import { requiredText } from './shared';

export type SqlDialect =
  'bigquery' | 'mysql' | 'plsql' | 'postgresql' | 'sql' | 'sqlite' | 'transactsql';
export type SqlIndentation = 2 | 4 | 'tab';
export type SqlKeywordCase = 'lower' | 'preserve' | 'upper';

export interface SqlFormatOptions {
  dialect?: SqlDialect;
  indentation?: SqlIndentation;
  keywordCase?: SqlKeywordCase;
}

export const SQL_DIALECTS: readonly SqlDialect[] = [
  'sql',
  'postgresql',
  'mysql',
  'sqlite',
  'transactsql',
  'bigquery',
  'plsql',
];

type SqlFormatterModule = typeof import('sql-formatter');

type SqlScriptPart =
  | { delimiter: string; keyword: string; kind: 'command'; start: number }
  | { kind: 'sql'; start: number; terminator: string; text: string };

let sqlFormatterPromise: Promise<SqlFormatterModule> | undefined;

// Loaded on first use so the browser worker entry does not carry the formatter grammar for every
// tool.
function loadSqlFormatter(): Promise<SqlFormatterModule> {
  sqlFormatterPromise ??= import('sql-formatter');

  return sqlFormatterPromise;
}

export async function formatSql(text: string, options: SqlFormatOptions = {}): Promise<string> {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  requiredText(source, 'SQL');
  const { dialect = 'sql', indentation = 2, keywordCase = 'upper' } = options;

  if (
    !SQL_DIALECTS.includes(dialect) ||
    (indentation !== 2 && indentation !== 4 && indentation !== 'tab') ||
    (keywordCase !== 'upper' && keywordCase !== 'lower' && keywordCase !== 'preserve')
  ) {
    throw new FunctionError(
      'INVALID_SQL_OPTIONS',
      'Choose a supported SQL dialect, indentation and keyword case.',
    );
  }

  const formatter = await loadSqlFormatter();
  const dialects: Record<SqlDialect, DialectOptions> = {
    bigquery: formatter.bigquery,
    mysql: formatter.mysql,
    plsql: formatter.plsql,
    postgresql: formatter.postgresql,
    sql: formatter.sql,
    sqlite: formatter.sqlite,
    transactsql: formatter.transactsql,
  };
  const config: FormatOptionsWithDialect = {
    dialect: dialects[dialect],
    keywordCase,
    tabWidth: indentation === 'tab' ? 2 : indentation,
    useTabs: indentation === 'tab',
  };

  const format = (sql: string, start: number): string => {
    const trimmed = sql.trim();

    try {
      return formatter.formatDialect(trimmed, config);
    } catch (error: unknown) {
      throw sqlError(error, dialect, source, start + sql.length - sql.trimStart().length, trimmed);
    }
  };

  const parts = splitDelimiterScript(source);

  if (!parts) return format(source, 0);

  const command = parts.find((part) => part.kind === 'command');

  if (dialect !== 'mysql' && command) {
    throw new FunctionError(
      'UNSUPPORTED_SQL_DELIMITER',
      `DELIMITER at line ${lineColumn(source, command.start).line} is a MySQL client command. Choose MySQL to keep DELIMITER blocks, or remove the DELIMITER lines.`,
    );
  }

  const blocks = parts.map((part) => {
    if (part.kind === 'command')
      return `${delimiterKeyword(part.keyword, keywordCase)} ${part.delimiter}`;

    const formatted = format(part.text, part.start);

    if (!part.terminator) return formatted;

    // A delimiter after a line comment would be commented out, so it moves to the next line.
    const lastLine = formatted.slice(formatted.lastIndexOf('\n') + 1);

    return `${formatted}${/--|#/.test(lastLine) ? '\n' : ' '}${part.terminator}`;
  });

  return blocks.map((block, index) => blockSeparator(parts[index - 1]) + block).join('');
}

function delimiterKeyword(keyword: string, keywordCase: SqlKeywordCase): string {
  if (keywordCase === 'upper') return 'DELIMITER';
  if (keywordCase === 'lower') return 'delimiter';

  return keyword;
}

function blockSeparator(previous: SqlScriptPart | undefined): string {
  if (!previous) return '';

  return previous.kind === 'command' ? '\n' : '\n\n';
}

const delimiterCommand = /[ \t]*(delimiter)[ \t]+(\S+)[ \t]*(?=\r\n|\n|\r|$)/iy;

function splitDelimiterScript(source: string): SqlScriptPart[] | undefined {
  const parts: SqlScriptPart[] = [];
  let delimiter = ';';
  let partStart = 0;
  let hasCode = false;
  let lineStart = true;
  let index = 0;

  const pushSql = (end: number, terminator: string): void => {
    const text = source.slice(partStart, end);

    if (text.trim()) parts.push({ kind: 'sql', start: partStart, terminator, text });
  };

  while (index < source.length) {
    if (lineStart && !hasCode) {
      delimiterCommand.lastIndex = index;
      const match = delimiterCommand.exec(source);

      if (match) {
        pushSql(index, '');
        parts.push({ delimiter: match[2]!, keyword: match[1]!, kind: 'command', start: index });
        delimiter = match[2]!;
        index += match[0].length;
        partStart = index;

        continue;
      }
    }

    lineStart = false;
    const character = source.charAt(index);

    if (character === '\n' || character === '\r') {
      lineStart = true;
      index += 1;
    } else if (
      character === '#' ||
      (source.startsWith('--', index) && /^(?:\s|$)/.test(source.charAt(index + 2)))
    ) {
      while (index < source.length && source[index] !== '\n' && source[index] !== '\r') index += 1;
    } else if (source.startsWith('/*', index)) {
      if (source[index + 2] === '!') hasCode = true;

      const end = source.indexOf('*/', index + 2);

      index = end < 0 ? source.length : end + 2;
    } else if (character === "'" || character === '"' || character === '`') {
      hasCode = true;
      index += 1;
      while (index < source.length && source[index] !== character)
        index += character !== '`' && source[index] === '\\' ? 2 : 1;
      index += 1;
    } else if (source.startsWith(delimiter, index)) {
      index += delimiter.length;

      if (delimiter !== ';') {
        pushSql(index - delimiter.length, delimiter);
        partStart = index;
      }

      hasCode = false;
    } else {
      if (!/\s/.test(character)) hasCode = true;

      index += 1;
    }
  }

  if (!parts.some((part) => part.kind === 'command')) return undefined;

  pushSql(source.length, '');

  return parts;
}

function sqlError(
  error: unknown,
  dialect: SqlDialect,
  source: string,
  start: number,
  sql: string,
): FunctionError {
  const message = error instanceof Error ? error.message : '';
  const parserError =
    /^Parse error at token: ([\s\S]*?) at line (\d+) column (\d+)\nUnexpected /.exec(message);
  const tokenizerError = /^Parse error: Unexpected "[\s\S]*?" at line (\d+) column (\d+)\./.exec(
    message,
  );
  const position = parserError ? parserError.slice(2) : tokenizerError?.slice(1);

  if (!position) {
    const detail =
      message.startsWith('Parse error: Invalid SQL') ||
      message.startsWith('Parse error: Ambiguous grammar')
        ? 'The statement is incomplete or could not be parsed.'
        : (message.split('\n')[0] ?? '').slice(0, 200) || 'The SQL syntax could not be formatted.';

    return new FunctionError(
      'INVALID_SQL',
      `Could not format SQL (${dialect}). Check the selected dialect and source syntax. ${detail}`,
    );
  }

  const index = start + indexAt(sql, Number(position[0]), Number(position[1]));
  let token: string;

  if (parserError) token = parserError[1]!;
  else token = /^\S*/.exec(source.slice(index))?.[0] ?? '';

  const unexpected =
    token === '«EOF»' || !token
      ? 'end of input'
      : JSON.stringify(token.length > 40 ? `${token.slice(0, 40)}…` : token);
  const { column, line } = lineColumn(source, index);

  return new FunctionError(
    'INVALID_SQL',
    `Could not format SQL (${dialect}) at line ${line}, column ${column}: unexpected ${unexpected}. Check the selected dialect and the syntax near that position.`,
  );
}

/** The formatter counts lines by \n and columns from 1. */
function indexAt(text: string, line: number, column: number): number {
  let index = 0;

  for (let current = 1; current < line; current += 1) index = text.indexOf('\n', index) + 1;

  return Math.min(index + column - 1, text.length);
}

function lineColumn(text: string, index: number): { column: number; line: number } {
  const lines = text.slice(0, index).split(/\r\n|\r|\n/);

  return { column: (lines.at(-1) ?? '').length + 1, line: lines.length };
}
