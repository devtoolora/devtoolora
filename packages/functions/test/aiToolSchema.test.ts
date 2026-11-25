import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { FunctionError } from '../src/errors';
import type { JsonValue } from '../src/format';
import { aiLimits, buildToolSchemas, type ToolSchemaOptions } from '../src/ai';

type Schema = Record<string, unknown>;

// Each integer key costs 3 schema values (property, type, required); 1,664 is the last that fits.
const LIMIT_KEYS = 1664;

const base: ToolSchemaOptions = {
  description: 'Get the weather.',
  name: 'get_weather',
  provider: 'anthropic',
  strict: true,
};
const build = (value: unknown, options: Partial<ToolSchemaOptions> = {}) =>
  buildToolSchemas(typeof value === 'string' ? value : JSON.stringify(value), {
    ...base,
    ...options,
  });

const inputSchema = (value: unknown) => {
  const { output } = build(value);

  assert.ok(output !== null && typeof output === 'object' && !Array.isArray(output));

  return output.input_schema;
};

const fails = (action: () => unknown, fragment: string) =>
  assert.throws(
    action,
    (error) => error instanceof FunctionError && error.message.includes(fragment),
  );
const string = { type: 'string' };
const twoExamples = [
  { city: 'Prague', meta: { x: 1 }, tags: ['a'] },
  { city: 'Oslo', unit: 'c' },
];
const twoExamplesText = JSON.stringify(twoExamples).replace(
  '{"city":"Oslo"',
  '{"__proto__":{"y":true},"city":"Oslo"',
);

