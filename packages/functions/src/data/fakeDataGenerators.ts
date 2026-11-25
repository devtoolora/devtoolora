import { FunctionError } from '../errors';
import type { FakeField, FakeFieldType, FakeValue } from './fakeData';
import {
  COMPANY_FIRST,
  COMPANY_SECOND,
  COMPANY_SUFFIXES,
  IPV4_PREFIXES,
  JOB_LEVELS,
  JOB_ROLES,
  LOREM,
  PHONE_AREAS,
  STREETS,
  STREET_SUFFIXES,
} from './fakeDataWords';

type Random = () => number;
export type RecordContext = {
  first: string;
  index: number;
  last: string;
  location: [string, string, string];
};

export function createFieldGenerator(
  field: FakeField,
  seed: number,
): (context: RecordContext) => FakeValue {
  const random = stream(seed, `field:${field.name}`);
  const nulls = stream(seed, `null:${field.name}`);
  const value = valueGenerator(field, random);

  if (!field.nullable) return value;

  return (context) => {
    const generated = value(context);

    return nulls() < 0.2 ? null : generated;
  };
}

type ValueGenerator = (context: RecordContext) => FakeValue;

function assertArity(field: FakeField, max: number) {
  if (field.args.length > max)
    throw fakeError(
      `Field "${field.name}": ${field.type} ${max === 0 ? 'takes no arguments' : `accepts at most ${max} argument${max === 1 ? '' : 's'}`}.`,
    );
}

function valueGenerator(field: FakeField, random: Random): ValueGenerator {
  switch (field.type) {
    case 'sequence':
      return sequenceGenerator(field);
    case 'integer':
      return integerGenerator(field, random);
    case 'float':
      return floatGenerator(field, random);
    case 'boolean':
      return booleanGenerator(field, random);
    case 'date':
      return dateGenerator(field, random);
    case 'datetime':
      return datetimeGenerator(field, random);
    case 'enum':
      return () => pick(field.args, random);
    default:
      assertArity(field, 0);

      return textGenerator(field.type, random);
  }
}

function sequenceGenerator(field: FakeField): ValueGenerator {
  const { args, name } = field;

  assertArity(field, 2);
  const start = integerArg(args[0], 1, name, 'start');
  const step = integerArg(args[1], 1, name, 'step');

  return ({ index }) => start + index * step;
}

function integerGenerator(field: FakeField, random: Random): ValueGenerator {
  const { args, name } = field;

  assertArity(field, 2);
  const min = integerArg(args[0], 0, name, 'min');
  const max = integerArg(args[1], Math.max(min, 1000), name, 'max');

  if (min > max) throw fakeError(`Field "${name}": integer min must not exceed max.`);

  return () => min + Math.floor(random53(random) * (max - min + 1));
}

function floatGenerator(field: FakeField, random: Random): ValueGenerator {
  const { args, name } = field;

  assertArity(field, 3);
  const min = numberArg(args[0], 0, name, 'min');
  const max = numberArg(args[1], Math.max(min, 1000), name, 'max');
  const decimals = integerArg(args[2], 2, name, 'decimals');

  if (min > max) throw fakeError(`Field "${name}": float min must not exceed max.`);
  if (decimals < 0 || decimals > 6)
    throw fakeError(`Field "${name}": decimals must be from 0 through 6.`);

  return () =>
    Math.min(max, Math.max(min, Number((min + random53(random) * (max - min)).toFixed(decimals))));
}

function booleanGenerator(field: FakeField, random: Random): ValueGenerator {
  const { args, name } = field;

  assertArity(field, 1);
  const probability = numberArg(args[0], 0.5, name, 'probability');

  if (probability < 0 || probability > 1)
    throw fakeError(`Field "${name}": boolean probability must be from 0 through 1.`);

  return () => random() < probability;
}

function dateGenerator(field: FakeField, random: Random): ValueGenerator {
  const { args, name } = field;

  assertArity(field, 2);
  const from = dayArg(args[0], '2020-01-01', name, 'from');
  const to = dayArg(args[1], '2026-12-31', name, 'to');

  if (from > to) throw fakeError(`Field "${name}": date from must not be after to.`);

  return () =>
    new Date((from + Math.floor(random53(random) * (to - from + 1))) * 86_400_000)
      .toISOString()
      .slice(0, 10);
}

function datetimeGenerator(field: FakeField, random: Random): ValueGenerator {
  const { args, name } = field;

  assertArity(field, 2);
  const from = instantArg(args[0], '2020-01-01T00:00:00Z', name, 'from');
  const to = instantArg(args[1], '2026-12-31T23:59:59Z', name, 'to');

  if (from > to) throw fakeError(`Field "${name}": datetime from must not be after to.`);

  return () =>
    new Date((from + Math.floor(random53(random) * (to - from + 1))) * 1000)
      .toISOString()
      .replace('.000Z', 'Z');
}

