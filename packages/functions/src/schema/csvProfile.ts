import { FunctionError } from '../errors';
import { parseCsvTable } from '../format';
import type { CsvParseOptions } from '../format';

type CsvColumnProfile = {
  max?: string | number;
  min?: string | number;
  missing: number;
  name: string;
  samples: string[];
  type: 'integer' | 'number' | 'boolean' | 'date' | 'string' | 'empty';
  unique: number;
};

export function profileCsv(text: string, options: CsvParseOptions = {}): string {
  const { headers, records: values } = parseCsvTable(text, options);

  if (values.length === 0) {
    throw schemaError('CSV must contain at least one data row.');
  }

  const profiles = headers.map((name, index) =>
    profileColumn(
      name,
      values.map((row) => row[index] ?? ''),
    ),
  );

  return [
    '# CSV Profile',
    '',
    `Rows: ${values.length}`,
    `Columns: ${headers.length}`,
    '',
    ...profiles.map(renderColumnProfile),
  ].join('\n');
}

function profileColumn(name: string, values: string[]): CsvColumnProfile {
  const nonEmpty = values.map((value) => value.trim()).filter((value) => value !== '');
  const type = inferCsvType(nonEmpty);
  const profile: CsvColumnProfile = {
    name,
    missing: values.length - nonEmpty.length,
    samples: [...new Set(nonEmpty)].slice(0, 3),
    type,
    unique: new Set(nonEmpty).size,
  };

  if (type === 'integer' || type === 'number') {
    if (type === 'integer') {
      const numbers = nonEmpty.map((value: string) => BigInt(value));
      const minimum = numbers.reduce((left: bigint, right: bigint) =>
        left < right ? left : right,
      );
      const maximum = numbers.reduce((left: bigint, right: bigint) =>
        left > right ? left : right,
      );
      const hasUnsafeInteger = numbers.some(
        (value: bigint) =>
          value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER),
      );

      profile.min = hasUnsafeInteger ? String(minimum) : Number(minimum);
      profile.max = hasUnsafeInteger ? String(maximum) : Number(maximum);
    } else {
      const numbers = nonEmpty.map(Number);

      profile.min = numbers.reduce((left: number, right: number) => Math.min(left, right));
      profile.max = numbers.reduce((left: number, right: number) => Math.max(left, right));
    }
  }

  if (type === 'date') {
    const sorted = [...nonEmpty].sort();

    profile.min = sorted[0];
    profile.max = sorted[sorted.length - 1];
  }

  return profile;
}

function renderColumnProfile(profile: CsvColumnProfile): string {
  return [
    `## ${profile.name.replace(/[\r\n]/g, (character: string) => (character === '\r' ? '\\r' : '\\n'))}`,
    `Type: ${profile.type}`,
    `Missing: ${profile.missing}`,
    `Unique: ${profile.unique}`,
    profile.min !== undefined ? `Min: ${profile.min}` : undefined,
    profile.max !== undefined ? `Max: ${profile.max}` : undefined,
    `Samples: ${profile.samples.length ? profile.samples.map((sample: string) => JSON.stringify(sample)).join(', ') : '(none)'}`,
    '',
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}

function inferCsvType(values: string[]): CsvColumnProfile['type'] {
  if (values.length === 0) {
    return 'empty';
  }

  if (values.every((value) => /^-?(0|[1-9]\d*)$/.test(value))) {
    return 'integer';
  }

  if (
    values.every(
      (value) =>
        /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(value) && Number.isFinite(Number(value)),
    )
  ) {
    return 'number';
  }

  if (values.every((value) => /^(true|false)$/i.test(value))) {
    return 'boolean';
  }

  if (
    values.every(
      (value) =>
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
        new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value,
    )
  ) {
    return 'date';
  }

  return 'string';
}

function schemaError(message: string): FunctionError {
  return new FunctionError('SCHEMA_ERROR', message);
}
