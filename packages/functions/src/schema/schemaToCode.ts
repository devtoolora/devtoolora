import type { JsonValue } from '../format';
import { isRecord, jsonSchemaLimits, parseBoundedJson, schemaError } from './jsonSchemaShared';
import { sanitizeTypeName } from './typeInference';

export type SchemaConstraints = {
  exclusiveMaximum?: number;
  exclusiveMinimum?: number;
  format?: string;
  maximum?: number;
  maxLength?: number;
  minimum?: number;
  minLength?: number;
  multipleOf?: number;
  pattern?: string;
};

export type SchemaNode = { description?: string } & (
  | {
      constraints: SchemaConstraints;
      kind: 'primitive';
      name: 'boolean' | 'integer' | 'never' | 'null' | 'number' | 'string' | 'unknown';
    }
  | { kind: 'literal'; values: JsonValue[] }
  | { items: SchemaNode; kind: 'array'; maxItems?: number; minItems?: number }
  | { items: SchemaNode[]; kind: 'tuple'; rest?: SchemaNode }
  | {
      additional: SchemaNode | boolean;
      kind: 'object';
      properties: Array<{ name: string; node: SchemaNode; optional: boolean }>;
    }
  | { kind: 'union'; members: SchemaNode[] }
  | { kind: 'intersection'; members: SchemaNode[] }
  | { kind: 'ref'; name: string }
);

type Declaration = { name: string; node: SchemaNode };

export type CompiledSchema = {
  declarations: Declaration[];
  ignored: string[];
  omitted: number;
};

type Schema = Record<string, JsonValue>;
type Context = {
  ignored: Set<string>;
  names: Map<string, string>;
  nested: Declaration[];
  reserved: ReadonlySet<string>;
  used: Set<string>;
};
type PrimitiveName = 'boolean' | 'integer' | 'never' | 'null' | 'number' | 'string' | 'unknown';

const maxIgnored = 50;
const ignoredKeywords = [
  '$dynamicRef',
  'contains',
  'dependencies',
  'dependentRequired',
  'dependentSchemas',
  'else',
  'if',
  'maxContains',
  'maxProperties',
  'minContains',
  'minProperties',
  'not',
  'patternProperties',
  'propertyNames',
  'then',
  'unevaluatedItems',
  'unevaluatedProperties',
  'uniqueItems',
];
// Keywords the compiler honours; next to a $ref they are dropped, so they are listed as ignored.
const refSiblingKeywords = [
  'additionalItems',
  'additionalProperties',
  'allOf',
  'anyOf',
  'const',
  'enum',
  'exclusiveMaximum',
  'exclusiveMinimum',
  'format',
  'items',
  'maxItems',
  'maxLength',
  'maximum',
  'minItems',
  'minLength',
  'minimum',
  'multipleOf',
  'oneOf',
  'pattern',
  'prefixItems',
  'properties',
  'required',
  'type',
];
const typelessConstraints = [
  'exclusiveMaximum',
  'exclusiveMinimum',
  'format',
  'maxItems',
  'maxLength',
  'maximum',
  'minItems',
  'minLength',
  'minimum',
  'multipleOf',
  'pattern',
  'required',
];
const primitiveTypes: PrimitiveName[] = ['boolean', 'integer', 'null', 'number', 'string'];
const numericConstraints = [
  'exclusiveMaximum',
  'exclusiveMinimum',
  'maxLength',
  'maximum',
  'minLength',
  'minimum',
  'multipleOf',
] as const;

export function compileJsonSchema(
  text: string,
  rootName: string,
  reserved: ReadonlySet<string> = new Set(),
): CompiledSchema {
  const root = parseBoundedJson(
    text,
    'JSON Schema',
    jsonSchemaLimits.schemaCharacters,
    jsonSchemaLimits.schemaNodes,
  );

  if (typeof root !== 'boolean' && !isRecord(root))
    throw schemaError('JSON Schema must be an object or a boolean.');

  const title = isRecord(root) && typeof root.title === 'string' ? root.title : '';
  const context: Context = {
    ignored: new Set(),
    names: new Map(),
    nested: [],
    reserved,
    used: new Set(),
  };
  const rootDeclaration = reserveName(title.trim() ? title : rootName, context);
  const definitions: Array<{ name: string; pointer: string; schema: JsonValue }> = [];

  context.names.set('#', rootDeclaration);

  for (const keyword of ['$defs', 'definitions']) {
    const group = isRecord(root) ? root[keyword] : undefined;

    if (!isRecord(group)) continue;

    for (const [key, schema] of Object.entries(group)) {
      const pointer = `#/${keyword}/${escapePointer(key)}`;
      const name = reserveName(key, context);

      context.names.set(pointer, name);
      definitions.push({ name, pointer, schema });
    }
  }

  const declarations: Declaration[] = [
    { name: rootDeclaration, node: compileDeclaration(root, '#', context) },
    ...definitions.map(({ name, pointer, schema }) => ({
      name,
      node: compileDeclaration(schema, pointer, context),
    })),
    ...context.nested,
  ];

  for (const { name, node } of declarations) {
    if (node.kind === 'ref' && node.name === name)
      throw schemaError(`Schema ${name} is only a $ref to itself, so it defines no type.`);
  }

  const pointerOf = (label: string): string => label.slice(label.indexOf(' at ') + 4);
  const ignored = [...context.ignored].sort((left, right) => {
    const [a, b] = [pointerOf(left), pointerOf(right)];

    return a < b ? -1 : Number(a > b);
  });

  return {
    declarations,
    ignored: ignored.slice(0, maxIgnored),
    omitted: Math.max(0, ignored.length - maxIgnored),
  };
}

