import { FunctionError } from '../errors';
import type { JsonValue } from '../format/json';
import { generateJsonSchema } from '../schema/generate';
import { parseAiJson } from './json';
import { aiLimits } from './limits';

type Schema = Record<string, JsonValue>;

export type ToolSchemaOptions = {
  description: string;
  name: string;
  provider: 'all' | 'anthropic' | 'gemini' | 'openai';
  strict: boolean;
};

export type ToolSchemaResult = { dropped: string[]; output: JsonValue; warnings: string[] };

type Findings = { emptyArrays: Set<string>; emptyObjects: Set<string>; nulls: Set<string> };

const { depth, descriptionChars, examples, examplesChars, generatedNodes, namePattern, nodes } =
  aiLimits.schema;
const format = new Intl.NumberFormat('en-US');
const prototypePattern = '^__proto__$';
const strictKeywords = new Set([
  'additionalProperties',
  'anyOf',
  'description',
  'enum',
  'items',
  'properties',
  'required',
  'type',
]);

function fail(message: string): never {
  throw new FunctionError('INVALID_AI_INPUT', message);
}

const isRecord = (value: JsonValue | undefined): value is Schema =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const sortKeys = (schema: Schema): Schema =>
  Object.fromEntries(Object.entries(schema).sort(([left], [right]) => (left < right ? -1 : 1)));

function mapChildren(schema: Schema, map: (child: Schema) => Schema): Schema {
  const mapped = (child: JsonValue) => (isRecord(child) ? map(child) : child);

  return Object.fromEntries(
    Object.entries(schema).map(([key, value]) => {
      if (key === 'properties' && isRecord(value))
        return [
          key,
          Object.fromEntries(Object.entries(value).map(([name, child]) => [name, mapped(child)])),
        ];
      if (key === 'items') return [key, mapped(value)];
      if (key === 'anyOf' && Array.isArray(value)) return [key, value.map(mapped)];

      return [key, value];
    }),
  );
}

function inferParameters(examplesText: string): Schema {
  const value = parseAiJson(examplesText, 'Example arguments', {
    characters: examplesChars,
    depth,
    nodes,
  });
  const withoutMeta = (schema: Schema) =>
    Object.fromEntries(
      Object.entries(schema).filter(([key]) => key !== '$schema' && key !== 'title'),
    );

  if (!Array.isArray(value)) {
    if (!isRecord(value)) fail('Example arguments must be a JSON object.');

    return withoutMeta(
      generateJsonSchema(value, { label: 'Example arguments', schemaNodes: generatedNodes }),
    );
  }

  if (value.length < examples.min || value.length > examples.max)
    fail(`Example arguments must hold ${examples.min}-${examples.max} examples.`);

  value.forEach((example, index) => {
    if (!isRecord(example)) fail(`Example ${index + 1} must be a JSON object.`);
  });

  // Inferring the array merges the examples, so a property some of them lack is not required.
  const { items } = generateJsonSchema(value, {
    label: 'Example arguments',
    schemaNodes: generatedNodes,
  });

  return isRecord(items) ? withoutMeta(items) : fail('Example arguments must be a JSON object.');
}

function inspect(schema: Schema, path: string, findings: Findings, member = false): void {
  if (!member && schema.type === 'null') findings.nulls.add(path);
  if (isRecord(schema.items)) {
    if (Object.keys(schema.items).length === 0) findings.emptyArrays.add(path);

    inspect(schema.items, `${path}[]`, findings);
  }

  if (Array.isArray(schema.anyOf))
    for (const child of schema.anyOf) if (isRecord(child)) inspect(child, path, findings, true);

  if (isRecord(schema.properties) && Object.keys(schema.properties).length === 0)
    findings.emptyObjects.add(path);

  if (isRecord(schema.properties))
    for (const [name, child] of Object.entries(schema.properties))
      if (isRecord(child)) inspect(child, path === '' ? name : `${path}.${name}`, findings);
}

/** An empty example array infers `items: {}`; providers that need an item type get string. */
const typedItems = (schema: Schema): Schema =>
  isRecord(schema.items) && Object.keys(schema.items).length === 0
    ? { ...schema, items: { type: 'string' } }
    : schema;

const allowsNull = (schema: Schema): boolean =>
  schema.type === 'null' ||
  (Array.isArray(schema.type) && schema.type.includes('null')) ||
  (Array.isArray(schema.anyOf) &&
    schema.anyOf.some((child) => isRecord(child) && allowsNull(child)));

function nullable(schema: Schema): Schema {
  if (allowsNull(schema)) return schema;
  if (Array.isArray(schema.anyOf)) return { ...schema, anyOf: [...schema.anyOf, { type: 'null' }] };
  if (typeof schema.type === 'string') return { ...schema, type: [schema.type, 'null'] };
  if (Array.isArray(schema.type)) return { ...schema, type: [...schema.type, 'null'] };

  return schema;
}

