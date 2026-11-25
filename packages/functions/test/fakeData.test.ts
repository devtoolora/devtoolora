import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  generateFakeDataset,
  generateSeededUsers,
  parseFakeDataSpec,
  renderFakeDataset,
} from '@devtoolora/functions/data';
import { FunctionError } from '@devtoolora/functions/errors';

const spec = [
  'id: sequence',
  'key: uuid',
  'name: name',
  'email: email',
  'age: integer(18,90)',
  'price: float(1,500,2)',
  'active: boolean(0.8)',
  'status: enum(active,pending|banned)',
  'joined: date(2024-01-01,2024-12-31)',
  'seen: datetime(2026-01-01T00:00:00Z,2026-01-31T23:59:59Z)',
  'city: city',
  'country: country',
  'nickname: firstName?',
].join('\n');

describe('fake data generator', () => {
  it('keeps the built-in seeded user fixture byte-identical for an empty field list', () => {
    const dataset = generateFakeDataset('  \n# comment only\n', 42, 5);

    assert.equal(dataset.defaultUsers, true);
    assert.deepEqual(dataset.records, generateSeededUsers(42, 5));

    assert.equal(
      renderFakeDataset(dataset, 'json'),
      JSON.stringify(generateSeededUsers(42, 5), null, 2),
    );

    assert.ok(renderFakeDataset(dataset, 'csv').startsWith('id,name,email,active\r\n1,'));
  });

  it('generates realistic values within the requested ranges', () => {
    const { records } = generateFakeDataset(spec, 7, 200);

    records.forEach((record, index) => {
      assert.equal(record.id, index + 1);

      assert.match(
        String(record.key),
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );

      assert.match(
        String(record.email),
        new RegExp(`^[a-z]+\\.[a-z]+\\.${index + 1}@example\\.test$`),
      );

      assert.ok(
        Number.isInteger(record.age) && Number(record.age) >= 18 && Number(record.age) <= 90,
      );

      assert.ok(
        Number(record.price) >= 1 &&
          Number(record.price) <= 500 &&
          /^\d+(\.\d{1,2})?$/.test(String(record.price)),
      );

      assert.equal(typeof record.active, 'boolean');
      assert.ok(['active', 'pending', 'banned'].includes(String(record.status)));
      assert.ok(String(record.joined) >= '2024-01-01' && String(record.joined) <= '2024-12-31');
      assert.match(String(record.seen), /^2026-01-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      assert.ok(record.nickname === null || typeof record.nickname === 'string');
    });

    assert.equal(new Set(records.map((record) => record.key)).size, 200);
    assert.equal(new Set(records.map((record) => record.email)).size, 200);
    const nulls = records.filter((record) => record.nickname === null).length;

    assert.ok(nulls > 10 && nulls < 80, `expected about 20% nulls, got ${nulls}`);
    const activeShare = records.filter((record) => record.active).length / records.length;

    assert.ok(
      activeShare > 0.65 && activeShare < 0.95,
      `expected about 80% active, got ${activeShare}`,
    );
  });

  it('keeps person and place fields of one record consistent', () => {
    const { records } = generateFakeDataset(
      'name: name\nfirst: firstName\nlast: lastName\nemail: email\nuser: username\ncity: city\ncode: countryCode',
      3,
      50,
    );

    for (const record of records) {
      assert.equal(record.name, `${record.first} ${record.last}`);
      const slug = (value: unknown) =>
        String(value)
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^A-Za-z0-9]/g, '')
          .toLowerCase();

      assert.ok(String(record.email).startsWith(`${slug(record.first)}.${slug(record.last)}.`));
      assert.ok(String(record.user).startsWith(`${slug(record.first)}_${slug(record.last)}`));
    }

    const pairs = new Map([
      ['Prague', 'CZ'],
      ['Berlin', 'DE'],
      ['Osaka', 'JP'],
      ['São Paulo', 'BR'],
    ]);

    for (const record of records) {
      const expected = pairs.get(String(record.city));

      if (expected) assert.equal(record.code, expected);
    }
  });

  it('is repeatable, keeps prefixes and isolates fields from each other', () => {
    const first = generateFakeDataset(spec, 42, 20).records;

    assert.deepEqual(generateFakeDataset(spec, 42, 20).records, first);
    assert.deepEqual(generateFakeDataset(spec, 42, 5).records, first.slice(0, 5));
    assert.notDeepEqual(generateFakeDataset(spec, 43, 20).records, first);
    const reordered = generateFakeDataset(
      `extra: word\n${spec.split('\n').reverse().join('\n')}`,
      42,
      20,
    ).records;

    for (const [index, record] of reordered.entries()) {
      for (const key of Object.keys(first[index]!))
        assert.deepEqual(record[key], first[index]![key], `${key} changed when other fields moved`);
    }

    const nullable = generateFakeDataset('nick: firstName?', 42, 50).records;
    const plain = generateFakeDataset('nick: firstName', 42, 50).records;

    nullable.forEach((record, index) =>
      assert.ok(record.nick === null || record.nick === plain[index]!.nick),
    );
  });

  it('renders JSON, JSON Lines and CSV with exact escaping', () => {
    const dataset = generateFakeDataset(
      'label: enum(plain,"quoted",has space)\nnote: sentence?\nn: integer(1,1)',
      1,
      30,
    );
    const json = JSON.parse(renderFakeDataset(dataset, 'json'));
    const lines = renderFakeDataset(dataset, 'ndjson');

    assert.ok(lines.endsWith('\n'));

    assert.deepEqual(
      lines
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line)),
      json,
    );

    const csv = renderFakeDataset(dataset, 'csv');

    assert.ok(csv.startsWith('label,note,n\r\n'));
    assert.ok(csv.endsWith('\r\n'));
    assert.equal(csv.split('\r\n').filter(Boolean).length, 31);
    if (json.some((record: { label: string }) => record.label === '"quoted"'))
      assert.match(csv, /"""quoted"""/);
    if (json.some((record: { note: string | null }) => record.note === null))
      assert.match(csv, /,,1\r\n/);
  });

  it('rejects invalid specs, arguments, seeds and counts with line-specific messages', () => {
    const rejects = (input: string, pattern: RegExp) =>
      assert.throws(
        () => parseFakeDataSpec(input),
        (error: unknown) => error instanceof FunctionError && pattern.test(error.message),
      );

    rejects('just text', /Line 1: use "field: type"/);
    rejects('a: name\na: email', /Line 2: field "a" is declared twice/);
    rejects('price: money', /unknown type "money"/);
    rejects('state: enum()', /enum needs non-empty values/);
    rejects('state: enum(a,,b)', /enum needs non-empty values/);
    const invalid = (input: string, pattern: RegExp) =>
      assert.throws(() => generateFakeDataset(input, 1, 1), pattern);

    invalid('n: integer(10,1)', /min must not exceed max/);
    invalid('n: integer(1.5)', /min must be a safe integer/);
    invalid('n: float(0,1,7)', /decimals must be from 0 through 6/);
    invalid('b: boolean(2)', /probability must be from 0 through 1/);
    invalid('d: date(2024-02-30)', /from must be a YYYY-MM-DD date/);
    invalid('d: date(2025-01-01,2024-01-01)', /from must not be after to/);
    invalid('t: datetime(yesterday)', /from must be a date or an ISO date-time/);
    invalid('n: name(1)', /name takes no arguments/);

    invalid(
      Array.from({ length: 101 }, (_value, index) => `f${index}: word`).join('\n'),
      /limited to 100 fields/,
    );

    assert.throws(
      () => generateFakeDataset('a: word', -1, 1),
      (error: unknown) => error instanceof FunctionError && error.code === 'INVALID_SEED',
    );

    assert.throws(
      () => generateFakeDataset('a: word', 1, 1001),
      (error: unknown) => error instanceof FunctionError && error.code === 'INVALID_COUNT',
    );

    assert.throws(
      () =>
        renderFakeDataset(
          generateFakeDataset(
            Array.from({ length: 100 }, (_value, index) => `p${index}: paragraph`).join('\n'),
            1,
            1000,
          ),
          'json',
        ),
      /Generated data is limited to 5,000,000 characters/,
    );
  });

  it('accepts aliases, comments, CRLF line endings and case-insensitive type names', () => {
    const fields = parseFakeDataSpec(
      '# fixture\r\nid: Serial\r\nmail: EMAIL\r\nzip: zip\r\nwhen: date_time?\r\n',
    );

    assert.deepEqual(
      fields.map((field) => [field.name, field.type, field.nullable]),
      [
        ['id', 'sequence', false],
        ['mail', 'email', false],
        ['zip', 'postcode', false],
        ['when', 'datetime', true],
      ],
    );
  });
});