export function ignoredComments(compiled: CompiledSchema): string[] {
  const lines = compiled.ignored.map((item) => `// ignored: ${item}`);

  return compiled.omitted > 0 ? [...lines, `// ignored: ${compiled.omitted} more omitted`] : lines;
}

function escapePointer(key: string): string {
  return key.replace(/~/g, '~0').replace(/\//g, '~1');
}

function reserveName(wanted: string, context: Context): string {
  const sanitized = sanitizeTypeName(wanted);
  const name = context.reserved.has(sanitized) ? `${sanitized}Type` : sanitized;
  let candidate = name;

  for (let suffix = 2; context.used.has(candidate); suffix += 1) candidate = `${name}${suffix}`;
  context.used.add(candidate);

  return candidate;
}

function refName(ref: string, context: Context): string {
  if (!ref.startsWith('#'))
    throw schemaError(`Remote $ref "${ref.slice(0, 64)}" is not supported; inline the schema.`);

  const name = context.names.get(ref) ?? context.names.get(decodedRef(ref));

  if (name === undefined) throw schemaError(`$ref "${ref.slice(0, 64)}" does not resolve.`);

  return name;
}

// A $ref is a URI fragment, so #/$defs/a%20b names the key "a b".
function decodedRef(ref: string): string {
  try {
    return decodeURIComponent(ref);
  } catch {
    return ref;
  }
}

function primitive(name: PrimitiveName, constraints: SchemaConstraints = {}): SchemaNode {
  return { constraints, kind: 'primitive', name };
}

function list(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function combine(kind: 'intersection' | 'union', members: SchemaNode[]): SchemaNode {
  const [first] = members;

  if (first === undefined) return primitive(kind === 'union' ? 'never' : 'unknown');

  return members.length === 1 ? first : { kind, members };
}

function compileDeclaration(schema: JsonValue, pointer: string, context: Context): SchemaNode {
  return isRecord(schema)
    ? compileSchema(schema, pointer, context)
    : compileNode(schema, pointer, context);
}

function compileNode(schema: JsonValue | undefined, pointer: string, context: Context): SchemaNode {
  if (schema === false) return primitive('never');
  if (!isRecord(schema)) return primitive('unknown');
  if (isTitledObject(schema)) return compileTitled(schema, pointer, context);

  return compileSchema(schema, pointer, context);
}

function isTitledObject(schema: Schema): boolean {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];

  return (
    typeof schema.title === 'string' &&
    schema.title.trim() !== '' &&
    typeof schema.$ref !== 'string' &&
    (isRecord(schema.properties) || types.includes('object'))
  );
}

function compileTitled(schema: Schema, pointer: string, context: Context): SchemaNode {
  const declaration: Declaration = {
    name: reserveName(String(schema.title), context),
    node: primitive('unknown'),
  };

  context.nested.push(declaration);

  const node = compileSchema(schema, pointer, context);
  const isNull = (member: SchemaNode) => member.kind === 'primitive' && member.name === 'null';
  const ref: SchemaNode = { kind: 'ref', name: declaration.name };

  if (node.kind !== 'union' || !node.members.some(isNull)) {
    declaration.node = node;

    return ref;
  }

  declaration.node = combine(
    'union',
    node.members.filter((member) => !isNull(member)),
  );

  if (node.description !== undefined) declaration.node.description = node.description;

  return { kind: 'union', members: [ref, primitive('null')] };
}

function compileSchema(schema: Schema, pointer: string, context: Context): SchemaNode {
  for (const keyword of ignoredKeywords) {
    if (Object.hasOwn(schema, keyword)) {
      const label = `${keyword} at ${pointer}`;

      context.ignored.add(label);
    }
  }

  const node = withNullable(compileBody(schema, pointer, context), schema);

  if (typeof schema.description === 'string') node.description = schema.description;

  return node;
}

function withNullable(node: SchemaNode, schema: Schema): SchemaNode {
  if (schema.nullable !== true) return node;

  const members = node.kind === 'union' ? node.members : [node];

  return members.some((member) => member.kind === 'primitive' && member.name === 'null')
    ? node
    : { kind: 'union', members: [...members, primitive('null')] };
}

function compileBody(schema: Schema, pointer: string, context: Context): SchemaNode {
  if (typeof schema.$ref === 'string') {
    for (const keyword of refSiblingKeywords) {
      if (Object.hasOwn(schema, keyword)) context.ignored.add(`${keyword} at ${pointer}`);
    }

    return { kind: 'ref', name: refName(schema.$ref, context) };
  }

  const own = compileOwn(schema, pointer, context);
  const parts: SchemaNode[] = own ? [own] : [];

  for (const keyword of ['anyOf', 'oneOf']) {
    const branches = list(schema[keyword]);

    if (branches.length > 0)
      parts.push(
        combine(
          'union',
          branches.map((branch, index) =>
            compileNode(branch, `${pointer}/${keyword}/${index}`, context),
          ),
        ),
      );
  }

  list(schema.allOf).forEach((branch, index) =>
    parts.push(compileNode(branch, `${pointer}/allOf/${index}`, context)),
  );

  return combine('intersection', parts);
}

function compileOwn(schema: Schema, pointer: string, context: Context): SchemaNode | undefined {
  if (Array.isArray(schema.enum)) return { kind: 'literal', values: schema.enum };
  if (Object.hasOwn(schema, 'const')) return { kind: 'literal', values: [schema.const ?? null] };

  const types = (Array.isArray(schema.type) ? schema.type : [schema.type]).filter(
    (item): item is string => typeof item === 'string',
  );

  if (types.length === 0) {
    if (isRecord(schema.properties) || Object.hasOwn(schema, 'additionalProperties'))
      return compileObject(schema, pointer, context);
    if (Object.hasOwn(schema, 'items') || Object.hasOwn(schema, 'prefixItems'))
      return compileArray(schema, pointer, context);

    for (const keyword of typelessConstraints) {
      if (Object.hasOwn(schema, keyword)) context.ignored.add(`${keyword} at ${pointer}`);
    }

    return undefined;
  }

  return combine(
    'union',
    types.map((type) => compileTyped(type, schema, pointer, context)),
  );
}

function compileTyped(type: string, schema: Schema, pointer: string, context: Context): SchemaNode {
  if (type === 'object') return compileObject(schema, pointer, context);
  if (type === 'array') return compileArray(schema, pointer, context);

  const name = primitiveTypes.find((candidate) => candidate === type);

  if (!name) throw schemaError(`Unknown type ${JSON.stringify(type.slice(0, 64))} at ${pointer}.`);

  const constraints = constraintsOf(schema);

  if (constraints.pattern !== undefined && !validPattern(constraints.pattern)) {
    delete constraints.pattern;
    context.ignored.add(`pattern at ${pointer}`);
  }

  return primitive(name, constraints);
}

function validPattern(pattern: string): boolean {
  try {
    new RegExp(pattern);

    return true;
  } catch {
    return false;
  }
}

function constraintsOf(schema: Schema): SchemaConstraints {
  const constraints: SchemaConstraints = {};

  for (const key of numericConstraints) {
    const value = schema[key];

    if (typeof value === 'number') constraints[key] = value;
  }

  if (typeof schema.format === 'string') constraints.format = schema.format;
  if (typeof schema.pattern === 'string') constraints.pattern = schema.pattern;

  return constraints;
}

function compileObject(schema: Schema, pointer: string, context: Context): SchemaNode {
  const required = new Set(list(schema.required));
  const properties = isRecord(schema.properties) ? Object.entries(schema.properties) : [];
  const extra = schema.additionalProperties;
  const declared = new Set(properties.map(([name]) => name));

  for (const name of required) {
    if (typeof name === 'string' && !declared.has(name))
      context.ignored.add(`required ${JSON.stringify(name)} at ${pointer}`);
  }

  return {
    additional: isRecord(extra)
      ? compileNode(extra, `${pointer}/additionalProperties`, context)
      : extra !== false,
    kind: 'object',
    properties: properties.map(([name, value]) => ({
      name,
      node: compileNode(value, `${pointer}/properties/${escapePointer(name)}`, context),
      optional: !required.has(name),
    })),
  };
}

function compileArray(schema: Schema, pointer: string, context: Context): SchemaNode {
  const modern = Array.isArray(schema.prefixItems);
  const prefix = modern ? schema.prefixItems : schema.items;

  if (!Array.isArray(prefix)) {
    const bounds: { maxItems?: number; minItems?: number } = {};

    if (typeof schema.maxItems === 'number') bounds.maxItems = schema.maxItems;
    if (typeof schema.minItems === 'number') bounds.minItems = schema.minItems;

    return {
      ...bounds,
      items: compileNode(schema.items, `${pointer}/items`, context),
      kind: 'array',
    };
  }

  const tail = modern ? schema.items : schema.additionalItems;
  const open = tail === undefined && prefix.length > 0;
  const key = modern ? 'prefixItems' : 'items';

  return {
    items: prefix.map((item, index) => compileNode(item, `${pointer}/${key}/${index}`, context)),
    kind: 'tuple',
    ...(isRecord(tail) || tail === true
      ? {
          rest: compileNode(tail, `${pointer}/${modern ? 'items' : 'additionalItems'}`, context),
        }
      : {}),
    ...(open ? { rest: primitive('unknown') } : {}),
  };
}