/** OpenAI strict mode: closed objects, every property required, optional ones nullable. */
function strictSchema(schema: Schema, dropped: Set<string>): Schema {
  for (const key of Object.keys(schema)) if (!strictKeywords.has(key)) dropped.add(key);

  const kept = typedItems(
    Object.fromEntries(Object.entries(schema).filter(([key]) => strictKeywords.has(key))),
  );
  const strict = mapChildren(kept, (child) => strictSchema(child, dropped));

  if (!isRecord(strict.properties)) return strict;

  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const properties = Object.fromEntries(
    Object.entries(strict.properties).map(([key, child]) => [
      key,
      required.has(key) || !isRecord(child) ? child : nullable(child),
    ]),
  );

  return sortKeys({
    ...strict,
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  });
}

function geminiType(type: JsonValue): Schema {
  // Gemini has no null type.
  if (type === 'null') return { nullable: true, type: 'string' };
  if (!Array.isArray(type)) return { type };

  const types = type.filter((entry) => entry !== 'null');
  const nullableFlag: Schema = types.length < type.length ? { nullable: true } : {};

  return types.length === 1
    ? { ...nullableFlag, type: types[0] ?? null }
    : { ...nullableFlag, anyOf: types.map((entry) => ({ type: entry })) };
}

function foldNull(schema: Schema): Schema {
  const { anyOf, ...rest } = schema;

  if (!Array.isArray(anyOf)) return schema;

  const members = anyOf.filter((child) => !(isRecord(child) && child.type === 'null'));
  const [only] = members;

  if (members.length === anyOf.length) return schema;

  return {
    ...rest,
    ...(members.length === 1 && isRecord(only) ? only : { anyOf: members }),
    nullable: true,
  };
}

/** The inference parks a `__proto__` key in patternProperties, which Gemini does not support. */
function foldPrototypeKey(schema: Schema): Schema {
  const { patternProperties, ...rest } = schema;

  if (!isRecord(patternProperties) || !Object.hasOwn(patternProperties, prototypePattern))
    return schema;

  const { [prototypePattern]: child, ...otherPatterns } = patternProperties;
  const properties = Object.entries(isRecord(rest.properties) ? rest.properties : {});

  return {
    ...rest,
    ...(Object.keys(otherPatterns).length > 0 ? { patternProperties: otherPatterns } : {}),
    // fromEntries defines an own property, so the key stays ordinary.
    properties: Object.fromEntries([...properties, ['__proto__', child ?? {}]]),
  };
}

/** Gemini takes an OpenAPI subset: no type arrays, no null type and no additionalProperties. */
function geminiSchema(schema: Schema): Schema {
  const folded = typedItems(foldNull(foldPrototypeKey(schema)));
  const entries = Object.entries(mapChildren(folded, geminiSchema)).flatMap(([key, value]) => {
    if (key === 'additionalProperties') return [];

    return key === 'type' ? Object.entries(geminiType(value)) : [[key, value] as const];
  });

  return sortKeys(Object.fromEntries(entries));
}

export function buildToolSchemas(
  examplesText: string,
  options: ToolSchemaOptions,
): ToolSchemaResult {
  const { name, provider, strict } = options;
  const description = options.description.trim();

  if (!namePattern.test(name)) fail('Name must be 1-64 characters: letters, digits, _ or -.');
  if (description.length < 1 || description.length > descriptionChars)
    fail(`Description must be 1-${format.format(descriptionChars)} characters.`);

  const parameters = inferParameters(examplesText);
  const dropped = new Set<string>();
  const builders = {
    anthropic: () => ({ description, input_schema: parameters, name }),
    gemini: () => ({
      functionDeclarations: [{ description, name, parameters: geminiSchema(parameters) }],
    }),
    openai: () => ({
      function: {
        description,
        name,
        parameters: strict ? strictSchema(parameters, dropped) : parameters,
        strict,
      },
      type: 'function',
    }),
  };
  const output =
    provider === 'all'
      ? { anthropic: builders.anthropic(), gemini: builders.gemini(), openai: builders.openai() }
      : builders[provider]();

  return { dropped: [...dropped].sort(), output, warnings: warn(parameters, options) };
}

function warn(parameters: Schema, { provider, strict }: ToolSchemaOptions): string[] {
  const findings: Findings = { emptyArrays: new Set(), emptyObjects: new Set(), nulls: new Set() };
  const gemini = provider === 'all' || provider === 'gemini';
  const assumers = [
    ...(strict && (provider === 'all' || provider === 'openai') ? ['OpenAI strict mode'] : []),
    ...(gemini ? ['Gemini'] : []),
  ];
  const inferable = 'Add an item so its type can be inferred.';

  inspect(parameters, '', findings);

  return [
    ...[...findings.emptyArrays].map((path) =>
      assumers.length > 0
        ? `${path} is an empty array in every example; string items were assumed for ${assumers.join(' and ')}. ${inferable}`
        : `${path} is an empty array in every example, so its items have no type. ${inferable}`,
    ),
    ...(gemini
      ? [...findings.nulls].map(
          (path) =>
            `${path} is null in every example; Gemini has no null type, so a nullable string was assumed.`,
        )
      : []),
    ...(gemini
      ? [...findings.emptyObjects].map((path) =>
          path === ''
            ? 'The parameters object has no properties; Gemini may reject it, so remove parameters from the declaration of a function with no arguments.'
            : `${path} has no properties in any example; Gemini may reject an empty object, so remove it or add a property.`,
        )
      : []),
  ];
}
