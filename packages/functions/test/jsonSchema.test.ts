import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { FunctionError } from '@devtoolora/functions/errors';
import type { JsonValue } from '@devtoolora/functions/format';
import {
  generateJsonSchema,
  inspectJsonSchema,
  jsonSchemaDraftUris,
  jsonSchemaLimits,
  parseJsonSchemaData,
  validateJsonSchema,
  type JsonSchemaDraft,
} from '@devtoolora/functions/schema';

function accepts(value: JsonValue, schema: Record<string, JsonValue>): boolean {
  return validateJsonSchema(JSON.stringify(value), JSON.stringify(schema)).valid;
}

describe('JSON Schema generation and validation', () => {
  it('validates every generated source value across all three declared drafts', () => {
    const values: JsonValue[] = [
      null,
      true,
      1,
      1.5,
      '001',
      [],
      {},
      [null, { x: 1 }],
      [1, 'x', [true], { x: 1 }],
      [{ value: null }, { value: { enabled: true } }, { value: [1, '001'] }],
    ];

    for (const draft of ['2020-12', '2019-09', 'draft-07'] satisfies JsonSchemaDraft[]) {
      for (const value of values) {
        const schema = generateJsonSchema(value, { draft });

        assert.equal(schema.$schema, jsonSchemaDraftUris[draft]);
        assert.equal(accepts(value, schema), true, JSON.stringify({ draft, schema, value }));
        assert.equal(inspectJsonSchema(JSON.stringify(value), JSON.stringify(schema)).draft, draft);
      }
    }
  });

  it('merges observed object variants without treating null as missing or inventing domain constraints', () => {
    const schema = generateJsonSchema([
      { id: 1, name: 'Ada', value: null },
      { id: 2, value: { active: true } },
    ]);

    assert.equal(accepts([{ id: 3, value: null }], schema), true);
    assert.equal(accepts([{ id: 3, value: { active: false } }], schema), true);
    assert.equal(accepts([{ id: 3 }], schema), false);
    assert.equal(accepts([{ id: 3, name: null, value: null }], schema), false);
    assert.equal(accepts([{ id: 3, value: 'not-an-observed-type' }], schema), false);
    assert.equal(accepts([{ id: 3, value: null, extra: true }], schema), false);
    assert.equal(JSON.stringify(schema).includes('enum'), false);
    assert.equal(JSON.stringify(schema).includes('format'), false);
    assert.equal(JSON.stringify(schema).includes('minimum'), false);
    assert.equal(accepts([], schema), true);

    assert.equal(
      accepts(
        [{}],
        generateJsonSchema([{ id: 1 }], { additionalProperties: true, requiredProperties: 'none' }),
      ),
      true,
    );

    const permissive = generateJsonSchema(
      { id: 1, nested: { name: 'Ada' } },
      { additionalProperties: true, requiredProperties: 'none' },
    );

    assert.equal(accepts({ nested: { extra: true }, another: 'ok' }, permissive), true);
  });

  it('distinguishes integers, general numbers and unknown empty-array items', () => {
    assert.deepEqual(generateJsonSchema([1, 2]).items, { type: 'integer' });
    assert.deepEqual(generateJsonSchema([1, 2.5]).items, { type: 'number' });

    assert.deepEqual(generateJsonSchema([1, '001', false, null]).items, {
      type: ['string', 'integer', 'boolean', 'null'],
    });

    assert.equal(accepts([true, 'anything', {}], generateJsonSchema([])), true);
    assert.equal(accepts([1.5], generateJsonSchema([1, 2])), false);
    assert.equal(accepts([{ other: 1 }], generateJsonSchema([{}])), false);
  });

  it('checks prototype names and escaped/Unicode pointers without changing opaque schema data', () => {
    const value = parseJsonSchemaData(
      '{"__proto__":1,"constructor":"plain JSON","a/b~c":"číslo 🐎"}',
    );
    const generated = generateJsonSchema(value);

    assert.equal(accepts(value, generated), true);
    assert.deepEqual(generated.patternProperties, { '^__proto__$': { type: 'integer' } });
    const declared =
      '{"type":"object","properties":{"__proto__":{"type":"integer"},"a/b~c":{"type":"string"}},"required":["__proto__"],"additionalProperties":false}';
    const invalid = inspectJsonSchema('{"__proto__":"bad","a/b~c":1}', declared);

    assert.equal(invalid.valid, false);

    assert.deepEqual(invalid.errors.map((error) => error.instancePath).sort(), [
      '/__proto__',
      '/a~1b~0c',
    ]);

    const overlap =
      '{"properties":{"__proto__":{"type":"integer"}},"patternProperties":{"^__proto__$":{"minimum":2}},"additionalProperties":false}';

    assert.equal(validateJsonSchema('{"__proto__":1}', overlap).valid, false);
    assert.equal(validateJsonSchema('{"__proto__":2}', overlap).valid, true);
    const opaque =
      '{"enum":[{"properties":{"__proto__":{"type":"integer"}}}],"default":{"properties":{"__proto__":1}}}';

    assert.equal(
      validateJsonSchema('{"properties":{"__proto__":{"type":"integer"}}}', opaque).valid,
      true,
    );

    assert.equal(Object.hasOwn({}, 'polluted'), false);
  });

  it('uses declared draft aliases and rejects mismatches or unsupported dialects explicitly', () => {
    for (const draft of ['2020-12', '2019-09', 'draft-07'] satisfies JsonSchemaDraft[]) {
      const uri = jsonSchemaDraftUris[draft].replace(/#$/, '');

      for (const protocol of ['http:', 'https:']) {
        for (const fragment of ['', '#']) {
          const schema = JSON.stringify({
            $schema: uri.replace(/^https?:/, protocol) + fragment,
            type: 'integer',
          });

          assert.equal(inspectJsonSchema('1', schema).draft, draft);
        }
      }
    }

    assert.equal(inspectJsonSchema('1', '{"type":"integer"}').draft, 'draft-07');

    assert.equal(
      inspectJsonSchema('1', '{"type":"integer"}', { draft: '2020-12' }).draft,
      '2020-12',
    );

    assert.throws(
      () =>
        inspectJsonSchema('1', JSON.stringify({ $schema: jsonSchemaDraftUris['2020-12'] }), {
          draft: 'draft-07',
        }),
      /conflicts/,
    );

    for (const declaration of [
      'http://json-schema.org/draft-04/schema#',
      'http://json-schema.org/draft-06/schema#',
      'https://example.com/schema',
    ]) {
      assert.throws(
        () => inspectJsonSchema('1', JSON.stringify({ $schema: declaration })),
        /Unsupported JSON Schema draft/,
      );
    }

    assert.throws(() => inspectJsonSchema('1', '{"$schema":4}'), /supported draft URI/);
  });

  it('enforces newer tuple/dependency keywords and resolves local references', () => {
    const tuple = JSON.stringify({
      $schema: jsonSchemaDraftUris['2020-12'],
      items: false,
      minItems: 2,
      prefixItems: [{ type: 'string' }, { type: 'integer' }],
      type: 'array',
    });

    assert.equal(validateJsonSchema('["Ada",37]', tuple).valid, true);
    assert.equal(validateJsonSchema('["Ada","37"]', tuple).valid, false);
    assert.equal(validateJsonSchema('["Ada",37,true]', tuple).valid, false);
    assert.equal(validateJsonSchema('["Ada"]', tuple).valid, false);

    assert.throws(
      () => validateJsonSchema('["Ada",37]', '{"prefixItems":[{"type":"string"}]}'),
      /unknown keyword/,
    );

    const dependency = JSON.stringify({
      $schema: jsonSchemaDraftUris['2019-09'],
      dependentRequired: { card: ['address'] },
      properties: { address: { type: 'string' }, card: { type: 'string' } },
      type: 'object',
      unevaluatedProperties: false,
    });

    assert.equal(validateJsonSchema('{"card":"test"}', dependency).valid, false);
    assert.equal(validateJsonSchema('{"card":"test","address":"local"}', dependency).valid, true);
    const reference = JSON.stringify({
      $defs: { count: { minimum: 0, type: 'integer' } },
      $ref: '#/$defs/count',
      $schema: jsonSchemaDraftUris['2020-12'],
    });

    assert.equal(validateJsonSchema('3', reference).valid, true);
    assert.equal(validateJsonSchema('-1', reference).valid, false);

    assert.throws(
      () => validateJsonSchema('{}', '{"$ref":"https://example.com/remote.json"}'),
      /resolve reference/,
    );
  });

  it('really validates supported formats and makes opting out explicit', () => {
    for (const [format, valid, invalid] of [
      ['date', '2024-02-29', '2026-02-30'],
      ['date-time', '2026-01-01T12:30:00Z', '2026-01-01T12:30:00'],
      ['email', 'ada@example.com', 'not-an-email'],
      ['uri', 'https://example.com/a', 'not a URI'],
      ['ipv4', '192.168.1.1', '999.1.1.1'],
      ['uuid', '550e8400-e29b-41d4-a716-446655440000', 'no-uuid'],
    ]) {
      const schema = JSON.stringify({ format, type: 'string' });

      assert.equal(validateJsonSchema(JSON.stringify(valid), schema).valid, true, format);
      assert.equal(validateJsonSchema(JSON.stringify(invalid), schema).valid, false, format);
      const ignored = inspectJsonSchema(JSON.stringify(invalid), schema, {
        validateFormats: false,
      });

      assert.equal(ignored.valid, true);
      assert.equal(ignored.validateFormats, false);
    }

    assert.throws(
      () => inspectJsonSchema('"value"', '{"type":"string","format":"my-custom-format"}'),
      /unknown format/,
    );

    assert.equal(
      inspectJsonSchema('"value"', '{"type":"string","format":"my-custom-format"}', {
        validateFormats: false,
      }).valid,
      true,
    );
  });

  it('preserves input types and reports multiple precise failures including missing/additional property names', () => {
    const schema =
      '{"type":"object","required":["name"],"properties":{"age":{"type":"integer","default":37}},"additionalProperties":false}';
    const report = inspectJsonSchema('{"age":"37","extra":true}', schema);

    assert.equal(report.valid, false);
    assert.equal(report.totalErrors, 3);

    assert.match(
      report.errors.find((error) => error.keyword === 'required')?.message ?? '',
      /property "name"/,
    );

    assert.match(
      report.errors.find((error) => error.keyword === 'additionalProperties')?.message ?? '',
      /property "extra"/,
    );

    assert.deepEqual(
      report.errors.find((error) => error.keyword === 'type'),
      {
        instancePath: '/age',
        keyword: 'type',
        message: 'must be integer',
        schemaPath: '#/properties/age/type',
      },
    );

    assert.equal(
      inspectJsonSchema('{"age":"37","extra":true}', schema, { allErrors: false }).totalErrors,
      1,
    );

    const defaultOnly =
      '{"type":"object","required":["age"],"properties":{"age":{"type":"integer","default":37}}}';

    assert.equal(validateJsonSchema('{}', defaultOnly).valid, false);
    const many = inspectJsonSchema(
      JSON.stringify(Array(250).fill('bad')),
      '{"type":"array","items":{"type":"integer"}}',
    );

    assert.equal(many.totalErrors, 250);
    assert.equal(many.errors.length, jsonSchemaLimits.reportedErrors);
    assert.equal(many.errorsTruncated, true);

    assert.match(
      validateJsonSchema(
        JSON.stringify(Array(250).fill('bad')),
        '{"type":"array","items":{"type":"integer"}}',
      ).errors.at(-1) ?? '',
      /Showing 200 of 250/,
    );
  });

  it('rejects malformed input, unknown keywords and async schemas rather than passing weakened validation', () => {
    for (const schema of [
      '',
      '{',
      '[]',
      '3',
      'null',
      '"schema"',
      '{"type":"banana"}',
      '{"type":"object","requird":["id"]}',
      '{"$async":true,"type":"string"}',
    ]) {
      assert.throws(
        () => inspectJsonSchema('{}', schema),
        (error: unknown) => error instanceof FunctionError && error.code === 'SCHEMA_ERROR',
      );
    }

    assert.equal(validateJsonSchema('{}', 'true').valid, true);

    assert.throws(
      () =>
        inspectJsonSchema(
          '{}',
          JSON.stringify({
            $schema: jsonSchemaDraftUris['2020-12'],
            $vocabulary: { 'https://example.com/custom': true },
          }),
        ),
      /Unsupported mandatory/,
    );

    assert.equal(
      inspectJsonSchema(
        '{}',
        JSON.stringify({
          $schema: jsonSchemaDraftUris['2020-12'],
          $vocabulary: { 'https://example.com/custom': false },
        }),
      ).valid,
      true,
    );

    assert.throws(
      () =>
        inspectJsonSchema(
          '{}',
          JSON.stringify({
            $recursiveRef: '#/definitions/item',
            $schema: jsonSchemaDraftUris['2019-09'],
          }),
        ),
      /Only the recursive reference/,
    );

    assert.equal(validateJsonSchema('{}', 'false').valid, false);

    assert.throws(
      () => inspectJsonSchema('{a', '{}'),
      /^FunctionError: Invalid JSON data at line 1, column 2 \(offset 1\): Object keys/,
    );

    assert.throws(() => inspectJsonSchema('{}', '{a'), /Invalid JSON Schema at line 1, column 2/);

    const checked = inspectJsonSchema(
      '{"a":1,\n"a":"x"}',
      '{"properties":{"a":{"type":"string"}}}',
    );

    assert.equal(checked.valid, true);

    assert.deepEqual(checked.warnings, [
      'Duplicate key "a" at line 2; only its last value was checked.',
    ]);

    assert.deepEqual(inspectJsonSchema('{"a":1}', '{}').warnings, []);

    assert.throws(() => inspectJsonSchema('[1e-400]', '{}'), /JSON data: .*range of a double/);

    assert.throws(
      () => inspectJsonSchema('{}', '{"maximum":1e-400}'),
      /JSON Schema: .*range of a double/,
    );

    assert.throws(
      () => inspectJsonSchema('{}', '{"type":"string","type":"object"}'),
      /JSON Schema: Duplicate key "type" at line 1/,
    );

    assert.equal(inspectJsonSchema('\uFEFF{}', '{}').valid, true);
    assert.throws(() => inspectJsonSchema('{', '{}'), /Invalid JSON data/);
    assert.throws(() => inspectJsonSchema('9007199254740993', '{}'), /unsafe integer/);
    assert.throws(() => generateJsonSchema(Infinity), /non-finite/);
    assert.throws(() => inspectJsonSchema('1e400', '{}'), /non-finite/);
    assert.throws(() => inspectJsonSchema('1', '{"maximum":9007199254740993}'), /unsafe integer/);
  });

  it('bounds input/output size, depth and node counts and rejects circular generation input', () => {
    assert.throws(
      () => parseJsonSchemaData(' '.repeat(jsonSchemaLimits.dataCharacters) + '1'),
      /input characters/,
    );

    assert.throws(
      () => inspectJsonSchema('{}', ' '.repeat(jsonSchemaLimits.schemaCharacters) + '{}'),
      /input characters/,
    );

    assert.throws(
      () => generateJsonSchema(Array(jsonSchemaLimits.dataNodes).fill(1)),
      /values\/properties/,
    );

    assert.throws(
      () =>
        inspectJsonSchema(
          '{}',
          JSON.stringify({ enum: Array(jsonSchemaLimits.schemaNodes).fill(1) }),
        ),
      /values\/properties/,
    );

    assert.throws(
      () =>
        generateJsonSchema(
          Object.fromEntries(Array.from({ length: 3000 }, (_, index) => [`field${index}`, 1])),
        ),
      /Generated JSON Schema exceeds/,
    );

    const tooDeep = '['.repeat(65) + '1' + ']'.repeat(65);

    assert.throws(() => parseJsonSchemaData(tooDeep), /nesting levels/);
    const cycle: Record<string, JsonValue> = {};

    cycle.self = cycle;
    assert.throws(() => generateJsonSchema(cycle), /circular/);
    const shared: JsonValue = { name: 'Ada' };

    assert.equal(accepts([shared, shared], generateJsonSchema([shared, shared])), true);
  });

  it('rejects out-of-contract option values at the domain boundary', () => {
    assert.throws(
      () => generateJsonSchema({}, { draft: 'draft-04' as JsonSchemaDraft }),
      /Choose draft/,
    );

    assert.throws(
      () => generateJsonSchema({}, { additionalProperties: 'true' as unknown as boolean }),
      /must be true or false/,
    );

    assert.throws(
      () => generateJsonSchema({}, { requiredProperties: 'every' as 'observed' }),
      /observed required/,
    );

    assert.throws(
      () => inspectJsonSchema('{}', '{}', { draft: 'invalid' as JsonSchemaDraft }),
      /Choose draft/,
    );

    assert.throws(
      () => inspectJsonSchema('{}', '{}', { allErrors: 'true' as unknown as boolean }),
      /must be true or false/,
    );

    assert.throws(
      () => inspectJsonSchema('{}', '{}', { validateFormats: 'true' as unknown as boolean }),
      /must be true or false/,
    );
  });

  it('reads ipv4 and date-time strictly', () => {
    const isValid = (data: string, format: string) =>
      inspectJsonSchema(JSON.stringify(data), JSON.stringify({ format })).valid;

    for (const address of ['0.0.0.0', '1.2.3.4', '255.255.255.255', '10.100.199.200'])
      assert.equal(isValid(address, 'ipv4'), true, address);

    for (const address of ['01.2.3.4', '1.2.3.004', '256.1.1.1', '1.2.3'])
      assert.equal(isValid(address, 'ipv4'), false, address);

    assert.equal(isValid('2024-01-01T00:00:00Z', 'date-time'), true);
    assert.equal(isValid('2024-01-01t00:00:00+01:00', 'date-time'), true);
    assert.equal(isValid('2024-01-01 00:00:00Z', 'date-time'), false);
    assert.equal(isValid('2024-13-01T00:00:00Z', 'date-time'), false);
  });
});