function textGenerator(type: FakeFieldType, random: Random): (context: RecordContext) => FakeValue {
  switch (type) {
    case 'uuid':
      return () => uuid(random);
    case 'name':
      return ({ first, last }) => `${first} ${last}`;
    case 'firstName':
      return ({ first }) => first;
    case 'lastName':
      return ({ last }) => last;
    case 'email':
      return ({ first, index, last }) =>
        `${asciiSlug(first)}.${asciiSlug(last)}.${index + 1}@example.test`;
    case 'username':
      return ({ first, index, last }) => `${asciiSlug(first)}_${asciiSlug(last)}${index + 1}`;
    case 'phone':
      return () =>
        `+1 ${pick(PHONE_AREAS, random)}-555-01${String(Math.floor(random() * 100)).padStart(2, '0')}`;
    case 'company':
      return () =>
        `${pick(COMPANY_FIRST, random)} ${pick(COMPANY_SECOND, random)} ${pick(COMPANY_SUFFIXES, random)}`;
    case 'jobTitle':
      return () => `${pick(JOB_LEVELS, random)} ${pick(JOB_ROLES, random)}`;
    case 'address':
      return () =>
        `${1 + Math.floor(random() * 9999)} ${pick(STREETS, random)} ${pick(STREET_SUFFIXES, random)}`;
    case 'city':
      return ({ location }) => location[0];
    case 'country':
      return ({ location }) => location[1];
    case 'countryCode':
      return ({ location }) => location[2];
    case 'postcode':
      return () => String(Math.floor(random() * 100_000)).padStart(5, '0');
    case 'url':
      return () => `https://example.com/${pick(LOREM, random)}/${1 + Math.floor(random() * 999)}`;
    case 'ipv4':
      return () => `${pick(IPV4_PREFIXES, random)}.${1 + Math.floor(random() * 254)}`;
    case 'color':
      return () =>
        `#${Math.floor(random() * 0x1000000)
          .toString(16)
          .padStart(6, '0')}`;
    case 'word':
      return () => pick(LOREM, random);
    case 'sentence':
      return () => sentence(random);
    case 'paragraph':
      return () =>
        Array.from({ length: 3 + Math.floor(random() * 3) }, () => sentence(random)).join(' ');
    default:
      throw fakeError(`Unsupported fake data type: ${type}`);
  }
}

function sentence(random: Random): string {
  const words = Array.from({ length: 6 + Math.floor(random() * 7) }, () => pick(LOREM, random));

  const text = words.join(' ');

  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

function uuid(random: Random): string {
  const bytes = Array.from({ length: 16 }, () => Math.floor(random() * 256));

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function pick<T>(values: readonly T[], random: Random): T {
  const value = values[Math.floor(random() * values.length)];

  if (value === undefined) throw fakeError('Cannot pick a value from an empty list.');

  return value;
}

/**
 * mulberry32 seeded per stream label, so adding or reordering fields leaves other fields unchanged.
 */
export function stream(seed: number, label: string): Random {
  let hash = (0x811c9dc5 ^ seed) >>> 0;

  for (let index = 0; index < label.length; index += 1)
    hash = Math.imul(hash ^ label.charCodeAt(index), 0x01000193) >>> 0;
  let state = hash;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;

    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

function random53(random: Random): number {
  return (
    (Math.floor(random() * 0x200000) * 0x100000000 + Math.floor(random() * 0x100000000)) / 2 ** 53
  );
}

function integerArg(
  value: string | undefined,
  fallback: number,
  field: string,
  label: string,
): number {
  if (value === undefined || value === '') return fallback;
  if (!/^-?\d{1,16}$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw fakeError(`Field "${field}": ${label} must be a safe integer.`);

  return Number(value);
}

function numberArg(
  value: string | undefined,
  fallback: number,
  field: string,
  label: string,
): number {
  if (value === undefined || value === '') return fallback;
  if (!/^-?(\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value)))
    throw fakeError(`Field "${field}": ${label} must be a finite number.`);

  return Number(value);
}

function dayArg(value: string | undefined, fallback: string, field: string, label: string): number {
  const input = value || fallback;
  const time = /^\d{4}-\d{2}-\d{2}$/.test(input) ? Date.parse(`${input}T00:00:00Z`) : Number.NaN;

  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== input)
    throw fakeError(`Field "${field}": ${label} must be a YYYY-MM-DD date.`);

  return time / 86_400_000;
}

function instantArg(
  value: string | undefined,
  fallback: string,
  field: string,
  label: string,
): number {
  const input = value || fallback;
  const valid = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/.test(
    input,
  );
  const time = valid ? Date.parse(input.length === 10 ? `${input}T00:00:00Z` : input) : Number.NaN;

  if (Number.isNaN(time))
    throw fakeError(
      `Field "${field}": ${label} must be a date or an ISO date-time with Z or an offset.`,
    );

  return Math.floor(time / 1000);
}

function asciiSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase();
}

export function csvCell(value: FakeValue): string {
  if (value === null) return '';

  const text = String(value);

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function fakeError(message: string): FunctionError {
  return new FunctionError('FAKE_DATA_ERROR', message);
}
