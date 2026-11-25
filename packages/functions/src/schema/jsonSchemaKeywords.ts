import { format } from './validationEngine.generated';
import type { JsonValue } from '../format';
import type { JsonSchemaDraft } from './jsonSchemaShared';
import {
  draftFromUri,
  errorMessage,
  isRecord,
  jsonSchemaDraftUris,
  schemaError,
} from './jsonSchemaShared';

const strictIpv4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const looseDateTime = format['date-time'];

// The engine also takes leading zeros, which the JSON Schema test suite rejects, and a space
// instead of T, which the RFC 3339 grammar has no room for.
format.ipv4 = (value) => strictIpv4.test(value);
format['date-time'] = (value) => !/\s/.test(value) && Boolean(looseDateTime?.(value));

export function prepareSchemaKeywords(
  schema: boolean | Record<string, JsonValue>,
  draft: JsonSchemaDraft,
  validateFormats: boolean,
): void {
  if (typeof schema === 'boolean') return;

  checkKeywords(schema, draft);

  if (schema.$schema !== undefined && schema.$schema !== jsonSchemaDraftUris[draft]) {
    if (typeof schema.$schema !== 'string' || draftFromUri(schema.$schema) !== draft)
      throw schemaError('Mixed draft declarations inside a schema are not supported.');
  }

  if (schema.format !== undefined) {
    if (
      validateFormats &&
      (typeof schema.format !== 'string' || !Object.hasOwn(format, schema.format))
    )
      throw schemaError(`Invalid JSON Schema: unknown format ${JSON.stringify(schema.format)}.`);
    if (!validateFormats) delete schema.format;
  }

  if (schema.$recursiveRef !== undefined && schema.$recursiveRef !== '#') {
    throw schemaError(
      'Only the recursive reference "#" is supported. Use ordinary local $ref values for other targets.',
    );
  }

  if (isRecord(schema.$vocabulary)) checkVocabulary(schema.$vocabulary, draft);
  if (typeof schema.pattern === 'string') checkedPattern(schema.pattern);
  if (isRecord(schema.patternProperties))
    for (const pattern of Object.keys(schema.patternProperties)) checkedPattern(pattern);

  for (const child of subschemas(schema)) prepareSchemaKeywords(child, draft, validateFormats);
}

const commonKeywords = [
  '$id',
  '$ref',
  '$schema',
  '$comment',
  'title',
  'description',
  'default',
  'examples',
  'readOnly',
  'writeOnly',
  'definitions',
  'type',
  'enum',
  'const',
  'multipleOf',
  'maximum',
  'exclusiveMaximum',
  'minimum',
  'exclusiveMinimum',
  'maxLength',
  'minLength',
  'pattern',
  'format',
  'maxItems',
  'minItems',
  'uniqueItems',
  'contains',
  'maxProperties',
  'minProperties',
  'required',
  'properties',
  'patternProperties',
  'additionalProperties',
  'propertyNames',
  'if',
  'then',
  'else',
  'allOf',
  'anyOf',
  'oneOf',
  'not',
  'items',
  'contentEncoding',
  'contentMediaType',
];
const modernKeywords = [
  '$anchor',
  '$vocabulary',
  '$defs',
  'dependentRequired',
  'dependentSchemas',
  'unevaluatedProperties',
  'unevaluatedItems',
  'minContains',
  'maxContains',
  'contentSchema',
  'deprecated',
];

function allowedKeywords(draft: JsonSchemaDraft): Set<string> {
  const allowed = new Set(commonKeywords);

  if (draft !== '2020-12') for (const key of ['dependencies', 'additionalItems']) allowed.add(key);
  if (draft !== 'draft-07') for (const key of modernKeywords) allowed.add(key);
  if (draft === '2019-09')
    for (const key of ['$recursiveAnchor', '$recursiveRef']) allowed.add(key);
  if (draft === '2020-12') allowed.add('prefixItems');

  return allowed;
}

function checkKeywords(schema: Record<string, JsonValue>, draft: JsonSchemaDraft): void {
  const allowed = allowedKeywords(draft);

  for (const key of Object.keys(schema)) {
    if (key === '$async')
      throw schemaError(
        'Asynchronous schemas are not supported. Validation stays local and synchronous.',
      );
    if (key === '$dynamicRef' || key === '$dynamicAnchor')
      throw schemaError(
        'Dynamic references/anchors are not supported by this local no-eval engine. Use ordinary local $ref values.',
      );
    if (!allowed.has(key))
      throw schemaError(
        `Invalid JSON Schema: unknown keyword ${JSON.stringify(key)} for ${draft}.`,
      );
  }
}

function checkVocabulary(vocabulary: Record<string, JsonValue>, draft: JsonSchemaDraft): void {
  const supported =
    draft === '2020-12'
      ? [
          'core',
          'applicator',
          'unevaluated',
          'validation',
          'meta-data',
          'format-annotation',
          'format-assertion',
          'content',
        ]
      : ['core', 'applicator', 'validation', 'meta-data', 'format', 'content'];

  for (const [uri, required] of Object.entries(vocabulary)) {
    if (
      required === true &&
      !supported.some(
        (name: string) => uri === `https://json-schema.org/draft/${draft}/vocab/${name}`,
      )
    ) {
      throw schemaError(`Unsupported mandatory JSON Schema vocabulary ${JSON.stringify(uri)}.`);
    }
  }
}

