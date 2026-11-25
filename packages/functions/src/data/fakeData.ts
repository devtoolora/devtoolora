import { FunctionError } from '../errors';
import type { RecordContext } from './fakeDataGenerators';
import { createFieldGenerator, csvCell, fakeError, pick, stream } from './fakeDataGenerators';
import { FIRST_NAMES, LAST_NAMES, LOCATIONS } from './fakeDataWords';
import { generateSeededUsers } from './seededUsers';

export type FakeValue = string | number | boolean | null;
export type FakeRecord = Record<string, FakeValue>;
export type FakeDataFormat = 'json' | 'ndjson' | 'csv';

export type FakeFieldType =
  | 'address'
  | 'boolean'
  | 'city'
  | 'color'
  | 'company'
  | 'country'
  | 'countryCode'
  | 'date'
  | 'datetime'
  | 'email'
  | 'enum'
  | 'firstName'
  | 'float'
  | 'integer'
  | 'ipv4'
  | 'jobTitle'
  | 'lastName'
  | 'name'
  | 'paragraph'
  | 'phone'
  | 'postcode'
  | 'sentence'
  | 'sequence'
  | 'url'
  | 'username'
  | 'uuid'
  | 'word';

export type FakeField = { args: string[]; name: string; nullable: boolean; type: FakeFieldType };

export type FakeDataset = {
  columns: string[];
  defaultUsers: boolean;
  fields: FakeField[];
  records: FakeRecord[];
};

export const fakeDataLimits = {
  count: 1000,
  fields: 100,
  outputCharacters: 5_000_000,
  specCharacters: 20_000,
} as const;

const TYPE_ALIASES: Record<string, FakeFieldType> = {
  address: 'address',
  bool: 'boolean',
  boolean: 'boolean',
  city: 'city',
  color: 'color',
  company: 'company',
  country: 'country',
  countrycode: 'countryCode',
  date: 'date',
  datetime: 'datetime',
  decimal: 'float',
  email: 'email',
  enum: 'enum',
  firstname: 'firstName',
  float: 'float',
  fullname: 'name',
  increment: 'sequence',
  int: 'integer',
  integer: 'integer',
  ipv4: 'ipv4',
  jobtitle: 'jobTitle',
  lastname: 'lastName',
  name: 'name',
  number: 'float',
  oneof: 'enum',
  paragraph: 'paragraph',
  phone: 'phone',
  postcode: 'postcode',
  sentence: 'sentence',
  sequence: 'sequence',
  serial: 'sequence',
  street: 'address',
  url: 'url',
  username: 'username',
  uuid: 'uuid',
  word: 'word',
  zip: 'postcode',
};

export function parseFakeDataSpec(spec: string): FakeField[] {
  if (spec.length > fakeDataLimits.specCharacters) {
    throw fakeError(
      `The field spec is limited to ${fakeDataLimits.specCharacters.toLocaleString('en-US')} characters.`,
    );
  }

  const fields: FakeField[] = [];
  const names = new Set<string>();

  spec.split(/\r\n|\r|\n/).forEach((source, index) => {
    const line = source.trim();

    if (line === '' || line.startsWith('#')) return;

    const separator = line.indexOf(':');
    const name = separator === -1 ? '' : line.slice(0, separator).trim();
    let definition = separator === -1 ? '' : line.slice(separator + 1).trim();

    if (!name || !definition)
      throw fakeError(`Line ${index + 1}: use "field: type", for example "email: email".`);
    if (names.has(name)) throw fakeError(`Line ${index + 1}: field "${name}" is declared twice.`);

    const nullable = definition.endsWith('?');

    if (nullable) definition = definition.slice(0, -1).trimEnd();

    const match = /^([A-Za-z][\w-]*)\s*(?:\((.*)\))?$/.exec(definition);
    const type = match ? TYPE_ALIASES[match[1]!.replace(/[-_]/g, '').toLowerCase()] : undefined;

    if (!match || !type)
      throw fakeError(
        `Line ${index + 1}: unknown type "${definition}". Use a type such as name, email, integer(1,100) or enum(a,b).`,
      );

    const args =
      match[2] === undefined || match[2].trim() === ''
        ? []
        : match[2].split(type === 'enum' ? /[,|]/ : ',').map((arg) => arg.trim());

    if (type === 'enum' && (args.length === 0 || args.some((arg) => arg === '')))
      throw fakeError(
        `Line ${index + 1}: enum needs non-empty values, for example enum(active,pending).`,
      );

    names.add(name);
    fields.push({ args, name, nullable, type });
  });

  if (fields.length > fakeDataLimits.fields)
    throw fakeError(`The field spec is limited to ${fakeDataLimits.fields} fields.`);

  return fields;
}

export function generateFakeDataset(spec: string, seed: number, count: number): FakeDataset {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new FunctionError('INVALID_SEED', 'Seed must be an integer from 0 through 4294967295.');
  if (!Number.isInteger(count) || count < 1 || count > fakeDataLimits.count)
    throw new FunctionError(
      'INVALID_COUNT',
      `Count must be an integer from 1 through ${fakeDataLimits.count}.`,
    );

  const fields = parseFakeDataSpec(spec);

  if (fields.length === 0) {
    return {
      columns: ['id', 'name', 'email', 'active'],
      defaultUsers: true,
      fields,
      records: generateSeededUsers(seed, count).map((user): FakeRecord => ({ ...user })),
    };
  }

  const generators = fields.map((field) => ({
    generate: createFieldGenerator(field, seed),
    name: field.name,
  }));
  const person = stream(seed, 'person');
  const location = stream(seed, 'location');
  const records = Array.from({ length: count }, (_value, index): FakeRecord => {
    const context: RecordContext = {
      first: pick(FIRST_NAMES, person),
      index,
      last: pick(LAST_NAMES, person),
      location: pick(LOCATIONS, location),
    };

    return Object.fromEntries(generators.map(({ generate, name }) => [name, generate(context)]));
  });

  return { columns: fields.map((field) => field.name), defaultUsers: false, fields, records };
}

function serializeFakeDataset(dataset: FakeDataset, format: FakeDataFormat): string {
  if (format === 'json') return JSON.stringify(dataset.records, null, 2);
  if (format === 'ndjson')
    return `${dataset.records.map((record) => JSON.stringify(record)).join('\n')}\n`;

  const rows = [
    dataset.columns,
    ...dataset.records.map((record) => dataset.columns.map((column) => record[column] ?? null)),
  ];

  return `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export function renderFakeDataset(dataset: FakeDataset, format: FakeDataFormat): string {
  const text = serializeFakeDataset(dataset, format);

  if (text.length > fakeDataLimits.outputCharacters) {
    throw fakeError(
      `Generated data is limited to ${fakeDataLimits.outputCharacters.toLocaleString('en-US')} characters; reduce the count or the number of long text fields.`,
    );
  }

  return text;
}
