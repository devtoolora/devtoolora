import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { parseJson } from '@devtoolora/functions/format';
import {
  generateJsonSchema,
  generateTypeScriptTypes,
  generateZodSchema,
  parseTypeSample,
  profileCsv,
  typeInferenceLimits,
  validateJsonSchema,
} from '@devtoolora/functions/schema';
import { FunctionError } from '@devtoolora/functions/errors';

describe('schema functions', () => {
  it('infers JSON Schema, TypeScript, and Zod from shared JSON values', () => {
    const value = parseJson('[{"id":1,"name":"Ada"},{"id":2,"email":"grace@example.com"}]');
    const schema = generateJsonSchema(value);

    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');

    assert.equal(
      generateTypeScriptTypes(value, 'Users'),
      [
        'export type Users = User[];',
        '',
        'export interface User {',
        '  id: number;',
        '  name?: string;',
        '  email?: string;',
        '}',
      ].join('\n'),
    );

    assert.match(generateZodSchema(value, 'Users'), /UsersSchema = z\.array/);
  });

  it('keeps object, array and null members when sample values differ', () => {
    const value = parseJson('[{"meta":null,"items":[1,"a",null]},{"meta":{"a":1},"items":[]}]');

    assert.equal(
      generateTypeScriptTypes(value, 'Row'),
      [
        'export type Row = RowItem[];',
        '',
        'export interface RowItem {',
        '  meta: RowItemMeta | null;',
        '  items: (string | number | null)[];',
        '}',
        '',
        'export interface RowItemMeta {',
        '  a: number;',
        '}',
      ].join('\n'),
    );

    assert.equal(
      generateZodSchema(value, 'Row'),
      [
        "import { z } from 'zod';",
        '',
        'export const RowSchema = z.array(z.object({',
        '  meta: z.object({',
        '    a: z.int(),',
        '  }).nullable(),',
        '  items: z.array(z.union([z.string(), z.int()]).nullable()),',
        '}));',
        '',
        'export type Row = z.infer<typeof RowSchema>;',
      ].join('\n'),
    );
  });

  it('types empty arrays, empty objects and mixed scalar or object array items without dropping members', () => {
    assert.equal(
      generateTypeScriptTypes(parseJson('{"tags":[],"mixed":[{"id":1},"x"],"extra":{}}'), 'Doc'),
      [
        'export interface Doc {',
        '  tags: unknown[];',
        '  mixed: (DocMixedItem | string)[];',
        '  extra: Record<string, unknown>;',
        '}',
        '',
        'export interface DocMixedItem {',
        '  id: number;',
        '}',
      ].join('\n'),
    );

    assert.equal(generateTypeScriptTypes(parseJson('[]'), 'Root'), 'export type Root = unknown[];');

    assert.equal(
      generateTypeScriptTypes(parseJson('"text"'), 'Root'),
      'export type Root = string;',
    );

    assert.equal(
      generateZodSchema(parseJson('{}'), 'Root', { exportType: false }),
      "import { z } from 'zod';\n\nexport const RootSchema = z.record(z.string(), z.unknown());",
    );
  });

  it('applies TypeScript declaration, export, optional and readonly options', () => {
    const value = parseJson('{"id":1,"tags":["a"],"profile":{"name":"Ada"},"grid":[[1]]}');

    assert.equal(
      generateTypeScriptTypes(value, 'Config', {
        declaration: 'type',
        exported: false,
        optionalProperties: 'all',
        readonly: true,
      }),
      [
        'type Config = {',
        '  readonly id?: number;',
        '  readonly tags?: readonly string[];',
        '  readonly profile?: ConfigProfile;',
        '  readonly grid?: readonly (readonly number[])[];',
        '};',
        '',
        'type ConfigProfile = {',
        '  readonly name?: string;',
        '};',
      ].join('\n'),
    );
  });

  it('names nested types from singular property names and quotes unsafe keys', () => {
    const output = generateTypeScriptTypes(
      parseJson(
        '{"categories":[{"id":1}],"addresses":[{"zip":"1"}],"statuses":[{"s":1}],"a/b":1,"číslo":{"x":1}}',
      ),
      'Doc',
    );

    assert.match(output, /categories: DocCategory\[\];/);
    assert.match(output, /addresses: DocAddress\[\];/);
    assert.match(output, /statuses: DocStatus\[\];/);
    assert.match(output, /"a\/b": number;/);
    assert.match(output, /"číslo": DocCislo;/);
    assert.match(output, /export interface DocCislo \{/);
  });

  it('infers Zod formats, integers, nullish fields and strict objects for both major versions', () => {
    const value = parseJson(
      '[{"id":1,"email":"ada@example.com","site":"https://example.com/a","uuid":"550e8400-e29b-41d4-a716-446655440000","day":"2024-02-29","at":"2026-01-02T10:00:00Z","note":null},{"id":2,"email":"grace@example.com","site":"https://example.org","uuid":"6ba7b810-9dad-41d1-80b4-00c04fd430c8","day":"2024-03-01","at":"2026-01-02T10:00:00.5+02:00","score":1.5}]',
    );
    const v4 = generateZodSchema(value, 'Row', { strictObjects: true });

    assert.match(v4, /z\.array\(z\.strictObject\(\{/);

    for (const expected of [
      'id: z.int(),',
      'email: z.email(),',
      'site: z.url(),',
      'uuid: z.uuid(),',
      'day: z.iso.date(),',
      'at: z.iso.datetime({ offset: true }),',
      'note: z.null().optional(),',
      'score: z.number().optional(),',
    ]) {
      assert.ok(v4.includes(expected), `${expected} missing from\n${v4}`);
    }

    const v3 = generateZodSchema(value, 'Row', { strictObjects: true, version: 3 });

    for (const expected of [
      'id: z.number().int(),',
      'email: z.string().email(),',
      'site: z.string().url(),',
      'uuid: z.string().uuid(),',
      'day: z.string().date(),',
      'at: z.string().datetime({ offset: true }),',
      '}).strict())',
    ]) {
      assert.ok(v3.includes(expected), `${expected} missing from\n${v3}`);
    }

    const plain = generateZodSchema(value, 'Row', { inferFormats: false });

    assert.doesNotMatch(plain, /z\.int\(\)|z\.email\(\)|z\.iso\./);

    assert.match(
      generateZodSchema(parseJson('[{"v":null},{"v":"a"},{}]'), 'Row'),
      /v: z\.string\(\)\.nullish\(\),/,
    );

    assert.match(
      generateZodSchema(
        parseJson(
          '{"d":"2026-02-30","t":"2026-01-02T10:00:00","e":"not an email","u":"ftp://example.com"}',
        ),
        'Row',
      ),
      /d: z\.string\(\),\n {2}t: z\.string\(\),\n {2}e: z\.string\(\),\n {2}u: z\.string\(\),/,
    );

    assert.match(
      generateZodSchema(parseJson('{"big":9007199254740993}'), 'Row'),
      /big: z\.number\(\),/,
    );
  });

  it('omits __proto__ from Zod objects and keeps them non-strict so the sample still validates', () => {
    const output = generateZodSchema(parseJson('{"__proto__":1,"a":1}'), 'Row', {
      strictObjects: true,
    });

    assert.match(output, /^export const RowSchema = z\.object\(\{\n {2}\/\/ "__proto__" omitted/m);
    assert.doesNotMatch(output, /strictObject|__proto__: /);

    assert.match(
      generateTypeScriptTypes(parseJson('{"__proto__":1}'), 'Row'),
      /__proto__: number;/,
    );
  });

  it('rejects oversized and too deeply nested samples instead of truncating', () => {
    assert.throws(
      () => parseTypeSample(' '.repeat(typeInferenceLimits.inputCharacters + 1)),
      (error: unknown) => error instanceof FunctionError && error.code === 'SCHEMA_ERROR',
    );

    assert.throws(
      () => parseTypeSample(''),
      (error: unknown) => error instanceof FunctionError && error.code === 'REQUIRED_JSON',
    );

    assert.throws(
      () => parseTypeSample('{"a":'),
      (error: unknown) =>
        error instanceof FunctionError &&
        error.code === 'INVALID_JSON' &&
        error.message ===
          'Invalid JSON at line 1, column 6 (offset 5): Expected an object, array, string, number, true, false or null.',
    );

    assert.deepEqual(parseTypeSample('{"a":1,"a":"x"}'), { a: 'x' });

    for (const text of ['{"a":1e400}', '{"a":1e-400}'])
      assert.throws(() => parseTypeSample(text), /range of a double/, text);

    assert.deepEqual(parseTypeSample('{"a":12345678901234567890}'), { a: 12345678901234567000 });

    assert.throws(
      () => parseTypeSample('['.repeat(200)),
      (error: unknown) =>
        error instanceof FunctionError && error.message === 'Input is not valid JSON.',
    );

    const deep = parseJson(`${'['.repeat(70)}1${']'.repeat(70)}`);

    assert.throws(() => generateTypeScriptTypes(deep, 'Root'), /nesting is limited to 64 levels/);
  });

  it('returns validation data without tool result contracts', () => {
    const schema = '{"type":"object","required":["name"],"properties":{"name":{"type":"string"}}}';

    assert.deepEqual(validateJsonSchema('{"name":"Ada"}', schema), { valid: true, errors: [] });
    const invalid = validateJsonSchema('{"name":1}', schema);

    assert.equal(invalid.valid, false);
    assert.match(invalid.errors[0]!, /must be string/);
  });

  it('profiles CSV columns', () => {
    assert.match(profileCsv('name,age\nAda,37\nGrace,40'), /Type: integer/);
  });

  it('uses typed errors for invalid schema-domain input', () => {
    assert.throws(
      () => validateJsonSchema('{}', ''),
      (error: unknown) => error instanceof FunctionError && error.code === 'SCHEMA_ERROR',
    );
  });
});