describe('function-calling schema builder', () => {
  it('infers the parameters of one example object', () => {
    assert.deepEqual(inputSchema({ city: 'Prague', days: 3 }), {
      additionalProperties: false,
      properties: { city: string, days: { type: 'integer' } },
      required: ['city', 'days'],
      type: 'object',
    });
  });

  it('makes a property missing from some examples optional', () => {
    assert.deepEqual(inputSchema([{ city: 'Prague', days: 3 }, { city: 'Oslo' }]), {
      additionalProperties: false,
      properties: { city: string, days: { type: 'integer' } },
      required: ['city'],
      type: 'object',
    });
  });

  it('removes $schema and title and treats constructor as an ordinary name', () => {
    const schema = inputSchema({ constructor: 'x', toString: 1 });

    assert.deepEqual(schema, {
      additionalProperties: false,
      properties: { constructor: string, toString: { type: 'integer' } },
      required: ['constructor', 'toString'],
      type: 'object',
    });

    assert.doesNotMatch(JSON.stringify(build({ a: 1 }, { provider: 'all' })), /\$schema|"title"/);
  });

  it('accepts 1-20 examples and names the range otherwise', () => {
    const one = { a: 1 };

    assert.ok(build(Array.from({ length: 20 }, () => one)));
    fails(() => build([]), 'Example arguments must hold 1-20 examples.');

    fails(
      () => build(Array.from({ length: 21 }, () => one)),
      'Example arguments must hold 1-20 examples.',
    );
  });

  it('requires example objects', () => {
    for (const root of ['42', '"x"', 'null', 'true'])
      fails(() => build(root), 'Example arguments must be a JSON object.');

    fails(() => build([{ a: 1 }, [1]]), 'Example 2 must be a JSON object.');
    fails(() => build('{"a":'), 'Example arguments: ');
    fails(() => build(''), 'Example arguments is not valid JSON.');
  });

  it('checks the name and description rules', () => {
    assert.ok(build({ a: 1 }, { name: 'a'.repeat(64) }));
    assert.ok(build({ a: 1 }, { name: 'get-weather_2' }));

    for (const name of ['', 'a'.repeat(65), 'get weather', 'get.weather', 'wetteré'])
      fails(
        () => build({ a: 1 }, { name }),
        'Name must be 1-64 characters: letters, digits, _ or -.',
      );

    assert.ok(build({ a: 1 }, { description: 'd'.repeat(1_024) }));

    for (const description of ['', '   ', 'd'.repeat(1_025)])
      fails(() => build({ a: 1 }, { description }), 'Description must be 1-1,024 characters.');
  });

  it('limits the examples to 1,000,000 characters and 50,000 values', () => {
    const values = (count: number) =>
      `{"a":[${Array.from({ length: count }, () => '0').join(',')}]}`;

    assert.ok(build(values(49_998)));
    fails(() => build(values(49_999)), 'Example arguments must have at most 50,000 values.');

    const padded = (length: number) => `{"a":"${'x'.repeat(length - 8)}"}`;

    assert.equal(padded(1_000_000).length, 1_000_000);
    assert.ok(build(padded(1_000_000)));

    fails(
      () => build(`${padded(1_000_000)} `),
      'Example arguments must be at most 1,000,000 characters.',
    );
  });

  it('limits nesting to 30 levels', () => {
    const nested = (depth: number) => `${'{"a":'.repeat(depth)}1${'}'.repeat(depth)}`;

    assert.ok(build(nested(30)));
    assert.ok(build(`[${nested(29)}]`));
    fails(() => build(nested(31)), 'Example arguments is nested deeper than 30 levels.');
  });

  it('builds the OpenAI strict schema and lists dropped keywords', () => {
    const result = build(twoExamplesText, { provider: 'openai' });
    const nullable = (schema: Record<string, JsonValue>, type: string) => ({
      ...schema,
      type: [type, 'null'],
    });

    assert.deepEqual(result.dropped, ['patternProperties']);

    assert.deepEqual(result.output, {
      function: {
        description: 'Get the weather.',
        name: 'get_weather',
        parameters: {
          additionalProperties: false,
          properties: {
            city: string,
            meta: nullable(
              {
                additionalProperties: false,
                properties: { x: { type: 'integer' } },
                required: ['x'],
              },
              'object',
            ),
            tags: nullable({ items: string }, 'array'),
            unit: { type: ['string', 'null'] },
          },
          required: ['city', 'meta', 'tags', 'unit'],
          type: 'object',
        },
        strict: true,
      },
      type: 'function',
    });
  });

  it('keeps anyOf and null types valid in strict mode', () => {
    const { output } = build([{ a: 1, b: null }, { a: 'x' }, { a: { z: 1 } }], {
      provider: 'openai',
    });
    const parameters = JSON.parse(JSON.stringify(output)).function.parameters;

    assert.deepEqual(parameters.properties.b, { type: 'null' });

    assert.deepEqual(parameters.properties.a.anyOf, [
      { type: ['string', 'integer'] },
      {
        additionalProperties: false,
        properties: { z: { type: 'integer' } },
        required: ['z'],
        type: 'object',
      },
    ]);
  });

  it('builds the OpenAI non-strict schema unchanged', () => {
    const result = build(twoExamplesText, { provider: 'openai', strict: false });
    const parameters = JSON.parse(JSON.stringify(result.output)).function;

    assert.deepEqual(result.dropped, []);
    assert.equal(parameters.strict, false);
    assert.deepEqual(parameters.parameters.required, ['city']);
    assert.ok(parameters.parameters.patternProperties);
    assert.deepEqual(parameters.parameters.properties.unit, string);
  });

  it('builds the Anthropic shape', () => {
    const { dropped, output } = build({ city: 'Prague' });

    assert.deepEqual(dropped, []);
    assert.deepEqual(Object.keys(output ?? {}), ['description', 'input_schema', 'name']);
  });

  it('builds the Gemini shape with nullable types and no additionalProperties', () => {
    const { output } = build(
      [
        { city: 'Prague', n: 1, nested: { zip: null } },
        { city: 'Oslo', n: 'x', nested: { zip: '0150' } },
      ],
      { provider: 'gemini' },
    );

    assert.deepEqual(output, {
      functionDeclarations: [
        {
          description: 'Get the weather.',
          name: 'get_weather',
          parameters: {
            properties: {
              city: string,
              n: { anyOf: [string, { type: 'integer' }] },
              nested: {
                properties: { zip: { nullable: true, type: 'string' } },
                required: ['zip'],
                type: 'object',
              },
            },
            required: ['city', 'n', 'nested'],
            type: 'object',
          },
        },
      ],
    });
  });

  it('folds null-or-object and null-or-array unions into nullable for Gemini', () => {
    const { output, warnings } = build(
      [
        { list: null, meta: null },
        { list: [1], meta: { b: 1 } },
      ],
      { provider: 'gemini' },
    );
    const { properties } = JSON.parse(JSON.stringify(output)).functionDeclarations[0].parameters;

    assert.deepEqual(properties.list, {
      items: { type: 'integer' },
      nullable: true,
      type: 'array',
    });

    assert.deepEqual(properties.meta, {
      nullable: true,
      properties: { b: { type: 'integer' } },
      required: ['b'],
      type: 'object',
    });

    assert.deepEqual(warnings, []);
  });

  it('turns an always-null property into a nullable string for Gemini, with a warning', () => {
    const gemini = build({ flag: null }, { provider: 'gemini' });
    const { properties } = JSON.parse(JSON.stringify(gemini.output)).functionDeclarations[0]
      .parameters;

    assert.deepEqual(properties.flag, { nullable: true, type: 'string' });

    assert.deepEqual(gemini.warnings, [
      'flag is null in every example; Gemini has no null type, so a nullable string was assumed.',
    ]);

    for (const provider of ['anthropic', 'openai'] as const)
      assert.deepEqual(build({ flag: null }, { provider }).warnings, [], provider);
  });

  it('warns that Gemini may refuse an object with no properties', () => {
    const noArguments =
      'The parameters object has no properties; Gemini may reject it, so remove parameters from the declaration of a function with no arguments.';
    const nested =
      'a has no properties in any example; Gemini may reject an empty object, so remove it or add a property.';

    assert.deepEqual(build({}, { provider: 'gemini' }).warnings, [noArguments]);
    assert.deepEqual(build({ a: {} }, { provider: 'all' }).warnings, [nested]);
    assert.deepEqual(build({ a: {} }, { provider: 'openai' }).warnings, []);
  });

  it('warns about empty example arrays and assumes string items where a type is needed', () => {
    const example = { deep: [{ x: [] }], maybe: null, tags: [] };
    const examples = [example, { ...example, maybe: [] }];
    const open = (path: string) =>
      `${path} is an empty array in every example, so its items have no type. Add an item so its type can be inferred.`;
    const assumed = (path: string, providers: string) =>
      `${path} is an empty array in every example; string items were assumed for ${providers}. Add an item so its type can be inferred.`;
    const paths = ['deep[].x', 'maybe', 'tags'];

    const parametersOf = (output: JsonValue, provider: 'gemini' | 'openai') => {
      const parsed = JSON.parse(JSON.stringify(output));

      return provider === 'openai'
        ? parsed.function.parameters
        : parsed.functionDeclarations[0].parameters;
    };

    for (const provider of ['anthropic', 'openai'] as const) {
      const result = build(examples, { provider, strict: false });

      assert.deepEqual(result.warnings, paths.map(open), provider);
    }

    const strict = build(examples, { provider: 'openai' });
    const strictParameters = parametersOf(strict.output, 'openai');

    assert.deepEqual(
      strict.warnings,
      paths.map((path) => assumed(path, 'OpenAI strict mode')),
    );

    assert.deepEqual(strictParameters.properties.tags.items, string);
    assert.deepEqual(strictParameters.properties.deep.items.properties.x.items, string);

    const gemini = build(examples, { provider: 'gemini' });
    const geminiParameters = parametersOf(gemini.output, 'gemini');

    assert.deepEqual(
      gemini.warnings,
      paths.map((path) => assumed(path, 'Gemini')),
    );

    assert.deepEqual(geminiParameters.properties.tags.items, string);

    assert.deepEqual(geminiParameters.properties.maybe, {
      items: string,
      nullable: true,
      type: 'array',
    });

    assert.deepEqual(
      build(examples, { provider: 'all' }).warnings,
      paths.map((path) => assumed(path, 'OpenAI strict mode and Gemini')),
    );

    assert.deepEqual(
      build(examples, { provider: 'all', strict: false }).warnings,
      paths.map((path) => assumed(path, 'Gemini')),
    );
  });

  it('names the example arguments when a number cannot be kept exactly', () => {
    fails(() => build('{"id": 12345678901234567890}'), 'Example arguments: Quote integers');
  });

  it('builds all three providers', () => {
    const { output } = build({ a: 1 }, { provider: 'all' });

    assert.deepEqual(Object.keys(output ?? {}), ['anthropic', 'gemini', 'openai']);
  });
});

