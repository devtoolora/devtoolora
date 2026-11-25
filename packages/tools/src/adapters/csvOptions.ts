import { ToolError, type ToolField } from '@devtoolora/core';
import type { CsvDelimiter, CsvParseOptions, CsvWriteOptions } from '@devtoolora/functions/format';

export const csvSeparatorField: ToolField = {
  defaultValue: 'comma',
  help: 'Choose the actual separator; it is not guessed. Tab produces or reads TSV.',
  id: 'delimiter',
  label: 'Separator',
  options: [
    { label: 'Comma', value: 'comma' },
    { label: 'Semicolon', value: 'semicolon' },
    { label: 'Tab', value: 'tab' },
  ],
  presentation: 'segmented',
  type: 'select',
};

export const csvReadFields: ToolField[] = [
  csvSeparatorField,
  {
    defaultValue: 'true',
    help: 'Skip only lines with no characters outside quoted fields. Quoted empty cells, separators and whitespace-only cells are kept.',
    id: 'skipEmptyLines',
    label: 'Skip blank lines',
    type: 'checkbox',
  },
];

export function csvParseOptions(fields: Record<string, string>): CsvParseOptions {
  return {
    delimiter: delimiterValue(fields.delimiter),
    skipEmptyLines: checkboxValue(fields.skipEmptyLines, true),
  };
}

export function csvWriteOptions(fields: Record<string, string>): CsvWriteOptions {
  const lineEnding = fields.lineEnding || 'lf';

  if (lineEnding !== 'lf' && lineEnding !== 'crlf')
    throw new ToolError('Choose LF or CRLF line endings.');

  return {
    delimiter: delimiterValue(fields.delimiter),
    escapeFormulas: checkboxValue(fields.escapeFormulas, false),
    lineEnding: lineEnding === 'crlf' ? '\r\n' : '\n',
  };
}

function delimiterValue(value: string | undefined): CsvDelimiter {
  if (!value || value === 'comma') return ',';
  if (value === 'semicolon') return ';';
  if (value === 'tab') return '\t';

  throw new ToolError('Choose comma, semicolon or tab as the separator.');
}

function checkboxValue(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  if (value !== 'true' && value !== 'false')
    throw new ToolError('Checkbox values must be true or false.');

  return value === 'true';
}