function subschemas(schema: Record<string, JsonValue>): Array<boolean | Record<string, JsonValue>> {
  const isSchema = (value: JsonValue): value is boolean | Record<string, JsonValue> =>
    isRecord(value) || typeof value === 'boolean';
  const children: Array<boolean | Record<string, JsonValue>> = [];

  for (const keyword of [
    'properties',
    'patternProperties',
    '$defs',
    'definitions',
    'dependentSchemas',
    'dependencies',
  ]) {
    const map = schema[keyword];

    if (isRecord(map)) children.push(...Object.values(map).filter(isSchema));
  }

  for (const keyword of [
    'items',
    'additionalItems',
    'additionalProperties',
    'contains',
    'not',
    'if',
    'then',
    'else',
    'propertyNames',
    'unevaluatedItems',
    'unevaluatedProperties',
    'contentSchema',
  ]) {
    const child = schema[keyword];

    if (child !== undefined && isSchema(child)) children.push(child);
  }

  for (const keyword of ['items', 'prefixItems', 'allOf', 'anyOf', 'oneOf']) {
    const items = schema[keyword];

    if (Array.isArray(items)) children.push(...items.filter(isSchema));
  }

  return children;
}

function checkedPattern(pattern: string): void {
  try {
    new RegExp(pattern, 'u');
  } catch (error: unknown) {
    throw schemaError(`Invalid JSON Schema regular expression: ${errorMessage(error)}`);
  }
}

export function prepareAdditionalPropertyRules(schema: boolean | Record<string, JsonValue>): void {
  if (typeof schema === 'boolean') return;

  for (const child of subschemas(schema)) prepareAdditionalPropertyRules(child);

  if (
    schema.additionalProperties !== undefined &&
    (isRecord(schema.properties) || isRecord(schema.patternProperties))
  ) {
    // The interpreter marks only successful properties as evaluated. A separate always-true
    // name-map makes additionalProperties depend on declared names, not on their value validity.
    const rule: Record<string, JsonValue> = {
      additionalProperties: schema.additionalProperties,
      ...(isRecord(schema.patternProperties)
        ? {
            patternProperties: Object.fromEntries(
              Object.keys(schema.patternProperties).map((key: string) => [key, true]),
            ),
          }
        : {}),
      ...(isRecord(schema.properties)
        ? {
            properties: Object.fromEntries(
              Object.keys(schema.properties).map((key: string) => [key, true]),
            ),
          }
        : {}),
    };

    delete schema.additionalProperties;
    schema.allOf = [...(Array.isArray(schema.allOf) ? schema.allOf : []), rule];
  }
}

export function removeObjectPrototypes(value: JsonValue): void {
  if (value === null || typeof value !== 'object') return;
  if (!Array.isArray(value)) Object.setPrototypeOf(value, null);

  for (const child of Object.values(value)) removeObjectPrototypes(child);
}

export function preparePrototypeProperties(schema: boolean | Record<string, JsonValue>): void {
  if (typeof schema === 'boolean') return;

  const property =
    isRecord(schema.properties) && Object.hasOwn(schema.properties, '__proto__')
      ? schema.properties.__proto__
      : undefined;

  if (property !== undefined && isRecord(schema.properties)) {
    delete schema.properties.__proto__;

    if (schema.patternProperties !== undefined && !isRecord(schema.patternProperties)) {
      throw schemaError('Invalid JSON Schema: patternProperties must be an object.');
    }

    const patterns = isRecord(schema.patternProperties) ? schema.patternProperties : {};
    const existing = patterns['^__proto__$'];

    schema.patternProperties = {
      ...patterns,
      '^__proto__$': existing === undefined ? property : { allOf: [existing, property] },
    };
  }

  // Visit schema-bearing keywords only: enum/default/examples may contain opaque JSON objects.
  for (const keyword of [
    'properties',
    'patternProperties',
    '$defs',
    'definitions',
    'dependentSchemas',
    'dependencies',
  ]) {
    const map = schema[keyword];

    if (isRecord(map))
      for (const child of Object.values(map))
        if (isRecord(child) || typeof child === 'boolean') preparePrototypeProperties(child);
  }

  for (const keyword of [
    'items',
    'additionalItems',
    'additionalProperties',
    'contains',
    'not',
    'if',
    'then',
    'else',
    'propertyNames',
    'unevaluatedItems',
    'unevaluatedProperties',
    'contentSchema',
  ]) {
    const child = schema[keyword];

    if (isRecord(child) || typeof child === 'boolean') preparePrototypeProperties(child);
  }

  for (const keyword of ['items', 'prefixItems', 'allOf', 'anyOf', 'oneOf']) {
    const children = schema[keyword];

    if (Array.isArray(children))
      for (const child of children)
        if (isRecord(child) || typeof child === 'boolean') preparePrototypeProperties(child);
  }
}