describe('function-calling schema builder: __proto__ and limits', () => {
  it('gives Gemini an ordinary __proto__ property and no patternProperties', () => {
    const { output } = build(twoExamplesText, { provider: 'gemini' });

    assert.equal(JSON.stringify(output).includes('patternProperties'), false);

    const [declaration] = (output as { functionDeclarations: Array<{ parameters: Schema }> })
      .functionDeclarations;
    const properties = declaration?.parameters.properties as Record<string, unknown>;

    assert.equal(Object.hasOwn(properties, '__proto__'), true);
  });

  it('takes the generator cap from aiLimits and names it', () => {
    const keys = (count: number) =>
      JSON.stringify(
        Object.fromEntries(Array.from({ length: count }, (_, index) => [`k${index}`, 1])),
      );
    const message = `Generated JSON Schema exceeds ${aiLimits.schema.generatedNodes.toLocaleString('en-US')} values/properties.`;

    assert.equal(aiLimits.schema.generatedNodes, 5_000);
    assert.doesNotThrow(() => build(keys(LIMIT_KEYS)));
    fails(() => build(keys(LIMIT_KEYS + 1)), message);
  });
});

describe('function-calling schema builder work', () => {
  it('merges many distinct example objects in linear time', () => {
    const objects = Array.from({ length: 16_665 }, (_, index) => `{"k${index}":1}`);
    const started = performance.now();

    assert.throws(
      () => build(`{"a":[${objects.join(',')}]}`),
      (error) =>
        error instanceof FunctionError &&
        error.message === 'Generated JSON Schema exceeds 5,000 values/properties.',
    );

    // Copying the merged property map per object would take about 21 s.
    assert.ok(performance.now() - started < 3_000);
  });
});
